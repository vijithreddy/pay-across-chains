/**
 * Regression eval — locks down all working functionality.
 * Run this before any new feature to ensure nothing breaks.
 *
 * Covers: architecture, signing, hydration, build, and race logic.
 */
import { readFileSync, existsSync } from "fs";
import { execSync } from "child_process";
import { join } from "path";

const ROOT = join(__dirname, "..");
const SRC = join(ROOT, "src");

type Check = { name: string; pass: boolean; detail?: string };
const checks: Check[] = [];

function read(relPath: string): string {
  return readFileSync(join(SRC, relPath), "utf-8");
}

// =====================================================
// 1. ARCHITECTURE — dual wallet, no cross-contamination
// =====================================================
const wagmi = read("lib/wagmi.ts");
const providers = read("components/providers.tsx");
const tempoProvider = read("components/tempo-provider.tsx");
const raceEngine = read("lib/race-engine.ts");
const raceForm = read("components/race-form.tsx");
const page = read("app/page.tsx");
const chains = read("lib/chains.ts");
const fundingChecklist = read("components/funding-checklist.tsx");
const tempoConnect = read("components/tempo-connect.tsx");

// wagmi config
checks.push({ name: "arch: wagmi uses RainbowKit connectorsForWallets", pass: wagmi.includes("connectorsForWallets") });
checks.push({ name: "arch: wagmi has multiInjectedProviderDiscovery false", pass: wagmi.includes("multiInjectedProviderDiscovery: false") });
checks.push({ name: "arch: wagmi does NOT import accounts SDK", pass: !wagmi.includes("from \"accounts") && !wagmi.includes("from 'accounts") });

// providers
checks.push({ name: "arch: providers wraps WagmiProvider", pass: providers.includes("WagmiProvider") });
checks.push({ name: "arch: providers wraps RainbowKitProvider", pass: providers.includes("RainbowKitProvider") });
checks.push({ name: "arch: providers wraps TempoProvider", pass: providers.includes("TempoProvider") });

// tempo provider isolation
checks.push({ name: "arch: tempo-provider does NOT import wagmi", pass: !tempoProvider.includes("from \"wagmi\"") && !tempoProvider.includes("from 'wagmi'") });
checks.push({ name: "arch: tempo-provider uses React context", pass: tempoProvider.includes("createContext") });
checks.push({ name: "arch: tempo-provider uses Provider.create from accounts SDK", pass: tempoProvider.includes("Provider.create") });

// chains
checks.push({ name: "arch: tempo chain has feeToken via extend()", pass: chains.includes("feeToken") && chains.includes(".extend(") });

// =====================================================
// 2. SIGNING — all 3 chains can sign transactions
// =====================================================
checks.push({ name: "sign: tempo-provider uses createWalletClient", pass: tempoProvider.includes("createWalletClient") });
checks.push({ name: "sign: tempo-provider uses JSON-RPC account (addr, not signable)", pass: tempoProvider.includes("account: addr") && !tempoProvider.includes("signable: true") });
checks.push({ name: "sign: tempo-provider uses custom(provider) transport", pass: tempoProvider.includes("custom(provider)") });
checks.push({ name: "sign: tempo-provider uses dialog adapter with iframe", pass: tempoProvider.includes("Dialog.iframe()") && tempoProvider.includes("dialog(") });
checks.push({ name: "sign: race-engine uses Actions.token.transfer for Tempo", pass: raceEngine.includes("Actions.token.transfer") });
checks.push({ name: "sign: race-engine uses writeContract for Eth/Base", pass: raceEngine.includes("writeContract(config") });
checks.push({ name: "sign: race-engine checks tempoClient before Tempo sign", pass: raceEngine.includes("Tempo Wallet not connected") });
checks.push({ name: "sign: race-form passes tempoClient to startRace", pass: raceForm.includes("tempoClient") && raceForm.includes("startRace") });
checks.push({ name: "sign: race-form guards start without tempoClient", pass: raceForm.includes("!tempoClient") || raceForm.includes("!tempoAddress") });

