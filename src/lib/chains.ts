import { defineChain, http } from "viem";
import { mainnet, base } from "wagmi/chains";

export const tempo = defineChain({
  id: 4217,
  name: "Tempo",
  nativeCurrency: { name: "USD", symbol: "USD", decimals: 18 },
  rpcUrls: {
    default: { http: [process.env.NEXT_PUBLIC_TEMPO_RPC || "https://rpc.tempo.xyz"] },
  },
  blockExplorers: {
    default: { name: "Tempo Explorer", url: "https://explore.tempo.xyz" },
  },
});

export const chains = [mainnet, base, tempo] as const;

export const transports = {
  [mainnet.id]: http(process.env.NEXT_PUBLIC_ETH_RPC),
  [base.id]: http(process.env.NEXT_PUBLIC_BASE_RPC),
  [tempo.id]: http(process.env.NEXT_PUBLIC_TEMPO_RPC || "https://rpc.tempo.xyz"),
};

// USDC contract addresses per chain
export const USDC_ADDRESSES = {
  [mainnet.id]: process.env.NEXT_PUBLIC_USDC_ETHEREUM as `0x${string}`,
  [base.id]: process.env.NEXT_PUBLIC_USDC_BASE as `0x${string}`,
  [tempo.id]: process.env.NEXT_PUBLIC_USDC_TEMPO as `0x${string}`,
} as const;

// Minimum balances for funding gate
export const MIN_BALANCES = {
  [mainnet.id]: { amount: 0.005, label: "0.005 ETH", token: "ETH" },
  [base.id]: { amount: 0.0001, label: "0.0001 ETH", token: "ETH" },
  [tempo.id]: { amount: 5, label: "5 USDC", token: "USDC" },
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
