"use client";

import { useAccount, useBalance } from "wagmi";
import { createPublicClient, formatEther, formatUnits } from "viem";
import { mainnet, base } from "wagmi/chains";
import { useQuery } from "@tanstack/react-query";
import {
  tempo,
  USDC_ADDRESSES,
  MIN_BALANCES,
  BRIDGE_LINKS,
  CHAIN_COLORS,
  CHAIN_NAMES,
  transports,
} from "@/lib/chains";
import { erc20Abi } from "@/lib/abi";
import { CheckCircle2, XCircle, ExternalLink, Loader2 } from "lucide-react";

// Read Tempo USDC balance via balanceOf — NEVER eth_getBalance on Tempo
function useTempoBalance(address: `0x${string}` | undefined) {
  return useQuery({
    queryKey: ["tempo-balance", address],
    enabled: !!address,
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!address) return 0n;
      const client = createPublicClient({
        chain: tempo,
        transport: transports[tempo.id],
      });
      const balance = await client.readContract({
        address: USDC_ADDRESSES[tempo.id],
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
      return balance;
    },
  });
}

type ChainStatus = {
  chainId: number;
  name: string;
  color: string;
  funded: boolean;
  balance: string;
  required: string;
  token: string;
  bridgeLink: string;
  loading: boolean;
};

export function FundingChecklist({
  onAllFunded,
}: {
  onAllFunded: (funded: boolean) => void;
}) {
  const { address } = useAccount();

  // Ethereum ETH balance via eth_getBalance
  const ethBalance = useBalance({ address, chainId: mainnet.id });
  // Base ETH balance via eth_getBalance
  const baseBalance = useBalance({ address, chainId: base.id });
  // Tempo USDC balance via token.balanceOf
  const tempoBalance = useTempoBalance(address);

  const statuses: ChainStatus[] = [
    {
      chainId: mainnet.id,
      name: CHAIN_NAMES[mainnet.id],
      color: CHAIN_COLORS[mainnet.id],
      funded: ethBalance.data
        ? parseFloat(formatEther(ethBalance.data.value)) >=
          MIN_BALANCES[mainnet.id].amount
        : false,
      balance: ethBalance.data
        ? `${parseFloat(formatEther(ethBalance.data.value)).toFixed(4)} ETH`
        : "—",
      required: MIN_BALANCES[mainnet.id].label,
      token: "ETH",
      bridgeLink: BRIDGE_LINKS[mainnet.id],
      loading: ethBalance.isLoading,
    },
    {
      chainId: base.id,
      name: CHAIN_NAMES[base.id],
      color: CHAIN_COLORS[base.id],
      funded: baseBalance.data
        ? parseFloat(formatEther(baseBalance.data.value)) >=
          MIN_BALANCES[base.id].amount
        : false,
      balance: baseBalance.data
        ? `${parseFloat(formatEther(baseBalance.data.value)).toFixed(4)} ETH`
        : "—",
      required: MIN_BALANCES[base.id].label,
      token: "ETH",
      bridgeLink: BRIDGE_LINKS[base.id],
      loading: baseBalance.isLoading,
    },
    {
      chainId: tempo.id,
      name: CHAIN_NAMES[tempo.id],
      color: CHAIN_COLORS[tempo.id],
      funded: tempoBalance.data
        ? parseFloat(formatUnits(tempoBalance.data, 6)) >=
          MIN_BALANCES[tempo.id].amount
        : false,
      balance:
        tempoBalance.data !== undefined
          ? `${parseFloat(formatUnits(tempoBalance.data, 6)).toFixed(2)} USDC`
          : "—",
      required: MIN_BALANCES[tempo.id].label,
      token: "USDC",
      bridgeLink: BRIDGE_LINKS[tempo.id],
      loading: tempoBalance.isLoading,
    },
  ];

  const allFunded = statuses.every((s) => s.funded);

  // Notify parent
  if (typeof onAllFunded === "function") {
    // Use a microtask to avoid setState-during-render
    queueMicrotask(() => onAllFunded(allFunded));
  }

  return (
    <div className="w-full space-y-3">
      <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider">
        Funding Checklist
      </h3>
      {statuses.map((s) => (
        <div
          key={s.chainId}
          className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <div>
              <div className="text-sm font-medium text-zinc-100">{s.name}</div>
              <div className="text-xs text-zinc-500">
                Need {s.required}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-zinc-300 font-mono">
              {s.loading ? (
                <Loader2 className="size-4 animate-spin text-zinc-500" />
              ) : (
                s.balance
              )}
            </span>
            {s.loading ? null : s.funded ? (
              <CheckCircle2 className="size-5 text-emerald-400" />
            ) : (
              <a
                href={s.bridgeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-xs text-red-400 hover:text-red-300"
              >
                <XCircle className="size-5" />
                <span>Fund</span>
                <ExternalLink className="size-3" />
              </a>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
