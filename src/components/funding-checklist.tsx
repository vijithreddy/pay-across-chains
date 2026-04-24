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
  CHAIN_BORDER_CLASSES,
  transports,
} from "@/lib/chains";
import { erc20Abi } from "@/lib/abi";
import { ExternalLink } from "lucide-react";

/** Reads USDC balance via balanceOf for any chain — Tempo: NEVER use eth_getBalance (returns dummy) */
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

/** Shows USDC balance per chain with FUNDED/NOT FUNDED badges — gates the race start */
export function FundingChecklist({
  onAllFunded,
  tempoAddress,
}: {
  onAllFunded: (funded: boolean) => void;
  tempoAddress?: `0x${string}`;
}) {
  const { address } = useAccount();
  // useSyncExternalStore avoids cascading setState-in-useEffect — false on server, true on client
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
      loading: query.isLoading,
    };
  });

  const allFunded = statuses.every((s) => s.funded);
  if (typeof onAllFunded === "function") {
    queueMicrotask(() => onAllFunded(allFunded));
  }

  if (!mounted) return null;

  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-dim)]">
        Funding Checklist
      </h3>
      {statuses.map((s) => (
        <div
          key={s.chainId}
          className={`${CHAIN_BORDER_CLASSES[s.chainId]} bg-[var(--bg-surface)] border border-[var(--border)] rounded-sm px-4 py-3 flex items-center justify-between transition-all hover:border-[var(--border-bright)]`}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: s.color }}
            />
            <div>
              <div className="text-sm font-medium text-[var(--text-primary)]">
                {s.name}
              </div>
              <div className="text-[10px] font-mono text-[var(--text-dim)] uppercase">
                Need {s.required}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {s.loading ? (
              <div
                className="shimmer h-4 w-20 rounded-sm"
                style={{
                  background: `linear-gradient(90deg, transparent 0%, ${s.color}22 50%, transparent 100%)`,
                  backgroundSize: "200% 100%",
                  animation: "shimmer 2s ease-in-out infinite",
                }}
              />
            ) : (
              <>
                <span className="font-mono text-sm text-[var(--text-primary)] timer-display">
                  {s.balance}{" "}
                  <span className="text-[var(--text-dim)]">USDC</span>
                </span>
                {s.funded ? (
                  <span className="px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20">
                    Funded
                  </span>
                ) : (
                  <a
                    href={s.bridgeLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase bg-[var(--destructive)]/10 text-[var(--destructive)] border border-[var(--destructive)]/20 hover:bg-[var(--destructive)]/20 transition-colors"
                  >
                    Fund <ExternalLink className="size-2.5" />
                  </a>
                )}
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
