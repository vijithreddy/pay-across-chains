import {
  createPublicClient,
  parseUnits,
  formatEther,
  type Hash,
  type TransactionReceipt,
  type WalletClient,
  type Transport,
  type Account,
} from "viem";
import { writeContract, switchChain } from "@wagmi/core";
import { mainnet, base } from "wagmi/chains";
import { Actions } from "viem/tempo";
import { Hex } from "ox";
import { tempo, USDC_ADDRESSES, transports, CHAIN_NAMES } from "./chains";
import { erc20Abi } from "./abi";
import { config } from "./wagmi";

type SupportedChainId = typeof mainnet.id | typeof base.id | typeof tempo.id;
import type { Chain } from "viem";

// Accepts any tempo-compatible wallet client
type TempoWalletClient = WalletClient<Transport, Chain, Account>;

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

/** Phase 1: Sign and broadcast one chain — returns hash */
async function signChain(
  chainId: SupportedChainId,
  recipient: `0x${string}`,
  amount: bigint,
  memo: string,
  tempoClient: TempoWalletClient | undefined,
  onUpdate: RaceParams["onUpdate"],
  sponsored?: boolean
): Promise<Hash> {
  const chain = CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];
  console.log(`${LOG} signChain START chain=${chain} (${chainId}) sponsored=${!!sponsored}`);
  onUpdate(chainId, { state: "signing" });

  if (chainId !== tempo.id) {
    console.log(`${LOG} switchChain → ${chain}`);
    try {
      // wagmi v2 types don't infer extended chain IDs from tempo.extend()
      await (switchChain as (...args: unknown[]) => Promise<unknown>)(config, {
        chainId,
      });
      console.log(`${LOG} switchChain → ${chain} OK`);
    } catch {
      console.log(`${LOG} switchChain → ${chain} skipped (already on chain)`);
    }
  }

  let hash: Hash;

  if (chainId === tempo.id) {
    if (!tempoClient) throw new Error("Tempo Wallet not connected");
    // viem/tempo Actions type expects a broader Client type.
    // When sponsored, feePayer: true tells the Provider to route through
    // the relay configured in Provider.create({ feePayer: '/api/relay' }).
    // The relay co-signs and the Provider broadcasts the fully-signed tx.
    hash = await (
      Actions.token.transfer as (...args: unknown[]) => Promise<Hash>
    )(tempoClient, {
      to: recipient,
      amount,
      memo: Hex.fromString(memo),
      token: USDC_ADDRESSES[tempo.id],
      ...(sponsored ? { feePayer: true } : {}),
    });
  } else {
    // wagmi v2 types don't infer extended chain IDs
    hash = await (writeContract as (...args: unknown[]) => Promise<Hash>)(
      config,
      {
        chainId,
        address: USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES],
        abi: erc20Abi,
        functionName: "transfer",
        args: [recipient, amount],
      }
    );
  }

  console.log(`${LOG} signChain DONE chain=${chain} hash=${hash.slice(0, 14)}...`);
  onUpdate(chainId, { state: "signed", hash });
  return hash;
}

/** Collected result from waiting for confirmation — not yet displayed */
type ConfirmationResult = {
  chainId: number;
  name: string;
  hash: Hash;
  receipt?: TransactionReceipt;
  elapsedMs: number;
  feeDisplay: string;
  feeToken: string;
  error?: string;
  confirmed: boolean;
  sponsored?: boolean;
};

/** Phase 2: Wait for one chain's confirmation silently — returns result data */
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
    // Sponsored Tempo txs: fee still shows in receipt but relay paid it
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

/** Phase 3: Replay the race as a timed animation using known results */
function replayRace(
  results: ConfirmationResult[],
  onUpdate: RaceParams["onUpdate"]
): Promise<ChainRaceState[]> {
  return new Promise((resolve) => {
    const replayStart = performance.now();

    // Find the slowest confirmed chain to scale the replay
    const maxElapsed = Math.max(...results.map((r) => r.elapsedMs));
    // Replay duration: cap at 10s so Ethereum's 45s doesn't make users wait
    const REPLAY_DURATION_MS = Math.min(maxElapsed, 10000);

    // Start all runners
    for (const r of results) {
      onUpdate(r.chainId, { state: "racing", startTime: replayStart });
    }

    // Schedule each chain's finish at proportional time
    const finalStates: ChainRaceState[] = [];
    let resolved = 0;

    for (const r of results) {
      // Scale the real elapsed time to fit within replay duration
      const replayDelay = (r.elapsedMs / maxElapsed) * REPLAY_DURATION_MS;

      setTimeout(() => {
        const now = performance.now();
        const state: ChainRaceState = {
          chainId: r.chainId,
          name: r.name,
          state: r.confirmed ? "confirmed" : "error",
          hash: r.hash,
          receipt: r.receipt,
          startTime: replayStart,
          endTime: now,
          elapsedMs: r.elapsedMs, // real elapsed time from broadcast
          feeDisplay: r.feeDisplay,
          feeToken: r.feeToken,
          error: r.error,
        };
        onUpdate(r.chainId, state);
        finalStates.push(state);

        resolved++;
        if (resolved === results.length) {
          resolve(finalStates);
        }
      }, replayDelay);
    }
  });
}

