/**
 * Dual-connection architecture eval
 *
 * Validates that EVM (MetaMask via RainbowKit/wagmi) and Tempo (accounts SDK)
 * wallet connections are fully independent — connecting one must NOT disconnect the other.
 *
 * Checks:
 * 1. Tempo provider does NOT use wagmi hooks or wagmi config
 * 2. Tempo provider does NOT call useConnect/useDisconnect from wagmi
 * 3. Tempo provider uses accounts SDK's Provider.create() directly
 * 4. wagmi config does NOT include tempoWallet connector
 * 5. Tempo provider does NOT announce via EIP-6963 (which wagmi would pick up)
 * 6. page.tsx reads EVM state from useAccount (wagmi) and Tempo state from useTempoWallet (context)
 * 7. race-engine accepts tempoClient as a parameter (not from wagmi)
 */
import { readFileSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "../src");

type Check = { name: string; pass: boolean; detail?: string };
const checks: Check[] = [];

// --- Tempo Provider checks ---
const tempoProvider = readFileSync(join(SRC, "components/tempo-provider.tsx"), "utf-8");

checks.push({
  name: "tempo-provider: uses Provider.create from accounts SDK",
  pass: tempoProvider.includes("Provider.create"),
});

checks.push({
  name: "tempo-provider: does NOT import from wagmi",
  pass: !tempoProvider.includes("from \"wagmi\"") && !tempoProvider.includes("from 'wagmi'"),
  detail: "Importing from wagmi would couple Tempo connection to wagmi state",
});

checks.push({
  name: "tempo-provider: does NOT import from @wagmi/core",
  pass: !tempoProvider.includes("@wagmi/core"),
});

checks.push({
  name: "tempo-provider: does NOT use useConnect/useDisconnect",
  pass: !tempoProvider.includes("useConnect") && !tempoProvider.includes("useDisconnect"),
});

checks.push({
  name: "tempo-provider: uses React context (not wagmi) for state",
  pass: tempoProvider.includes("createContext") && tempoProvider.includes("useContext"),
});

// --- wagmi config checks ---
const wagmiConfig = readFileSync(join(SRC, "lib/wagmi.ts"), "utf-8");

checks.push({
  name: "wagmi config: does NOT include tempoWallet connector",
  pass: !wagmiConfig.includes("tempoWallet"),
  detail: "tempoWallet in wagmi config would make wagmi manage the Tempo connection",
});

checks.push({
  name: "wagmi config: does NOT import from accounts SDK",
  pass: !wagmiConfig.includes("from \"accounts") && !wagmiConfig.includes("from 'accounts"),
});

checks.push({
  name: "wagmi config: multiInjectedProviderDiscovery is false",
  pass: wagmiConfig.includes("multiInjectedProviderDiscovery: false") ||
        wagmiConfig.includes("multiInjectedProviderDiscovery:false"),
  detail: "Must be false to prevent accounts SDK EIP-6963 announcement from hijacking wagmi connection",
});

// --- Page checks ---
const page = readFileSync(join(SRC, "app/page.tsx"), "utf-8");

checks.push({
  name: "page: reads EVM state from useAccount (wagmi)",
  pass: page.includes("useAccount"),
});

checks.push({
  name: "page: reads Tempo state from useTempoWallet (context)",
  pass: page.includes("useTempoWallet"),
});

// --- Race engine checks ---
const raceEngine = readFileSync(join(SRC, "lib/race-engine.ts"), "utf-8");

checks.push({
  name: "race-engine: accepts tempoClient as parameter",
  pass: raceEngine.includes("tempoClient"),
});

checks.push({
  name: "race-engine: does NOT use getWalletClient for Tempo",
  pass: !raceEngine.includes("getWalletClient"),
  detail: "getWalletClient goes through wagmi which would use MetaMask, not Tempo Wallet",
});

// --- Wallet connector checks ---
checks.push({
  name: "wagmi config: uses RainbowKit metaMaskWallet (not raw injected)",
  pass: wagmiConfig.includes("metaMaskWallet") && !wagmiConfig.includes("from \"wagmi/connectors\""),
  detail: "Raw injected() causes infinite connect-event loops with multiple extensions",
});

checks.push({
  name: "wagmi config: uses RainbowKit phantomWallet",
  pass: wagmiConfig.includes("phantomWallet"),
  detail: "Phantom must be a named wallet option via RainbowKit",
});

checks.push({
  name: "wagmi config: does NOT import injected from wagmi/connectors",
  pass: !wagmiConfig.includes("from \"wagmi/connectors\"") &&
        !wagmiConfig.includes("from 'wagmi/connectors'"),
  detail: "Raw injected() causes infinite connect loops — use RainbowKit wallet connectors",
});

// --- Chain switching (in sign-chain.ts or race-engine.ts) ---
const signChainFile = readFileSync(join(SRC, "lib/sign-chain.ts"), "utf-8");

checks.push({
  name: "sign-chain: uses switchChain before writeContract",
  pass: signChainFile.includes("switchChain"),
  detail: "switchChain required so wallet provider simulates on correct chain",
});

// --- Signing failure handling ---
const raceForm = readFileSync(join(SRC, "components/race-form.tsx"), "utf-8");

checks.push({
  name: "race-form: handles signing error with raceError state",
  pass: raceForm.includes("raceError"),
  detail: "On signing failure, must show error — not blank screen",
});

// --- feePayer safety ---
checks.push({
  name: "tempo-provider: feePayer is disabled (commented out)",
  pass: !tempoProvider.match(/^\s*feePayer:/m) || tempoProvider.includes("// feePayer"),
  detail: "feePayer must be disabled until sponsored fees are fixed — breaks preview deploys",
});

// --- Providers wrapper checks ---
const providers = readFileSync(join(SRC, "components/providers.tsx"), "utf-8");

checks.push({
  name: "providers: TempoProvider is inside WagmiProvider (sibling, not replacing)",
  pass: providers.includes("WagmiProvider") && providers.includes("TempoProvider"),
});

checks.push({
  name: "providers: RainbowKitProvider present for standard wallet UI",
  pass: providers.includes("RainbowKitProvider"),
});

// Report
const failed = checks.filter((c) => !c.pass);
if (failed.length > 0) {
  console.error("DUAL-CONNECTION EVAL FAILED:");
  for (const f of failed) {
    console.error(`  ✗ ${f.name}`);
    if (f.detail) console.error(`    → ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log("DUAL-CONNECTION EVAL PASSED:");
  for (const c of checks) {
    console.log(`  ✓ ${c.name}`);
  }
}
