@AGENTS.md

# Pay Across Chains

## Goal
Live race: same USDC payment on Ethereum mainnet, Base mainnet, and Tempo
mainnet simultaneously. Tempo wins in ~500ms. Real transactions, real fees,
real explorer links. Built for a Tempo Solutions Engineer interview.

## User Flow
1. Land on app → hero screen with Connect Wallet button
2. User connects wallet via RainbowKit ConnectButton
3. App reads connected wallet balances on all 3 chains simultaneously:
   - ETH on Ethereum via eth_getBalance
   - ETH on Base via eth_getBalance
   - USDC on Tempo via token.balanceOf — NEVER eth_getBalance on Tempo
4. Funding checklist with green/red per chain:
   - Ethereum: need ≥ 0.005 ETH
   - Base: need ≥ 0.0001 ETH
   - Tempo: need ≥ 5 USDC
   - If red: show bridge link
5. All green → "Start the Race" button activates
6. Pre-filled race form:
   - Recipient: any valid address (pre-fill for demo)
   - Amount: 1 USDC
   - Memo: "Invoice #1042 — Demo Payment"
7. "Send on All Three" → fires all 3 transactions simultaneously
8. SVG 3-lane track animates, runners move on real tx state
9. Tempo confirms (~500ms) → confetti, timer freezes, green flash
10. Base confirms (~3s), Ethereum confirms (~45s)
11. Results table: time, fee, fee token, finality, memo — with explorer links

## Wallet Architecture
- Connected wallet is the SIGNER for all 3 chains
- Same address, same key, different chain context
- Wagmi handles chain switching automatically
- No private keys in env vars
- No hardcoded recipient — pre-fill the form field only

## Wagmi + RainbowKit v2 Config
// src/lib/wagmi.ts
import { getDefaultConfig } from '@rainbow-me/rainbowkit'
import { mainnet, base } from 'wagmi/chains'
import { defineChain, http } from 'viem'

const tempo = defineChain({
  id: TEMPO_CHAIN_ID,
  name: 'Tempo',
  nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_TEMPO_RPC!] }
  }
})

export const config = getDefaultConfig({
  appName: 'Pay Across Chains',
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  chains: [mainnet, base, tempo],
  transports: {
    [mainnet.id]: http(process.env.NEXT_PUBLIC_ETH_RPC),
    [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC),
    [tempo.id]: http(process.env.NEXT_PUBLIC_TEMPO_RPC),
  }
})

## Provider Wrap Order in layout.tsx
QueryClientProvider → WagmiProvider → RainbowKitProvider

## Race Track Visual
- SVG 3-lane track, top half of race screen
- Lane 1: Ethereum — #627EEA
- Lane 2: Base — #0052FF
- Lane 3: Tempo — #7C3AED
- Runner position from real tx state, not fake timer
- Framer Motion for animation
- canvas-confetti on Tempo win
- Timer freezes on confirmation, others keep moving

## Transaction Details
- Ethereum: standard ERC-20 USDC transfer
- Base: standard ERC-20 USDC transfer
- Tempo: TIP-20 transfer WITH memo field
- All 3 via Promise.allSettled simultaneously
- Pull actual fee from receipt, show real dollar amount

## Results Table
| | Ethereum | Base | Tempo |
|---|---|---|---|
| Time | real ms | real ms | real ms |
| Fee | real ETH | real ETH | real USDC |
| Fee token | ETH | ETH | USDC ✅ |
| Finality | ~12 min | 7-day window | Instant ✅ |
| Memo | ❌ | ❌ | Native ✅ |
Explorer links: Etherscan, Basescan, explore.tempo.xyz

## Tab 2 — Migration Cards
6 hardcoded before/after cards. EVM left, Tempo right. Changed lines
highlighted. One line explanation. Copy button per block.
1. Balance check: eth_getBalance → token.balanceOf
2. Transfer with memo: ERC-20 → TIP-20 + memo
3. Fee token: ETH hardcoded → any stablecoin
4. Gas estimation: 20k → 250k new storage slot
5. Finality: probabilistic → deterministic
6. CALLVALUE: remove payable patterns entirely

## Tempo Key Facts
- No native gas token — fees in USDC automatically
- TIP-20 transfer has native memo field — always use it
- ~500ms deterministic BFT finality
- eth_getBalance returns giant dummy number — NEVER use it
- BALANCE/SELFBALANCE opcodes return 0 — use token.balanceOf
- CALLVALUE returns 0 — remove all payable patterns
- New account creation: 250,000 gas vs 0 on Ethereum

## Tech Stack
- Next.js 14 App Router
- Viem ^2.48.4
- Wagmi ^2.19.5
- RainbowKit ^2.2.10
- TanStack Query
- Framer Motion
- canvas-confetti
- shadcn/ui + Tailwind

## Chains — ALL MAINNET
- Ethereum: chainId 1
- Base: chainId 8453
- Tempo: get chainId from MCP on first run

## Environment Variables
NEXT_PUBLIC_ETH_RPC
NEXT_PUBLIC_BASE_RPC
NEXT_PUBLIC_TEMPO_RPC
NEXT_PUBLIC_USDC_ETHEREUM
NEXT_PUBLIC_USDC_BASE
NEXT_PUBLIC_USDC_TEMPO
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID
VERCEL_TOKEN

## Session Rules
- Start every session: read CLAUDE.md and CHANGES.md
- End every session: run /summarize
- Never use testnet
- Never use eth_getBalance on Tempo
- Never hardcode gas limits
- Never stop mid-build to ask for confirmation — just build