/** Orchestrates: sign all 3 → wait for all confirmations → replay animation */
export async function startRace(
  params: RaceParams & { account: `0x${string}` }
): Promise<ChainRaceState[]> {
  const { recipient, amount, memo, onUpdate } = params;
  const amountParsed = parseUnits(amount, 6);

  // Only race enabled chains — disabled ones are skipped entirely
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

  // PHASE 2: Wait for all 3 confirmations silently
  // Show "waiting" state while confirmations come in
  console.log(`${LOG} PHASE 2: Waiting for confirmations...`);
  for (const chainId of signOrder) {
    onUpdate(chainId, { state: "waiting" });
  }

  // allSettled so one failure doesn't block others
  const confirmResults = await Promise.allSettled(
    signOrder.map((chainId) => {
      const { hash, broadcastTime } = hashes[chainId]!;
      // Only Tempo can be sponsored — Eth/Base always self-pay
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

  // Log confirmation results
  for (const r of results) {
    if (r.confirmed) {
      console.log(`${LOG} CONFIRMED ${r.name}: ${r.elapsedMs.toFixed(0)}ms fee=${r.feeDisplay}`);
    } else {
      console.log(`${LOG} FAILED ${r.name}: ${r.error}`);
    }
  }

  // PHASE 3: Replay the race as animation with proportional timing
  console.log(`${LOG} PHASE 3: Replaying race animation...`);
  const finalStates = await replayRace(results, onUpdate);
  console.log(`${LOG} ======== RACE COMPLETE ========`);
  return finalStates;
}
/* eslint-enable no-console */

// ============================================
// DRY RACE — mock timing, no real transactions
// ============================================

const MOCK_TIMINGS: Record<number, number> = {
  [mainnet.id]: 44000,
  [base.id]: 2800,
  [tempo.id]: 480,
};

const MOCK_FEES: Record<number, { display: string; token: string }> = {
  [mainnet.id]: { display: "0.000118 ETH", token: "ETH" },
  [base.id]: { display: "0.000001 ETH", token: "ETH" },
  [tempo.id]: { display: "0.001026 USDC", token: "USDC" },
};

const MOCK_HASHES: Record<number, Hash> = {
  [mainnet.id]:
    "0xaaa1111111111111111111111111111111111111111111111111111111111111" as Hash,
  [base.id]:
    "0xbbb2222222222222222222222222222222222222222222222222222222222222" as Hash,
  [tempo.id]:
    "0xccc3333333333333333333333333333333333333333333333333333333333333" as Hash,
};

const MOCK_SIGN_DELAY_MS = 500;

/** Mock race — simulates signing then replays with mock timing */
export async function startDryRace(
  params: Pick<RaceParams, "recipient" | "amount" | "memo" | "onUpdate" | "enabledChains" | "sponsored">
): Promise<ChainRaceState[]> {
  const { recipient, amount, memo, onUpdate } = params;
  const allChains = [mainnet.id, base.id, tempo.id] as const;
  const signOrder = allChains.filter(
    (id) => !params.enabledChains || params.enabledChains.has(id)
  );

  console.log("[dry-race] ============ DRY RACE START ============");
  console.log("[dry-race] Recipient:", recipient);
  console.log("[dry-race] Amount:", amount, "USDC");
  console.log("[dry-race] Memo:", memo);

  // Simulate signing
  for (const chainId of signOrder) {
    const name = CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];
    onUpdate(chainId, { state: "signing" });
    console.log(`[dry-race] ${name}: signing...`);
    await new Promise((r) => setTimeout(r, MOCK_SIGN_DELAY_MS));
    onUpdate(chainId, { state: "signed", hash: MOCK_HASHES[chainId] });
  }

  // Simulate waiting
  for (const chainId of signOrder) {
    onUpdate(chainId, { state: "waiting" });
  }
  console.log("[dry-race] All signed. Collecting confirmations...");
  await new Promise((r) => setTimeout(r, 1000));

  // Build mock results — sponsored Tempo shows "(sponsored)" suffix
  const mockResults: ConfirmationResult[] = signOrder.map((chainId) => {
    const isSponsored = params.sponsored && chainId === tempo.id;
    return {
      chainId,
      name: CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES],
      hash: MOCK_HASHES[chainId],
      elapsedMs: MOCK_TIMINGS[chainId],
      feeDisplay: isSponsored
        ? `${MOCK_FEES[chainId].display} (sponsored)`
        : MOCK_FEES[chainId].display,
      feeToken: MOCK_FEES[chainId].token,
      confirmed: true,
      sponsored: isSponsored,
    };
  });

  // Replay animation
  console.log("[dry-race] Replaying race...");
  const finalStates = await replayRace(mockResults, onUpdate);

  console.log("[dry-race] ============ DRY RACE COMPLETE ============");
  for (const r of finalStates) {
    console.log(
      `[dry-race]   ${r.name}: ${(r.elapsedMs! / 1000).toFixed(2)}s | ${r.feeDisplay}`
    );
  }
  return finalStates;
}
