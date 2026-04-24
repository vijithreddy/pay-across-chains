"use client";

import { createConfig } from "wagmi";
import { injected } from "wagmi/connectors";
import { mainnet, base } from "wagmi/chains";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  phantomWallet,
  coinbaseWallet,
  walletConnectWallet,
} from "@rainbow-me/rainbowkit/wallets";
import { tempo, transports } from "./chains";

/* eslint-disable @typescript-eslint/no-explicit-any */

// Phantom injects window.ethereum AND sets isMetaMask=true, which causes
// metaMaskWallet connector to pick up Phantom's provider instead of MetaMask.
// This custom wallet explicitly finds MetaMask while excluding Phantom.
function findMetaMaskProvider(): any {
  if (typeof window === "undefined") return undefined;
  const eth = window.ethereum as any;
  if (!eth) return undefined;
  // Multi-provider array (when multiple wallets installed)
  if (eth.providers) {
    return eth.providers.find(
      (p: any) => p.isMetaMask && !p.isPhantom
    );
  }
  // Single provider
  if (eth.isMetaMask && !eth.isPhantom) return eth;
  return undefined;
}

const safeMetaMaskWallet = (): any => ({
  id: "metaMask",
  name: "MetaMask",
  iconUrl:
    "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg",
  iconBackground: "#fff",
  installed: Boolean(findMetaMaskProvider()),
  createConnector: () =>
    injected({
      target: () => ({
        id: "metaMask",
        name: "MetaMask",
        provider: findMetaMaskProvider(),
      }),
    }),
});

const connectors = connectorsForWallets(
  [
    {
      groupName: "Wallets",
      wallets: [
        safeMetaMaskWallet,
        phantomWallet,
        coinbaseWallet,
        walletConnectWallet,
      ],
    },
  ],
  {
    appName: "Pay Across Chains",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  }
);

/* eslint-enable @typescript-eslint/no-explicit-any */

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
