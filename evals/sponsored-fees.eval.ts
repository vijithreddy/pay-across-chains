/**
 * Sponsored Fees eval
 *
 * Validates the Provider-level fee sponsorship flow:
 * 1. Provider.create configured with feePayer relay URL
 * 2. Race engine passes feePayer: true for sponsored Tempo txs
 * 3. Relay API handles co-signing + broadcasting
 * 4. UI has sponsor toggle
 * 5. Security: private key only in server routes
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "../src");

type Check = { name: string; pass: boolean; detail?: string };
const checks: Check[] = [];

// --- File existence ---
checks.push({
  name: "file: api/relay/route.ts exists",
  pass: existsSync(join(SRC, "app/api/relay/route.ts")),
});

checks.push({
  name: "file: components/sponsor-toggle.tsx exists",
  pass: existsSync(join(SRC, "components/sponsor-toggle.tsx")),
});

// --- Tempo Provider ---
const tempoProvider = readFileSync(
  join(SRC, "components/tempo-provider.tsx"),
  "utf-8"
);

checks.push({
  name: "tempo-provider: configures feePayer on Provider.create",
  pass:
    tempoProvider.includes("feePayer") &&
    tempoProvider.includes("/api/relay"),
  detail:
    "Provider.create({ feePayer: '/api/relay' }) routes sponsored txs to relay",
});

// --- Relay route ---
const relayRoute = readFileSync(
  join(SRC, "app/api/relay/route.ts"),
  "utf-8"
);

checks.push({
  name: "relay: uses TxEnvelopeTempo for co-signing",
  pass:
    relayRoute.includes("TxEnvelopeTempo.from") &&
    relayRoute.includes("getFeePayerSignPayload") &&
    relayRoute.includes("TxEnvelopeTempo.serialize"),
});

checks.push({
  name: "relay: signs with Secp256k1.sign",
  pass: relayRoute.includes("Secp256k1.sign"),
});

checks.push({
  name: "relay: handles eth_signRawTransaction (sign-only policy)",
  pass: relayRoute.includes("eth_signRawTransaction"),
  detail: "Provider's default policy: relay signs, client broadcasts",
});

checks.push({
  name: "relay: handles eth_sendRawTransaction (sign-and-broadcast)",
  pass: relayRoute.includes("eth_sendRawTransaction"),
});

checks.push({
  name: "relay: handles eth_fillTransaction (gas estimation proxy)",
  pass: relayRoute.includes("eth_fillTransaction"),
});

checks.push({
  name: "relay: reads FEE_PAYER_PRIVATE_KEY from env (not NEXT_PUBLIC_)",
  pass:
    relayRoute.includes("FEE_PAYER_PRIVATE_KEY") &&
    !relayRoute.includes("NEXT_PUBLIC_FEE_PAYER"),
});

checks.push({
  name: "relay: supports same-origin auth (for Provider transport)",
  pass: relayRoute.includes("origin") || relayRoute.includes("Origin"),
  detail: "Provider feePayer transport uses http() without auth headers",
});

checks.push({
  name: "relay: returns 401 for unauthorized requests",
  pass: relayRoute.includes("401"),
});

// --- Race engine ---
const raceEngine = readFileSync(join(SRC, "lib/race-engine.ts"), "utf-8");

checks.push({
  name: "race-engine: accepts sponsored param",
  pass: raceEngine.includes("sponsored"),
});

checks.push({
  name: "race-engine: passes feePayer: true when sponsored",
  pass: raceEngine.includes("feePayer: true"),
  detail: "feePayer: true triggers Provider's relay routing",
});

checks.push({
  name: "race-engine: does NOT fetch /api/relay directly",
  pass: !raceEngine.includes('fetch("/api/relay"'),
  detail: "Provider handles relay routing — no manual fetch needed",
});

checks.push({
  name: "race-engine: shows (sponsored) in fee display",
  pass: raceEngine.includes("(sponsored)"),
});

// --- Sponsor toggle component ---
const sponsorToggle = readFileSync(
  join(SRC, "components/sponsor-toggle.tsx"),
  "utf-8"
);

checks.push({
  name: "sponsor-toggle: has Self-pay option",
  pass: sponsorToggle.includes("Self-pay"),
});

checks.push({
  name: "sponsor-toggle: has Sponsored option",
  pass: sponsorToggle.includes("Sponsored"),
});

checks.push({
  name: "sponsor-toggle: no password input (Provider handles auth)",
  pass: !sponsorToggle.includes('type="password"'),
  detail: "Provider-level feePayer uses same-origin auth, no password needed",
});

// --- Race form integration ---
const raceForm = readFileSync(
  join(SRC, "components/race-form.tsx"),
  "utf-8"
);

checks.push({
  name: "race-form: imports SponsorToggle",
  pass: raceForm.includes("SponsorToggle"),
});

checks.push({
  name: "race-form: passes sponsored to startRace",
  pass: raceForm.includes("sponsored"),
});

checks.push({
  name: "race-form: no relayPassword (Provider handles relay routing)",
  pass: !raceForm.includes("relayPassword"),
  detail: "Provider-level feePayer removes need for manual relay password",
});

// --- env.example ---
const envExample = readFileSync(
  join(__dirname, "../env.example"),
  "utf-8"
);

checks.push({
  name: "env.example: documents FEE_PAYER_PRIVATE_KEY",
  pass: envExample.includes("FEE_PAYER_PRIVATE_KEY"),
});

// Report
const failed = checks.filter((c) => !c.pass);
if (failed.length > 0) {
  console.error("SPONSORED-FEES EVAL FAILED:");
  for (const f of failed) {
    console.error(`  \u2717 ${f.name}`);
    if (f.detail) console.error(`    \u2192 ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log(`SPONSORED-FEES EVAL PASSED (${checks.length} checks):`);
  for (const c of checks) {
    console.log(`  \u2713 ${c.name}`);
  }
}
