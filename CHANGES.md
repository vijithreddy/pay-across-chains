# Changes

---
## Session: 2026-04-23T00:00Z
- Built: Full app across all 5 phases — wallet gate (RainbowKit + funding checklist), race engine (Promise.allSettled ERC-20/TIP-20 transfers), SVG race track (Framer Motion runners), results table (explorer links, fees, finality), and 6 migration pattern cards
- Changed: layout.tsx (Providers wrap, dark mode, metadata), page.tsx (complete rewrite with tabs), tsconfig.json (ES2020 target for BigInt), package.json (added RainbowKit, wagmi, viem, framer-motion, canvas-confetti, shadcn deps)
- New files: src/lib/chains.ts, src/lib/wagmi.ts, src/lib/abi.ts, src/lib/race-engine.ts, src/components/providers.tsx, src/components/funding-checklist.tsx, src/components/race-form.tsx, src/components/race-track.tsx, src/components/results-table.tsx, src/components/migration-cards.tsx
- Known issues: Tempo fee calculation assumes gasPrice is denominated in USDC units (needs verification against live Tempo receipts). WalletConnect projectId defaults to "demo" if env var missing. No NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID in .env.local yet.
- Next session: Add WalletConnect project ID to .env.local. Test wallet connect + funding checklist with real wallet. Verify Tempo TIP-20 transferWithMemo ABI matches actual deployed contract. Test full race end-to-end on mainnet.
