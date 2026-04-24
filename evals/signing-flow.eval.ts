/**
 * Signing flow eval
 *
 * Validates that all 3 chains can receive signatures:
 * 1. Eth/Base: signed via wagmi writeContract (MetaMask)
 * 2. Tempo: signed via Actions.token.transfer with a WalletClient (Tempo Wallet)
 *
 * Key checks:
 * - tempoClient is a WalletClient created with address (JSON-RPC account), NOT getAccount({ signable: true })
 * - TempoProvider builds WalletClient using createWalletClient + custom(provider) transport
 * - Dialog-based signing: provider handles signing via Tempo Wallet dialog, app never has private key
 * - race-engine passes tempoClient to signChain for Tempo
 * - race-engine checks tempoClient is defined before Tempo signing
 * - race-form guards against starting race without tempoClient
 * - race-form passes tempoClient from useTempoWallet context
 */
import { readFileSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "../src");

type Check = { name: string; pass: boolean; detail?: string };
const checks: Check[] = [];

// --- TempoProvider: must create a WalletClient with account ---
const tempoProvider = readFileSync(
  join(SRC, "components/tempo-provider.tsx"),
  "utf-8"
);

checks.push({
  name: "tempo-provider: uses createWalletClient (not createClient)",
  pass: tempoProvider.includes("createWalletClient"),
  detail:
    "createClient returns a read-only client; createWalletClient can sign",
});

checks.push({
  name: "tempo-provider: uses address as JSON-RPC account (NOT getAccount signable)",
  pass:
    !tempoProvider.includes("signable: true") &&
    tempoProvider.includes("account: addr"),
  detail:
    "Dialog-based wallets sign via provider, not locally. getAccount({ signable: true }) throws for passkey accounts.",
});

checks.push({
  name: "tempo-provider: uses custom(provider) transport",
  pass: tempoProvider.includes("custom(provider)"),
  detail:
    "custom() transport routes signing through the accounts SDK provider → Tempo Wallet dialog",
});

// --- Race engine: Tempo signing ---
const raceEngine = readFileSync(join(SRC, "lib/race-engine.ts"), "utf-8");

checks.push({
  name: "race-engine: checks tempoClient is defined before Tempo sign",
  pass: raceEngine.includes('throw new Error("Tempo Wallet not connected")'),
  detail: "Must fail loudly if Tempo client is missing, not silently skip",
});

checks.push({
  name: "race-engine: passes tempoClient to signChain",
  pass: raceEngine.includes("params.tempoClient"),
});

checks.push({
  name: "race-engine: uses Actions.token.transfer for Tempo (not writeContract)",
  pass:
    raceEngine.includes("Actions.token.transfer(tempoClient") ||
    raceEngine.includes("Actions.token.transfer(tempoClient as any"),
});

checks.push({
  name: "race-engine: uses writeContract for Eth/Base",
  pass: raceEngine.includes("writeContract(config"),
});

// --- Race form: passes tempoClient ---
const raceForm = readFileSync(
  join(SRC, "components/race-form.tsx"),
  "utf-8"
);

checks.push({
  name: "race-form: reads tempoClient from useTempoWallet",
  pass:
    raceForm.includes("useTempoWallet") &&
    raceForm.includes("tempoClient"),
});

checks.push({
  name: "race-form: passes tempoClient to startRace",
  pass: raceForm.includes("tempoClient,") || raceForm.includes("tempoClient\n"),
});

checks.push({
  name: "race-form: guards against starting race without tempoClient",
  pass: raceForm.includes("!tempoClient") || raceForm.includes("!tempoAddress"),
  detail: "Must prevent race start if Tempo Wallet not connected",
});

// Report
const failed = checks.filter((c) => !c.pass);
if (failed.length > 0) {
  console.error("SIGNING-FLOW EVAL FAILED:");
  for (const f of failed) {
    console.error(`  ✗ ${f.name}`);
    if (f.detail) console.error(`    → ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log("SIGNING-FLOW EVAL PASSED:");
  for (const c of checks) {
    console.log(`  ✓ ${c.name}`);
  }
}