// =====================================================
// 3. RACE TIMING — per-chain broadcast times
// =====================================================
checks.push({ name: "timing: signChain returns broadcastTime", pass: raceEngine.includes("broadcastTime") && raceEngine.includes("performance.now()") });
checks.push({ name: "timing: raceConfirmation uses per-chain startTime", pass: raceEngine.includes("broadcastTime") });

// =====================================================
// 4. HYDRATION — mounted guards on all wagmi-hook components
// =====================================================
// Only components using WAGMI hooks (useAccount, useConnectors, useConnections) need mount guards.
// useTempoWallet is pure React context — no SSR mismatch risk.
const hydrationFiles: [string, string][] = [
  ["components/funding-checklist.tsx", fundingChecklist],
  ["app/page.tsx", page],
];
for (const [name, content] of hydrationFiles) {
  const needsGuard = content.includes("useAccount") || content.includes("useConnectors") || content.includes("useConnections");
  if (needsGuard) {
    checks.push({ name: `hydration: ${name} has mounted guard`, pass: content.includes("mounted") || content.includes("setMounted") });
  }
}

// =====================================================
// 5. FUNDING — checks correct addresses per chain
// =====================================================
checks.push({ name: "funding: checklist accepts tempoAddress prop", pass: fundingChecklist.includes("tempoAddress") });
checks.push({ name: "funding: page passes tempoAddress to FundingChecklist", pass: page.includes("tempoAddress={tempoAddress}") || page.includes("tempoAddress=") });

// =====================================================
// 5b. BALANCE DISPLAY — handles loading, error, and data states
// =====================================================
checks.push({
  name: "funding: handles isError state",
  pass: fundingChecklist.includes("isError") || fundingChecklist.includes("error"),
  detail: "Must show error state when RPC fails, not blank",
});
checks.push({
  name: "funding: handles isFetching in loading state",
  pass: fundingChecklist.includes("isFetching"),
  detail: "isLoading alone misses refetch states",
});

// =====================================================
// 6. UI — both connect buttons present
// =====================================================
checks.push({ name: "ui: page uses RainbowKit ConnectButton", pass: page.includes("ConnectButton") });
checks.push({ name: "ui: page renders TempoConnect component", pass: page.includes("<TempoConnect") });
checks.push({ name: "ui: tempo-connect uses useTempoWallet", pass: tempoConnect.includes("useTempoWallet") });

// =====================================================
// 7. FILES EXIST
// =====================================================
const requiredFiles = [
  "lib/wagmi.ts", "lib/chains.ts", "lib/abi.ts", "lib/race-engine.ts",
  "components/providers.tsx", "components/tempo-provider.tsx", "components/tempo-connect.tsx",
  "components/funding-checklist.tsx", "components/race-form.tsx", "components/race-track.tsx",
  "components/results-table.tsx", "components/migration-cards.tsx",
  "app/page.tsx", "app/layout.tsx",
];
for (const f of requiredFiles) {
  checks.push({ name: `file: ${f} exists`, pass: existsSync(join(SRC, f)) });
}

// =====================================================
// 8. BUILD
// =====================================================
try {
  execSync("npx tsc --noEmit", { cwd: ROOT, stdio: "pipe" });
  checks.push({ name: "build: TypeScript passes", pass: true });
} catch (err: any) {
  checks.push({ name: "build: TypeScript passes", pass: false, detail: err.stdout?.toString()?.slice(0, 200) });
}

// =====================================================
// REPORT
// =====================================================
const failed = checks.filter((c) => !c.pass);
console.log(`\nREGRESSION EVAL: ${checks.length - failed.length}/${checks.length} passed\n`);

for (const c of checks) {
  console.log(`  ${c.pass ? "✓" : "✗"} ${c.name}`);
  if (!c.pass && c.detail) console.log(`    → ${c.detail}`);
}

if (failed.length > 0) {
  console.log(`\n${failed.length} FAILED`);
  process.exit(1);
} else {
  console.log("\nALL PASSED");
}
