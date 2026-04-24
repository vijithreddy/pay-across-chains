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

// Accepts any tempo-compatible wallet client — provider uses base tempo chain,
// we use extended chain (with feeToken), both are structurally compatible
type TempoWalletClient = WalletClient<Transport, Chain, Account>;

export type TxState =
  | "idle"
  | "signing"
  | "signed"
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
  onUpdate: (chainId: number, state: Partial<ChainRaceState>) => void;
};

/** Creates a read-only viem client for the given chain — used for waitForTransactionReceipt */
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

// Phase 1: Sign and broadcast each chain sequentially (wallet prompts one at a time)
async function signChain(
  chainId: SupportedChainId,
  recipient: `0x${string}`,
  amount: bigint,
  memo: string,
  tempoClient: TempoWalletClient | undefined,
  onUpdate: RaceParams["onUpdate"]
): Promise<{ hash: Hash; broadcastTime: number }> {
  onUpdate(chainId, { state: "signing" });

  if (chainId !== tempo.id) {
    // Switch MetaMask to the target chain (not needed for Tempo — separate wallet)
    try {
      // wagmi v2 types don't infer extended chain IDs from tempo.extend()
      await (switchChain as (...args: unknown[]) => Promise<unknown>)(config, {
        chainId,
      });
    } catch {
      // May throw if already on the correct chain, ignore
    }
  }

  let hash: Hash;

  if (chainId === tempo.id) {
    // Use the Tempo SDK's native token.transfer via the Tempo Wallet client
    // (separate from wagmi — Tempo Wallet handles type 0x76 signing)
    if (!tempoClient) throw new Error("Tempo Wallet not connected");
    // viem/tempo Actions type expects a broader Client type than our TempoWalletClient
    hash = await (
      Actions.token.transfer as (...args: unknown[]) => Promise<Hash>
    )(tempoClient, {
      to: recipient,
      amount,
      memo: Hex.fromString(memo),
      token: USDC_ADDRESSES[tempo.id],
    });
  } else {
    // wagmi v2 types don't infer extended chain IDs from tempo.extend()
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

  const broadcastTime = performance.now();
  onUpdate(chainId, { state: "signed", hash });
  return { hash, broadcastTime };
}

/**
 * Phase 2: Wait for tx confirmation and report timing.
 * visualStart = shared start for live timer animation (all runners begin at 0)
 * broadcastTime = when this chain's tx entered the mempool (for honest final time)
 */
async function raceConfirmation(
  chainId: number,
  hash: Hash,
  visualStart: number,
  broadcastTime: number,
  onUpdate: RaceParams["onUpdate"]
): Promise<ChainRaceState> {
  const name = CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];
  // Live timer ticks from visualStart so all 3 start at 0 simultaneously
  onUpdate(chainId, { state: "racing", startTime: visualStart });

  try {
    // Can fail if: RPC is down, tx reverts, or receipt polling times out
    const publicClient = getPublicClient(chainId);
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    const endTime = performance.now();
    const feeWei = receipt.gasUsed * receipt.effectiveGasPrice;

    let feeDisplay: string;
    let feeToken: string;
    if (chainId === tempo.id) {
      // Tempo fees are in USDC (6 decimals), gasPrice is in USDC-wei (18 decimals)
      feeDisplay = `${parseFloat(formatEther(feeWei)).toFixed(6)} USDC`;
      feeToken = "USDC";
    } else {
      feeDisplay = `${parseFloat(formatEther(feeWei)).toFixed(6)} ETH`;
      feeToken = "ETH";
    }

    // elapsedMs = real latency from broadcast (honest number for results table)
    // startTime = visual start (for live timer that ticks from 0)
    // endTime = when confirmed (freezes the live timer at the real elapsed value)
    const realElapsed = endTime - broadcastTime;
    const result: ChainRaceState = {
      chainId,
      name,
      state: "confirmed",
      hash,
      receipt,
      startTime: visualStart,
      endTime: visualStart + realElapsed, // freeze live timer at the real elapsed value
      elapsedMs: realElapsed,
      feeDisplay,
      feeToken,
    };
    onUpdate(chainId, result);
    return result;
  } catch (err: unknown) {
    const endTime = performance.now();
    const realElapsed = endTime - broadcastTime;
    const result: ChainRaceState = {
      chainId,
      name,
      state: "error",
      hash,
      startTime: visualStart,
      endTime: visualStart + realElapsed,
      elapsedMs: realElapsed,
      error: err instanceof Error ? err.message : "Unknown error",
    };
    onUpdate(chainId, result);
    return result;
  }
}

