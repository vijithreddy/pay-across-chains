import { http } from "viem";
import { mainnet, base } from "wagmi/chains";
import { tempo as tempoBase } from "viem/chains";

// Use extend() to set feeToken — triggers Tempo tx type (0x76) serialization.
// Without feeToken, transactions serialize as EIP-1559 and get stuck in "queued".
export const tempo = tempoBase.extend({
  feeToken: process.env.NEXT_PUBLIC_USDC_TEMPO as `0x${string}`,
});

export const chains = [mainnet, base, tempo] as const;

export const transports = {
  [mainnet.id]: http(process.env.NEXT_PUBLIC_ETH_RPC),
  [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC),
  [tempo.id]: http(process.env.NEXT_PUBLIC_TEMPO_RPC!),
};

// USDC contract addresses per chain
export const USDC_ADDRESSES = {
  [mainnet.id]: process.env.NEXT_PUBLIC_USDC_ETHEREUM as `0x${string}`,
  [base.id]: process.env.NEXT_PUBLIC_USDC_BASE as `0x${string}`,
  [tempo.id]: process.env.NEXT_PUBLIC_USDC_TEMPO as `0x${string}`,
} as const;

// Minimum USDC balances for funding gate (sending 1 USDC per chain)
export const MIN_BALANCES = {
  [mainnet.id]: { amount: 1, label: "1 USDC", token: "USDC" },
  [base.id]: { amount: 1, label: "1 USDC", token: "USDC" },
  [tempo.id]: { amount: 1.5, label: "1.5 USDC", token: "USDC" },
} as const;

// Bridge/funding links
export const BRIDGE_LINKS = {
  [mainnet.id]: "https://app.uniswap.org",
  [base.id]: "https://bridge.base.org",
  [tempo.id]: "https://tempo.xyz",
} as const;

// Explorer links
export const EXPLORER_URLS = {
  [mainnet.id]: "https://etherscan.io",
  [base.id]: "https://basescan.org",
  [tempo.id]: "https://explore.tempo.xyz",
} as const;

export const CHAIN_COLORS = {
  [mainnet.id]: "#627EEA",
  [base.id]: "#0052FF",
  [tempo.id]: "#7C3AED",
} as const;

export const CHAIN_NAMES = {
  [mainnet.id]: "Ethereum",
  [base.id]: "Base",
  [tempo.id]: "Tempo",
} as const;
