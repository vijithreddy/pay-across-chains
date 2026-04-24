/**
 * Sponsored Fees eval
 *
 * Validates the relay-based fee sponsorship flow:
 * 1. Relay API route handles co-signing + broadcasting
 * 2. Relay transport routes JSON-RPC to /api/relay with auth
 * 3. Race engine supports feePayer: true for sponsored Tempo txs
 * 4. UI has sponsor toggle + password input
 * 5. Security: private key only in server routes, password via Bearer token
 */
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const SRC = join(__dirname, "../src");

type Check = { name: string; pass: boolean; detail?: string };
const checks: Check[] = [];

// --- File existence ---
const relayRoutePath = join(SRC, "app/api/relay/route.ts");
const relayTransportPath = join(SRC, "lib/relay-transport.ts");
const sponsorTogglePath = join(SRC, "components/sponsor-toggle.tsx");

checks.push({
  name: "file: api/relay/route.ts exists",
  pass: existsSync(relayRoutePath),
});

checks.push({
  name: "file: lib/relay-transport.ts exists",
  pass: existsSync(relayTransportPath),
});

checks.push({
  name: "file: components/sponsor-toggle.tsx exists",
  pass: existsSync(sponsorTogglePath),
});

// --- Relay route ---
const relayRoute = readFileSync(relayRoutePath, "utf-8");

checks.push({
  name: "relay: uses TxEnvelopeTempo.from to deserialize",
  pass: relayRoute.includes("TxEnvelopeTempo.from"),
  detail: "Must deserialize the half-signed tx to extract sender",
});

checks.push({
  name: "relay: computes getFeePayerSignPayload",
  pass: relayRoute.includes("getFeePayerSignPayload"),
  detail: "Must compute the fee payer signing payload bound to sender",
});

checks.push({
  name: "relay: signs with Secp256k1.sign",
  pass: relayRoute.includes("Secp256k1.sign"),
  detail: "Must co-sign with the relay's private key",
});

checks.push({
  name: "relay: re-serializes with feePayerSignature",
  pass: relayRoute.includes("TxEnvelopeTempo.serialize"),
  detail: "Must re-serialize with both sender + fee payer signatures",
});

checks.push({
  name: "relay: broadcasts via eth_sendRawTransaction",
  pass: relayRoute.includes("eth_sendRawTransaction"),
  detail: "Must broadcast the fully-signed tx to Tempo RPC",
});

checks.push({
  name: "relay: password auth via Bearer token",
  pass:
    relayRoute.includes("Bearer") && relayRoute.includes("authorization"),
  detail: "Must validate password from Authorization header",
});

checks.push({
  name: "relay: reads FEE_PAYER_PRIVATE_KEY from env (not NEXT_PUBLIC_)",
  pass:
    relayRoute.includes("FEE_PAYER_PRIVATE_KEY") &&
    !relayRoute.includes("NEXT_PUBLIC_FEE_PAYER"),
  detail: "Private key must NEVER be in a NEXT_PUBLIC_ env var",
});

checks.push({
  name: "relay: reads RELAY_PASSWORD from env",
  pass: relayRoute.includes("RELAY_PASSWORD"),
});

checks.push({
  name: "relay: returns 401 for bad auth",
  pass: relayRoute.includes("401"),
  detail: "Must reject unauthenticated requests",
});

checks.push({
  name: "relay: handles eth_fillTransaction proxy",
  pass: relayRoute.includes("eth_fillTransaction"),
  detail: "withRelay sends eth_fillTransaction to relay for gas estimation",
});

// --- Relay transport ---
const relayTransport = readFileSync(relayTransportPath, "utf-8");

checks.push({
  name: "relay-transport: uses custom() viem transport",
  pass: relayTransport.includes("custom("),
  detail: "Must create a custom transport for JSON-RPC routing",
});

checks.push({
  name: "relay-transport: sends Authorization Bearer header",
  pass:
    relayTransport.includes("Authorization") &&
    relayTransport.includes("Bearer"),
});

checks.push({
  name: "relay-transport: posts to /api/relay",
  pass: relayTransport.includes("/api/relay"),
});

// --- Race engine ---
const raceEngine = readFileSync(join(SRC, "lib/race-engine.ts"), "utf-8");

checks.push({
  name: "race-engine: accepts sponsored + relayPassword params",
  pass:
    raceEngine.includes("sponsored") &&
    raceEngine.includes("relayPassword"),
});

checks.push({
  name: "race-engine: passes feePayer: true when sponsored",
  pass: raceEngine.includes("feePayer: true"),
  detail:
    "feePayer: true omits feeToken from user signing, serializes with null feePayerSignature",
});

checks.push({
  name: "race-engine: imports withRelay from viem/tempo",
  pass: raceEngine.includes("withRelay"),
  detail: "withRelay transport intercepts sponsored tx broadcast to relay",
});

checks.push({
  name: "race-engine: builds sponsored client with withRelay transport",
  pass: raceEngine.includes("buildSponsoredClient"),
  detail: "Must wrap the wallet client transport for relay routing",
});

checks.push({
  name: "race-engine: shows (sponsored) in fee display",
  pass: raceEngine.includes("(sponsored)"),
  detail: "Fee display should indicate when relay paid the fee",
});

// --- Sponsor toggle component ---
const sponsorToggle = readFileSync(sponsorTogglePath, "utf-8");

checks.push({
  name: "sponsor-toggle: has Self-pay option",
  pass: sponsorToggle.includes("Self-pay"),
});

checks.push({
  name: "sponsor-toggle: has Sponsored option",
  pass: sponsorToggle.includes("Sponsored"),
});

checks.push({
  name: "sponsor-toggle: has password input",
  pass:
    sponsorToggle.includes('type="password"') &&
    sponsorToggle.includes("relayPassword"),
  detail: "Password input for relay authentication",
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
  name: "race-form: passes relayPassword to startRace",
  pass: raceForm.includes("relayPassword"),
});

checks.push({
  name: "race-form: disables start button when sponsored but no password",
  pass: raceForm.includes("sponsored && !relayPassword"),
  detail: "Must not start a sponsored race without relay password",
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

checks.push({
  name: "env.example: documents RELAY_PASSWORD",
  pass: envExample.includes("RELAY_PASSWORD"),
});

// Report
const failed = checks.filter((c) => !c.pass);
if (failed.length > 0) {
  console.error("SPONSORED-FEES EVAL FAILED:");
  for (const f of failed) {
    console.error(`  ✗ ${f.name}`);
    if (f.detail) console.error(`    → ${f.detail}`);
  }
  process.exit(1);
} else {
  console.log(`SPONSORED-FEES EVAL PASSED (${checks.length} checks):`);
  for (const c of checks) {
    console.log(`  ✓ ${c.name}`);
  }
}
