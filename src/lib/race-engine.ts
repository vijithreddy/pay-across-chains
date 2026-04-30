import {
  createPublicClient,
  parseUnits,
  formatEther,
  type Hash,
  type TransactionReceipt,
} from "viem";
import { mainnet, base } from "wagmi/chains";
import { tempo, transports, CHAIN_NAMES } from "./chains";
import { signChain, type TempoWalletClient } from "./sign-chain";
import { replayRace, type ConfirmationResult } from "./replay";
export { startDryRace } from "./dry-race";

export type TxState =
  | "idle"
  | "signing"
  | "signed"
  | "waiting"
  | "racing"
  | "confirmed"
  | "error";

export type ChainRaceState = {
  chainId: number;
  name: string;
  state: TxState;
  hash?: Hash;
  receipt?: TransactionReceipt;
  startTime?: number;
  endTime?: number;
  elapsedMs?: number;
  feeDisplay?: string;
  feeToken?: string;
  error?: string;
};

type RaceParams = {
  recipient: `0x${string}`;
  amount: string;
  memo: string;
  tempoClient?: TempoWalletClient;
  enabledChains?: Set<number>;
  sponsored?: boolean;
  onUpdate: (chainId: number, state: Partial<ChainRaceState>) => void;
};

/** Creates a read-only viem client for waitForTransactionReceipt */
function getPublicClient(chainId: number) {
  const chainMap = {
    [mainnet.id]: mainnet,
    [base.id]: base,
    [tempo.id]: tempo,
  } as const;
  const chain = chainMap[chainId as keyof typeof chainMap];
  if (!chain) throw new Error("Unknown chain");
  return createPublicClient({
    chain,
    transport: transports[chainId as keyof typeof transports],
  });
}

/* eslint-disable no-console */
const LOG = "[race]";

/** Wait for one chain's receipt silently — returns result data */
async function waitForConfirmation(
  chainId: number,
  hash: Hash,
  broadcastTime: number,
  sponsored?: boolean
): Promise<ConfirmationResult> {
  const name = CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];

  try {
    // Can fail if: RPC is down, tx reverts, or receipt polling times out
    const publicClient = getPublicClient(chainId);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const endTime = performance.now();
    const feeWei = receipt.gasUsed * receipt.effectiveGasPrice;

    const feeFormatted = parseFloat(formatEther(feeWei)).toFixed(6);
    const feeDisplay =
      chainId === tempo.id
        ? sponsored
          ? `${feeFormatted} USDC (sponsored)`
          : `${feeFormatted} USDC`
        : `${feeFormatted} ETH`;
    const feeToken = chainId === tempo.id ? "USDC" : "ETH";

    return {
      chainId,
      name,
      hash,
      receipt,
      elapsedMs: endTime - broadcastTime,
      feeDisplay,
      feeToken,
      confirmed: true,
      sponsored,
    };
  } catch (err: unknown) {
    const endTime = performance.now();
    return {
      chainId,
      name,
      hash,
      elapsedMs: endTime - broadcastTime,
      feeDisplay: "",
      feeToken: "",
      error: err instanceof Error ? err.message : "Unknown error",
      confirmed: false,
    };
  }
}

/** Orchestrates: sign all → wait for confirmations → replay animation */
export async function startRace(
  params: RaceParams & { account: `0x${string}` }
): Promise<ChainRaceState[]> {
  const { recipient, amount, memo, onUpdate } = params;
  const amountParsed = parseUnits(amount, 6);

  const allChains = [mainnet.id, base.id, tempo.id] as const;
  const signOrder = allChains.filter(
    (id) => !params.enabledChains || params.enabledChains.has(id)
  );
  console.log(`${LOG} ======== RACE START ========`);
  console.log(`${LOG} recipient=${recipient.slice(0, 10)}... amount=${amount} sponsored=${!!params.sponsored}`);
  console.log(`${LOG} enabledChains=[${signOrder.map((id) => CHAIN_NAMES[id as keyof typeof CHAIN_NAMES]).join(", ")}]`);

  const hashes: Partial<Record<number, { hash: Hash; broadcastTime: number }>> =
    {};

  // PHASE 1: Sign each transaction sequentially
  console.log(`${LOG} PHASE 1: Signing ${signOrder.length} chains...`);
  for (const chainId of signOrder) {
    try {
      const hash = await signChain(
        chainId,
        recipient,
        amountParsed,
        memo,
        params.tempoClient,
        onUpdate,
        params.sponsored
      );
      const broadcastTime = performance.now();
      hashes[chainId] = { hash, broadcastTime };
    } catch (err: unknown) {
      const name = CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];
      onUpdate(chainId, {
        state: "error",
        error: err instanceof Error ? err.message : "Signing rejected",
      });
      for (const id of signOrder) {
        if (!hashes[id] && id !== chainId) {
          onUpdate(id, { state: "idle" });
        }
      }
      console.log(`${LOG} SIGNING FAILED chain=${name}: ${err instanceof Error ? err.message.slice(0, 100) : "Unknown"}`);
      throw new Error(
        `Signing failed on ${name}: ${err instanceof Error ? err.message : "Unknown"}`
      );
    }
  }
  console.log(`${LOG} PHASE 1 DONE: all ${signOrder.length} chains signed`);

  // PHASE 2: Wait for all confirmations silently
  console.log(`${LOG} PHASE 2: Waiting for confirmations...`);
  for (const chainId of signOrder) {
    onUpdate(chainId, { state: "waiting" });
  }

  // allSettled so one failure doesn't block others
  const confirmResults = await Promise.allSettled(
    signOrder.map((chainId) => {
      const { hash, broadcastTime } = hashes[chainId]!;
      const isSponsored = params.sponsored && chainId === tempo.id;
      return waitForConfirmation(chainId, hash, broadcastTime, isSponsored);
    })
  );

  const results = confirmResults.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : ({
          chainId: 0,
          name: "Unknown",
          hash: "0x" as Hash,
          elapsedMs: 0,
          feeDisplay: "",
          feeToken: "",
          error: r.reason?.message ?? "Unknown error",
          confirmed: false,
        } as ConfirmationResult)
  );

  for (const r of results) {
    if (r.confirmed) {
      console.log(`${LOG} CONFIRMED ${r.name}: ${r.elapsedMs.toFixed(0)}ms fee=${r.feeDisplay}`);
    } else {
      console.log(`${LOG} FAILED ${r.name}: ${r.error}`);
    }
  }

  // PHASE 3: Replay the race as animation
  console.log(`${LOG} PHASE 3: Replaying race animation...`);
  const finalStates = await replayRace(results, onUpdate);
  console.log(`${LOG} ======== RACE COMPLETE ========`);
  return finalStates;
}
/* eslint-enable no-console */
