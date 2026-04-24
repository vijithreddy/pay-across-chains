"use client";

import { useState, useEffect } from "react";
import { useAccount } from "wagmi";
import { createPublicClient, formatUnits } from "viem";
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

// Read USDC balance via balanceOf for any chain
function useUsdcBalance(chainId: number, address: `0x${string}` | undefined) {
  const chainMap = {
    [mainnet.id]: mainnet,
    [base.id]: base,
    [tempo.id]: tempo,
  } as const;

  return useQuery({
    queryKey: ["usdc-balance", chainId, address],
    enabled: !!address,
    refetchInterval: 10_000,
    queryFn: async () => {
      if (!address) return 0n;
      const chain = chainMap[chainId as keyof typeof chainMap];
      const client = createPublicClient({
        chain,
        transport: transports[chainId as keyof typeof transports],
      });
      const balance = await client.readContract({
        address: USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES],
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
  tempoAddress,
}: {
  onAllFunded: (funded: boolean) => void;
  tempoAddress?: `0x${string}`;
}) {
  const { address } = useAccount();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Eth/Base: check MetaMask address. Tempo: check Tempo Wallet address.
  const ethUsdc = useUsdcBalance(mainnet.id, address);
  const baseUsdc = useUsdcBalance(base.id, address);
  const tempoUsdc = useUsdcBalance(tempo.id, tempoAddress);

  const balances = [
    { chainId: mainnet.id, query: ethUsdc },
    { chainId: base.id, query: baseUsdc },
    { chainId: tempo.id, query: tempoUsdc },
  ];

  const statuses: ChainStatus[] = balances.map(({ chainId, query }) => {
    const funded = query.data
      ? parseFloat(formatUnits(query.data, 6)) >=
        MIN_BALANCES[chainId as keyof typeof MIN_BALANCES].amount
      : false;
    const balance =
      query.data !== undefined
        ? `${parseFloat(formatUnits(query.data, 6)).toFixed(2)} USDC`
        : "—";

    return {
      chainId,
      name: CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES],
      color: CHAIN_COLORS[chainId as keyof typeof CHAIN_COLORS],
      funded,
      balance,
      required: MIN_BALANCES[chainId as keyof typeof MIN_BALANCES].label,
      token: "USDC",
      bridgeLink: BRIDGE_LINKS[chainId as keyof typeof BRIDGE_LINKS],
      loading: query.isLoading,
    };
  });

  const allFunded = statuses.every((s) => s.funded);

  // Notify parent
  if (typeof onAllFunded === "function") {
    queueMicrotask(() => onAllFunded(allFunded));
  }

  if (!mounted) return null;

  return (
    <div className="w-full space-y-3">
      <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
        Funding Checklist
      </h3>
      {statuses.map((s) => (
        <div
          key={s.chainId}
          className="flex items-center justify-between rounded-xl border border-zinc-800/50 bg-[#0a0a0f] px-4 py-3.5"
        >
          <div className="flex items-center gap-3">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <div>
              <div className="text-sm font-medium text-zinc-100">{s.name}</div>
              <div className="text-xs text-zinc-500">
                Need &ge; {s.required}
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
