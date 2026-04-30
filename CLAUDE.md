@AGENTS.md

# Pay Across Chains

## Goal
Live race: same USDC payment on Ethereum mainnet, Base mainnet, and Tempo
mainnet simultaneously. Tempo wins in ~500ms. Real transactions, real fees,
real explorer links. Built for a Tempo Solutions Engineer interview.

## User Flow
1. Land on app → split hero: intro left, idle race track preview right
2. User connects MetaMask via RainbowKit ConnectButton
3. User signs in to Tempo Wallet via accounts SDK embedded dialog
4. Funding checklist reads USDC balances on all 3 chains via token.balanceOf.
   Users can toggle Eth/Base off (click chain icon) to skip and save gas:
   - Ethereum: need ≥ 1 USDC (gas paid in ETH separately)
   - Base: need ≥ 1 USDC (gas paid in ETH separately)
   - Tempo: need ≥ 1.5 USDC (covers transfer + USDC gas fee)
5. All green + both wallets connected → "START THE RACE →" button
6. Race screen with compact payment form:
   - Recipient: any valid address
   - Amount: 1 USDC
   - Memo: "Invoice #1042 — Demo Payment" (Tempo exclusive)
7. "SEND ON ALL THREE" → sequential signing (enabled chains only):
   - Ethereum: MetaMask prompt (writeContract, ERC-20 transfer)
   - Base: MetaMask prompt (writeContract, ERC-20 transfer)
   - Tempo: Tempo Wallet dialog (Actions.token.transfer, native type 0x76)
8. All signed → waiting phase: spinner while confirmations come in
9. All confirmed → replay phase: animated race with proportional timing
10. Tempo finishes first (~500ms) → confetti → Base (~3s) → Ethereum (~45s)
11. Times shown are REAL from broadcast, not replay animation time
12. Results table: time, fee, fee token, finality, memo — with explorer links

## Dual-Wallet Architecture
Two separate wallet connections — NOT the same address:
- **EVM Wallet** (MetaMask, Phantom, or Coinbase via RainbowKit/wagmi): signs Ethereum + Base ERC-20 transfers
- **Tempo Wallet** (via accounts SDK): signs native Tempo type 0x76 transfers

User connects ONE EVM wallet at a time (MetaMask OR Phantom OR Coinbase)
plus Tempo Wallet separately. Both wallets installed simultaneously is fine.

Why two wallets:
- EVM wallets cannot sign Tempo's custom tx type (0x76)
- Tempo Wallet uses WebAuthn/passkeys — signing via embedded dialog
- wagmi manages EVM wallet; accounts SDK manages Tempo independently

Critical config:
- `multiInjectedProviderDiscovery: false` in wagmi config — prevents
  accounts SDK's EIP-6963 announcement from hijacking EVM wallet connection
- TempoProvider uses React context, NOT wagmi hooks — zero cross-contamination
- Use RainbowKit's built-in wallet connectors ONLY — never raw `injected()`

## Wagmi Config (EVM Wallets / Eth+Base)
```
// src/lib/wagmi.ts
import { createConfig } from "wagmi"
import { connectorsForWallets } from "@rainbow-me/rainbowkit"
import { metaMaskWallet, phantomWallet, coinbaseWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets"

const connectors = connectorsForWallets([
  { groupName: "Wallets", wallets: [metaMaskWallet, phantomWallet, coinbaseWallet, walletConnectWallet] }
], { appName, projectId })

createConfig({
  chains: [mainnet, base, tempo],
  connectors,
  multiInjectedProviderDiscovery: false,  // CRITICAL
  transports: { ... },
})
```

NEVER use raw `injected()` from wagmi/connectors — causes infinite
connect-event loops when multiple wallet extensions are installed.
RainbowKit's wallet connectors handle event dedup and lifecycle correctly.

## Tempo Wallet Config (accounts SDK)
```
// src/components/tempo-provider.tsx
import { Provider, dialog, Dialog } from "accounts"
import { createWalletClient, custom } from "viem"

// Create provider with iframe (HTTPS) or popup (localhost)
Provider.create({
  adapter: dialog({ dialog: isLocalhost ? Dialog.popup() : Dialog.iframe() }),
  chains: [tempo],
})

// Build wallet client with JSON-RPC account (NOT getAccount signable)
// Dialog handles signing — app never has the private key
createWalletClient({
  account: address,  // just the address, not a signable account
  chain: tempo,
  transport: custom(provider),
})
```

