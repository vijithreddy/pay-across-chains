import type { Hash, TransactionReceipt } from "viem";
import type { ChainRaceState } from "./race-engine";

/** Collected result from waiting for confirmation — not yet displayed */
export type ConfirmationResult = {
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

/** Replay the race as a timed animation using known results */
export function replayRace(
  results: ConfirmationResult[],
  onUpdate: (chainId: number, state: Partial<ChainRaceState>) => void
): Promise<ChainRaceState[]> {
  return new Promise((resolve) => {
    const replayStart = performance.now();

    // Find the slowest confirmed chain to scale the replay
    const maxElapsed = Math.max(...results.map((r) => r.elapsedMs));
    // Cap at 10s so Ethereum's 45s doesn't bore users
    const REPLAY_DURATION_MS = Math.min(maxElapsed, 10000);

    // Start all runners
    for (const r of results) {
      onUpdate(r.chainId, { state: "racing", startTime: replayStart });
    }

    // Schedule each chain's finish at proportional time
    const finalStates: ChainRaceState[] = [];
    let resolved = 0;

    for (const r of results) {
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
          elapsedMs: r.elapsedMs, // real elapsed, not replay time
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
