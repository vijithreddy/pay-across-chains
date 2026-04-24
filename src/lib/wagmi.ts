"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { chains, transports } from "./chains";

export const config = getDefaultConfig({
  appName: "Pay Across Chains",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "demo",
  chains: chains as unknown as readonly [typeof chains[0], ...typeof chains[number][]],
  transports,
});
