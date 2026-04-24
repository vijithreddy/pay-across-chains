/**
 * Dual-wallet architecture eval
 *
 * Validates that the app correctly separates EVM (MetaMask) and Tempo wallet concerns:
 * 1. wagmi config has both MetaMask and tempoWallet connectors
 * 2. race-engine uses Actions.token.transfer for Tempo (not writeContract)
 * 3. race-engine uses writeContract for Eth/Base (not Actions.token.transfer)
 * 4. chains.ts has feeToken on Tempo chain
 * 5. funding-checklist accepts tempoAddress prop
 */
import { readFileSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "../src");

type Check = { name: string; pass: boolean; detail?: string };
const checks: Check[] = [];

// 1. wagmi config uses RainbowKit getDefaultConfig (handles MetaMask/WalletConnect)
const wagmiConfig = readFileSync(join(SRC, "lib/wagmi.ts"), "utf-8");
checks.push({
  name: "wagmi: uses RainbowKit getDefaultConfig",
  pass: wagmiConfig.includes("getDefaultConfig"),
});
// Tempo wallet is handled separately via accounts SDK, not in wagmi config
const providers = readFileSync(join(SRC, "components/providers.tsx"), "utf-8");
checks.push({
  name: "providers: wraps TempoProvider",
  pass: providers.includes("TempoProvider"),
});
checks.push({
  name: "providers: wraps RainbowKitProvider",
  pass: providers.includes("RainbowKitProvider"),
});

// 2. race-engine uses Actions.token.transfer for Tempo
const raceEngine = readFileSync(join(SRC, "lib/race-engine.ts"), "utf-8");
checks.push({
  name: "race-engine: imports Actions from viem/tempo",
  pass: raceEngine.includes('from "viem/tempo"') || raceEngine.includes("from 'viem/tempo'"),
});
checks.push({
  name: "race-engine: uses Actions.token.transfer for Tempo",
  pass: raceEngine.includes("Actions.token.transfer"),
});

// 3. race-engine uses writeContract for Eth/Base
checks.push({
  name: "race-engine: uses writeContract for EVM chains",
  pass: raceEngine.includes("writeContract"),
});

// 4. chains.ts has feeToken
const chains = readFileSync(join(SRC, "lib/chains.ts"), "utf-8");
checks.push({
  name: "chains: tempo has feeToken via extend()",
  pass: chains.includes("feeToken") && chains.includes(".extend("),
});

// 5. funding-checklist accepts tempoAddress
const fundingChecklist = readFileSync(join(SRC, "components/funding-checklist.tsx"), "utf-8");
checks.push({
  name: "funding-checklist: accepts tempoAddress prop",
  pass: fundingChecklist.includes("tempoAddress"),
});

// 6. tempo-provider.tsx has useTempoWallet hook
const tempoProvider = readFileSync(join(SRC, "components/tempo-provider.tsx"), "utf-8");
checks.push({
  name: "tempo-provider: exports useTempoWallet",
  pass: tempoProvider.includes("useTempoWallet"),
});
checks.push({
  name: "tempo-provider: uses Provider.create from accounts SDK",
  pass: tempoProvider.includes("Provider.create"),
});

// Report
const failed = checks.filter((c) => !c.pass);
if (failed.length > 0) {
  console.error("DUAL-WALLET EVAL FAILED:");
  for (const f of failed) {
    console.error(`  ✗ ${f.name}`);
  }
  process.exit(1);
} else {
  console.log("DUAL-WALLET EVAL PASSED:");
  for (const c of checks) {
    console.log(`  ✓ ${c.name}`);
  }
}