/** Orchestrates the full 3-chain race: sequential signing then parallel confirmation */
export async function startRace(
  params: RaceParams & { account: `0x${string}` }
): Promise<ChainRaceState[]> {
  const { recipient, amount, memo, onUpdate } = params;
  const amountParsed = parseUnits(amount, 6);

  // Sign slowest chain first so it gets the most mempool time
  // Ethereum (~12s blocks) → Base (~2s blocks) → Tempo (~500ms)
  const signOrder = [mainnet.id, base.id, tempo.id] as const;
  const signed: Partial<Record<number, { hash: Hash; broadcastTime: number }>> =
    {};

  // PHASE 1: Sign each transaction sequentially
  // User sees one wallet prompt at a time. Tx enters mempool on sign.
  for (const chainId of signOrder) {
    try {
      const result = await signChain(
        chainId,
        recipient,
        amountParsed,
        memo,
        params.tempoClient,
        onUpdate
      );
      signed[chainId] = result;
    } catch (err: unknown) {
      // User rejected or signing failed — abort entire race
      const name = CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];
      onUpdate(chainId, {
        state: "error",
        error: err instanceof Error ? err.message : "Signing rejected",
      });
      // Mark remaining chains as idle
      for (const id of signOrder) {
        if (!signed[id] && id !== chainId) {
          onUpdate(id, { state: "idle" });
        }
      }
      throw new Error(
        `Signing failed on ${name}: ${err instanceof Error ? err.message : "Unknown"}`
      );
    }
  }

  // PHASE 2: Race for confirmations
  // visualStart = shared moment when all 3 are signed (live timers all start at 0)
  // broadcastTime = per-chain (when tx entered mempool — for honest final elapsed time)
  // If a chain already confirmed during signing, waitForReceipt returns instantly
  // and the timer freezes at the real elapsed time from broadcast
  // allSettled (not all) so one chain failing doesn't kill the others' results
  const visualStart = performance.now();
  const results = await Promise.allSettled(
    signOrder.map((chainId) => {
      const { hash, broadcastTime } = signed[chainId]!;
      return raceConfirmation(chainId, hash, visualStart, broadcastTime, onUpdate);
    })
  );

  return results.map((r) =>
    r.status === "fulfilled"
      ? r.value
      : {
          chainId: 0,
          name: "Unknown",
          state: "error" as TxState,
          error: r.reason?.message ?? "Unknown error",
        }
  );
}

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

/** Mock race with simulated timing — no real transactions, logs what calls would look like */
export async function startDryRace(
  params: Pick<RaceParams, "recipient" | "amount" | "memo" | "onUpdate">
): Promise<ChainRaceState[]> {
  const { recipient, amount, memo, onUpdate } = params;
  const signOrder = [mainnet.id, base.id, tempo.id] as const;

  console.log("[dry-race] ============ DRY RACE START ============");
  console.log("[dry-race] Recipient:", recipient);
  console.log("[dry-race] Amount:", amount, "USDC");
  console.log("[dry-race] Memo:", memo);

  // PHASE 1: Simulate signing (500ms per chain)
  for (const chainId of signOrder) {
    const name = CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];
    onUpdate(chainId, { state: "signing" });
    console.log(
      `[dry-race] ${name}: signing... (would call ${chainId === tempo.id ? "Actions.token.transfer" : "writeContract"})`
    );

    if (chainId === tempo.id) {
      console.log(`[dry-race] ${name}: Actions.token.transfer(tempoClient, {`);
      console.log(`[dry-race]   to: "${recipient}",`);
      console.log(`[dry-race]   amount: parseUnits("${amount}", 6),`);
      console.log(`[dry-race]   memo: Hex.fromString("${memo}"),`);
      console.log(`[dry-race]   token: "${USDC_ADDRESSES[tempo.id]}",`);
      console.log(`[dry-race] })`);
    } else {
      console.log(`[dry-race] ${name}: writeContract(config, {`);
      console.log(`[dry-race]   chainId: ${chainId},`);
      console.log(
        `[dry-race]   address: "${USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES]}",`
      );
      console.log(`[dry-race]   abi: erc20Abi,`);
      console.log(`[dry-race]   functionName: "transfer",`);
      console.log(
        `[dry-race]   args: ["${recipient}", parseUnits("${amount}", 6)],`
      );
      console.log(`[dry-race] })`);
    }

    await new Promise((r) => setTimeout(r, 500));
    onUpdate(chainId, { state: "signed", hash: MOCK_HASHES[chainId] });
    console.log(
      `[dry-race] ${name}: signed -> hash ${MOCK_HASHES[chainId].slice(0, 10)}...`
    );
  }

  // PHASE 2: Simulate confirmations
  console.log("[dry-race] All signed. Starting race...");
  const raceStart = performance.now();

  const promises = signOrder.map((chainId) => {
    const name = CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];
    const delay = MOCK_TIMINGS[chainId];
    const fee = MOCK_FEES[chainId];
    const hash = MOCK_HASHES[chainId];

    onUpdate(chainId, { state: "racing", startTime: raceStart });

    return new Promise<ChainRaceState>((resolve) => {
      setTimeout(() => {
        const endTime = performance.now();
        console.log(`[dry-race] ${name}: confirmed in ${delay}ms (mock)`);
        const result: ChainRaceState = {
          chainId,
          name,
          state: "confirmed",
          hash,
          startTime: raceStart,
          endTime,
          elapsedMs: endTime - raceStart,
          feeDisplay: fee.display,
          feeToken: fee.token,
        };
        onUpdate(chainId, result);
        resolve(result);
      }, delay);
    });
  });

  const results = await Promise.all(promises);
  console.log("[dry-race] ============ DRY RACE COMPLETE ============");
  console.log("[dry-race] Results:");
  for (const r of results) {
    console.log(
      `[dry-race]   ${r.name}: ${(r.elapsedMs! / 1000).toFixed(2)}s | ${r.feeDisplay} | ${r.feeToken}`
    );
  }
  return results;
}