## Provider Wrap Order in layout.tsx
WagmiProvider → QueryClientProvider → RainbowKitProvider → TempoProvider

## Tempo Chain Config
```
// src/lib/chains.ts
import { tempo as tempoBase } from "viem/chains"

// extend() sets feeToken — triggers Tempo tx type (0x76) serialization
export const tempo = tempoBase.extend({
  feeToken: process.env.NEXT_PUBLIC_USDC_TEMPO as `0x${string}`,
})
```

## Chain Toggle
Users can disable Eth/Base to save gas during testing:
- Click the chain icon circle in funding checklist to toggle
- Disabled chains show "SKIPPED", grey out, skip signing
- Tempo cannot be disabled — it's always included
- Progress bar and allFunded only count enabled chains
- `enabledChains: Set<number>` flows from page → checklist → race form → engine
- Race engine filters `signOrder` to only include enabled chains

## Race Engine — Three Phases (Replay Architecture)
The race is NOT live — it's a replay of real data. This avoids timing
issues from sequential signing (Eth/Base confirming during Tempo signing).

Phase 1 — Sequential signing:
- Ethereum: wagmi writeContract → MetaMask prompt → hash
- Base: wagmi writeContract → MetaMask prompt → hash
- Tempo: Actions.token.transfer → Tempo Wallet dialog → hash
- Only enabled chains are signed (disabled chains skipped)

Phase 2 — Silent confirmation wait:
- UI shows spinner: "Waiting for confirmations..."
- Promise.allSettled → waitForTransactionReceipt for all signed chains
- Collects real elapsed times, fees, receipts
- No animation yet — just data collection

Phase 3 — Animated replay:
- replayRace() schedules onUpdate calls at proportional times
- All runners start at 0 simultaneously
- Each chain finishes at (realTime / maxTime) * REPLAY_DURATION
- REPLAY_DURATION capped at 10s so Ethereum's 45s doesn't bore users
- Times shown are REAL (from broadcastTime), not replay time
- Confetti fires when Tempo (winner) crosses finish

## Sponsored Fees (Tempo Exclusive)
Relay-based fee sponsorship — a server co-signs the tx and pays gas:

Flow:
1. User toggles "Sponsored" in payment form
2. Race engine passes feePayer: true to Actions.token.transfer
3. Provider.create({ feePayer: '/api/relay' }) routes sponsored txs to relay
4. Provider's internal transport handles eth_fillTransaction → relay (gas estimation)
5. After dialog signs, routes eth_signRawTransaction → relay (co-signing)
6. Relay co-signs with FEE_PAYER_PRIVATE_KEY, client broadcasts

Architecture:
- Provider.create with feePayer: '/api/relay' — canonical Tempo pattern
- /api/relay/route.ts — handles eth_signRawTransaction, eth_sendRawTransaction, eth_fillTransaction
- src/components/sponsor-toggle.tsx — Self-pay / Sponsored radio (no password needed)
- Same-origin auth — Provider transport uses http() without auth headers

Security:
- FEE_PAYER_PRIVATE_KEY: server-only env var, NEVER NEXT_PUBLIC_
- RELAY_PASSWORD: server-only env var, sent as Bearer token
- Relay returns 401 for unauthenticated requests
- Fee payer is a secp256k1 account (not passkey), funded with USDC on Tempo

## Transaction Details
- Ethereum: standard ERC-20 USDC transfer via wagmi writeContract
- Base: standard ERC-20 USDC transfer via wagmi writeContract
- Tempo: Actions.token.transfer from viem/tempo — native type 0x76, with memo
- Tempo (sponsored): same but with feePayer: true, relay co-signs and pays gas
- Fee calculation: gasUsed * effectiveGasPrice, formatEther for all chains

## Dry Race Mode
Add `?dry` to URL to skip wallet connection and run with mock timing:
- Tempo: 480ms, Base: 2800ms, Ethereum: 44000ms
- Console logs show what real tx calls would look like
- startDryRace() in race-engine.ts

