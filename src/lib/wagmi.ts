"use client";

import { createConfig } from "wagmi";
import { mainnet, base } from "wagmi/chains";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  coinbaseWallet,
  walletConnectWallet,
  injectedWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { tempo, transports } from "./chains";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: [
        metaMaskWallet,
        coinbaseWallet,
        walletConnectWallet,
        injectedWallet,
      ],
    },
  ],
  {
    appName: "Pay Across Chains",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  }
);

export const config = createConfig({
  chains: [mainnet, base, tempo] as unknown as readonly [
    typeof mainnet,
    ...(typeof mainnet)[],
  ],
  connectors,
  // CRITICAL: disable EIP-6963 auto-discovery so the accounts SDK's
  // Tempo Wallet provider announcement doesn't hijack the wagmi connection
  multiInjectedProviderDiscovery: false,
  transports,
});
