"use client";

import { useSyncExternalStore } from "react";
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
import { ExternalLink } from "lucide-react";

/** Reads USDC balance via balanceOf — Tempo: NEVER use eth_getBalance (returns dummy) */
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
      return client.readContract({
        address: USDC_ADDRESSES[chainId as keyof typeof USDC_ADDRESSES],
        abi: erc20Abi,
        functionName: "balanceOf",
        args: [address],
      });
    },
  });
}

/** Shows USDC balance per chain with FUNDED/NEEDED badges — gates the race start */
export function FundingChecklist({
  onAllFunded,
  tempoAddress,
}: {
  onAllFunded: (funded: boolean) => void;
  tempoAddress?: `0x${string}`;
}) {
  const { address } = useAccount();
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );

  const ethUsdc = useUsdcBalance(mainnet.id, address);
  const baseUsdc = useUsdcBalance(base.id, address);
  const tempoUsdc = useUsdcBalance(tempo.id, tempoAddress);

  const balances = [
    { chainId: mainnet.id, query: ethUsdc },
    { chainId: base.id, query: baseUsdc },
    { chainId: tempo.id, query: tempoUsdc },
  ];

  const statuses = balances.map(({ chainId, query }) => {
    const funded = query.data
      ? parseFloat(formatUnits(query.data, 6)) >=
        MIN_BALANCES[chainId as keyof typeof MIN_BALANCES].amount
      : false;
    const balance =
      query.data !== undefined
        ? parseFloat(formatUnits(query.data, 6)).toFixed(2)
        : null;
    return {
      chainId,
      name: CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES],
      color: CHAIN_COLORS[chainId as keyof typeof CHAIN_COLORS],
      funded,
      balance,
      required: MIN_BALANCES[chainId as keyof typeof MIN_BALANCES].label,
      bridgeLink: BRIDGE_LINKS[chainId as keyof typeof BRIDGE_LINKS],
      // Show loading while fetching, or if query hasn't returned data yet (no error)
      loading: query.isLoading || query.isFetching || (query.data === undefined && !query.isError),
      error: query.isError,
    };
  });

  const allFunded = statuses.every((s) => s.funded);
  if (typeof onAllFunded === "function") {
    queueMicrotask(() => onAllFunded(allFunded));
  }

  if (!mounted) return null;

  const fundedCount = statuses.filter((s) => s.funded).length;

  return (
    <div className="gradient-border p-6 space-y-5">
      {/* Header */}
      <div>
        <h2 className="font-[var(--font-bricolage)] text-xl font-bold text-white">
          Fund Your Wallet
        </h2>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Three chains need USDC to race
        </p>
      </div>

      {/* Progress dots */}
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-all ${
              i < fundedCount
                ? "bg-[var(--tempo-primary)]"
                : "bg-[var(--bg-elevated)]"
            }`}
          />
        ))}
      </div>

      {/* Chain rows */}
      <div className="space-y-1">
        {statuses.map((s, i) => (
          <div key={s.chainId}>
            <div className="flex items-center justify-between py-3.5 px-1 rounded-xl hover:bg-[var(--bg-raised)] transition-all group">
              <div className="flex items-center gap-3">
                {/* Chain icon circle with gradient */}
                <div
                  className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
                  style={{
                    background: `linear-gradient(135deg, ${s.color}, ${s.color}aa)`,
                  }}
                >
                  {s.name[0]}
                </div>
                <div>
                  <div className="text-sm font-medium text-white">{s.name}</div>
                  <div className="text-xs text-[var(--text-dim)]">
                    Need {s.required}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {s.loading ? (
                  <div className="h-4 w-20 rounded-full bg-[var(--bg-elevated)] animate-pulse" />
                ) : s.error ? (
                  <span className="text-xs text-[var(--text-dim)]">RPC error</span>
                ) : (
                  <>
                    <span className="font-mono text-sm text-white tabular-nums">
                      {s.balance ?? "0.00"}{" "}
                      <span className="text-[var(--text-dim)]">USDC</span>
                    </span>
                    {s.funded ? (
                      <span
                        className="px-2.5 py-1 rounded-full text-[10px] font-semibold text-white"
                        style={{
                          background: `linear-gradient(135deg, ${s.color}, ${s.color}cc)`,
                        }}
                      >
                        FUNDED
                      </span>
                    ) : (
                      <a
                        href={s.bridgeLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-medium border border-[var(--border-bright)] text-[var(--text-secondary)] hover:text-white transition-colors"
                      >
                        Bridge <ExternalLink className="size-2.5" />
                      </a>
                    )}
                  </>
                )}
              </div>
            </div>
            {i < statuses.length - 1 && (
              <div className="h-px bg-[var(--border)] mx-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