## Results Table
| | Ethereum | Base | Tempo |
|---|---|---|---|
| Time | real ms | real ms | real ms |
| Fee | real ETH | real ETH | real USDC |
| Fee token | ETH | ETH | USDC (same token!) |
| Finality | ~12 min | 7-day window | Instant |
| Memo | N/A | N/A | Native |
Explorer links: Etherscan, Basescan, explore.tempo.xyz

## Tab 2 — Migration Cards
6 hardcoded before/after cards. EVM left (red tint), Tempo right (green tint).
Changed lines highlighted with 3px left bar. One line explanation. Copy button.
1. Balance check: eth_getBalance → token.balanceOf
2. Transfer with memo: ERC-20 → TIP-20 + memo
3. Fee token: ETH hardcoded → any stablecoin
4. Gas estimation: 20k → 250k new storage slot
5. Finality: probabilistic → deterministic
6. CALLVALUE: remove payable patterns entirely

## Design System
Dark financial terminal meets F1 race telemetry.
- Fonts: DM Mono (display), Sora (body), JetBrains Mono (code)
- Colors: CSS variables in globals.css (--bg-base, --eth-primary, etc.)
- All surfaces: --bg-base/#080B0F, --bg-surface/#0E1218, --bg-raised/#161C26
- Borders: 1px, --border/#1E2733, rounded-sm everywhere
- Chain-colored 4px left borders on funding rows and status cards
- No white backgrounds. No rounded-full or rounded-2xl.
- Timer format: 00:00.48 monospace tabular-nums

## Tempo Key Facts
- No native gas token — fees in USDC automatically
- TIP-20 transfer has native memo field — always use it
- ~500ms deterministic BFT finality
- eth_getBalance returns giant dummy number — NEVER use it
- BALANCE/SELFBALANCE opcodes return 0 — use token.balanceOf
- CALLVALUE returns 0 — remove all payable patterns
- New account creation: 250,000 gas vs 0 on Ethereum
- WebAuthn requires valid TLS — use Dialog.popup() on localhost

## Tech Stack
- Next.js 16.2.4 App Router (Turbopack)
- Viem ^2.48.4
- Wagmi ^2.19.5 (v2 — NOT v3)
- RainbowKit ^2.2.10
- accounts SDK ^0.8.1 (Tempo Wallet — NOT through wagmi)
- ox (Hex utilities)
- TanStack Query
- Framer Motion
- canvas-confetti
- shadcn/ui + Tailwind

## Chains — ALL MAINNET
- Ethereum: chainId 1
- Base: chainId 8453
- Tempo: chainId 4217

## Key Files
- src/lib/wagmi.ts — wagmi config with RainbowKit connectors
- src/lib/chains.ts — chain definitions, feeToken, USDC addresses
- src/lib/race-engine.ts — startRace, startDryRace, signChain, raceConfirmation
- src/lib/abi.ts — ERC-20 ABI + TIP-20 ABI from viem/tempo
- src/components/tempo-provider.tsx — accounts SDK Provider + WalletClient context
- src/components/tempo-connect.tsx — Tempo sign-in button
- src/components/race-form.tsx — payment form + race orchestration
- src/components/signing-status.tsx — signing phase UI per chain
- src/components/live-timer.tsx — animated 00:00.48 timer
- src/components/status-cards.tsx — per-chain confirmation cards
- src/components/race-track.tsx — SVG track with animated stick-figure runners
- src/components/results-table.tsx — terminal-style results with pill badges
- src/components/funding-checklist.tsx — balance checks with chain-colored borders
- src/components/shared-race-view.tsx — public race result page (no wallet needed)
- src/lib/storage.ts — race result persistence (Vercel KV with in-memory fallback)
- src/app/api/race/route.ts — POST to save race result
- src/app/api/race/[id]/route.ts — GET to load race result
- src/app/race/[id]/page.tsx — shareable race results page
- src/components/sponsor-toggle.tsx — Self-pay / Sponsored radio for Tempo fees
- src/app/api/relay/route.ts — POST to co-sign sponsored tx, GET for health check
- src/components/migration-cards.tsx — 6 EVM→Tempo code comparison cards
- src/types/index.ts — shared types (Tab, MigrationCard)
- evals/regression.eval.ts — 43-check regression suite (run before any changes)

## Regression Evals
Run before any code change: `npx tsx evals/regression.eval.ts`
43 checks covering: architecture, signing flow, dual-connection isolation,
hydration guards, timing, funding, UI components, file existence, TypeScript build.

