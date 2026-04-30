import type { Hash } from "viem";
import { mainnet, base } from "wagmi/chains";
import { tempo, CHAIN_NAMES } from "./chains";
import type { ChainRaceState } from "./race-engine";
import { replayRace, type ConfirmationResult } from "./replay";

/* eslint-disable no-console */

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

type DryRaceParams = {
  recipient: string;
  amount: string;
  memo: string;
  onUpdate: (chainId: number, state: Partial<ChainRaceState>) => void;
  enabledChains?: Set<number>;
  sponsored?: boolean;
};

/** Mock race — simulates signing then replays with mock timing */
export async function startDryRace(
  params: DryRaceParams
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

  // Build mock results
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
/* eslint-enable no-console */