Full suite (100+ checks): run all eval files:
- evals/regression.eval.ts (43 checks)
- evals/signing-flow.eval.ts (10 checks)
- evals/dual-connection.eval.ts (20 checks)
- evals/hydration.eval.ts (4 checks)
- evals/race-history.eval.ts (15 checks)
- evals/sponsored-fees.eval.ts (30 checks)

## Environment Variables
NEXT_PUBLIC_ETH_RPC
NEXT_PUBLIC_BASE_RPC
NEXT_PUBLIC_TEMPO_RPC
NEXT_PUBLIC_USDC_ETHEREUM
NEXT_PUBLIC_USDC_BASE
NEXT_PUBLIC_USDC_TEMPO
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
FEE_PAYER_PRIVATE_KEY (server-only — relay's Tempo private key)
RELAY_PASSWORD (server-only — shared secret for relay auth)
VERCEL_TOKEN

## Session Rules
- Start every session: read CLAUDE.md and CHANGES.md
- End every session: run /summarize
- Before any code change: run `npx tsx evals/regression.eval.ts`
- Never use testnet
- Never use eth_getBalance on Tempo
- Never hardcode gas limits
- Never use getAccount({ signable: true }) for Tempo — dialog handles signing
- Never put tempoWallet connector in wagmi config — use accounts SDK directly
- Never set multiInjectedProviderDiscovery to true — breaks dual wallet
- Never use raw `injected()` from wagmi/connectors — causes infinite connect
  event loops when multiple wallet extensions installed. Use RainbowKit wallets.
- Never remove switchChain before writeContract — wallet provider needs correct
  chain for simulation. Without it, USDC transfer reverts "Unexpected error".
- Never enable feePayer in Provider.create on preview deploys — Vercel
  deployment protection returns HTML auth page, crashing Tempo signing flow
- Never stop mid-build to ask for confirmation — just build


## Code Readability Rules
- Every function max 30 lines — split if longer
- Every file max 150 lines — split into smaller modules
- One component per file, filename matches component name exactly
- No inline styles — all styling via Tailwind classes or CSS variables
- No magic numbers — extract to named constants at top of file
- No commented-out code — delete it, git has history
- All async functions wrapped in try/catch — no silent failures
- Every component has a single responsibility — if you need "and" 
  to describe it, split it
- Imports ordered: React → third party → internal → types
- Types and interfaces in /src/types/ never inline in components
- Chain-specific logic lives in /src/lib/chains/ not in components
- No any types — ever



## Security Rules
- NEVER log private keys, wallet addresses, or tx hashes to console 
  in production — use process.env.NODE_ENV checks
- NEVER put anything sensitive in NEXT_PUBLIC_ prefix — 
  it is exposed to the browser
- FEE_PAYER_PRIVATE_KEY must only ever be read in /src/app/api/ 
  server routes — never in client components
- All user address inputs must be validated with isAddress() 
  from viem before any transaction
- All amount inputs must be validated — positive number, 
  max 6 decimal places, below wallet balance
- RPC URLs are in env vars — never hardcoded in source
- No secrets in CLAUDE.md, CHANGES.md or any committed file


## Comment Rules
- Every function/component: one-line comment above — WHAT and WHY
- Non-obvious logic: inline comment on the same line
- Chain gotchas: always comment with the reason not just the fix
- No obvious comments restating the code
- Every try/catch: comment what specifically can throw
- Every Promise.allSettled: comment why not Promise.all
- TODOs allowed in dev: format as // TODO: [what] [your initials]
  but zero TODOs allowed before demo day
  - Multi-return components: comment each return block with 
  // State 1: / State 2: / State 3: describing the condition
- stopPropagation and preventDefault: always comment why
- Any slice/substring on an address: comment the display convention

## Tooling
- ESLint enforces code quality — runs automatically via hook after every edit
- Prettier enforces formatting — `npm run format`
- TypeScript strict mode — noImplicitAny, noUnusedLocals, noUnusedParameters
- /lint-readability covers architecture and chain gotchas only
- `npm run lint` must pass before every /summarize
- `npm run typecheck` must pass before every /summarize
- Post-edit hook runs both typecheck + lint:check automatically