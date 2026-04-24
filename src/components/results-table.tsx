"use client";

import { CHAIN_COLORS, CHAIN_NAMES, EXPLORER_URLS, tempo } from "@/lib/chains";
import type { ChainRaceState } from "@/lib/race-engine";
import { mainnet, base } from "wagmi/chains";
import { ExternalLink, Copy, Check } from "lucide-react";
import { useState } from "react";

const CHAIN_IDS = [mainnet.id, base.id, tempo.id] as const;

function CopyHash({ hash }: { hash: string }) {
  const [copied, setCopied] = useState(false);
  const short = `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  return (
    <button
      onClick={() => {
        navigator.clipboard.writeText(hash);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center gap-1 font-mono text-[10px] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
    >
      {short}
      {copied ? <Check className="size-2.5 text-[var(--success)]" /> : <Copy className="size-2.5" />}
    </button>
  );
}

function Pill({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-sm text-[10px] font-mono uppercase border"
      style={{
        color,
        backgroundColor: `${color}10`,
        borderColor: `${color}30`,
      }}
    >
      {children}
    </span>
  );
}

export function ResultsTable({
  chainStates,
}: {
  chainStates: Record<number, ChainRaceState>;
}) {
  const allConfirmed = CHAIN_IDS.every(
    (id) => chainStates[id]?.state === "confirmed" || chainStates[id]?.state === "error"
  );
  if (!allConfirmed) return null;

  const confirmed = CHAIN_IDS.filter((id) => chainStates[id]?.state === "confirmed");
  const winnerId = confirmed.reduce(
    (best, id) =>
      (chainStates[id]?.elapsedMs ?? Infinity) < (chainStates[best]?.elapsedMs ?? Infinity)
        ? id : best,
    confirmed[0]
  );

  return (
    <div className="w-full overflow-hidden rounded-sm border border-[var(--border)] bg-[var(--bg-surface)]">
      <div className="px-4 py-3 border-b border-[var(--border)]">
        <h3 className="font-mono text-[10px] uppercase tracking-[0.15em] text-[var(--text-dim)]">
          Race Results
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--border)]">
              <th className="px-4 py-2.5 text-left font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]" />
              {CHAIN_IDS.map((id) => {
                const color = CHAIN_COLORS[id as keyof typeof CHAIN_COLORS];
                return (
                  <th key={id} className="px-4 py-2.5 text-center">
                    <div className="flex items-center justify-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                      <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
                        {CHAIN_NAMES[id as keyof typeof CHAIN_NAMES]}
                      </span>
                      {id === winnerId && (
                        <Pill color="var(--tempo-bright)">Winner</Pill>
                      )}
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="text-[var(--text-secondary)]">
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Time</td>
              {CHAIN_IDS.map((id) => {
                const cs = chainStates[id];
                const isWinner = id === winnerId;
                return (
                  <td key={id} className="px-4 py-2.5 text-center">
                    <span className={`font-mono timer-display text-sm ${isWinner ? "text-[var(--success)] font-bold" : ""}`}>
                      {cs?.state === "confirmed" ? `${(cs.elapsedMs! / 1000).toFixed(2)}s` : "Failed"}
                    </span>
                  </td>
                );
              })}
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Fee</td>
              {CHAIN_IDS.map((id) => (
                <td key={id} className="px-4 py-2.5 text-center font-mono text-xs">
                  {chainStates[id]?.feeDisplay ?? "\u2014"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Fee Token</td>
              {CHAIN_IDS.map((id) => (
                <td key={id} className="px-4 py-2.5 text-center">
                  {chainStates[id]?.feeToken ? (
                    <Pill color={id === tempo.id ? "var(--success)" : "var(--text-secondary)"}>
                      {chainStates[id].feeToken}
                    </Pill>
                  ) : "\u2014"}
                </td>
              ))}
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Finality</td>
              <td className="px-4 py-2.5 text-center text-xs text-[var(--text-dim)]">~12 min probabilistic</td>
              <td className="px-4 py-2.5 text-center text-xs text-[var(--text-dim)]">7-day challenge</td>
              <td className="px-4 py-2.5 text-center">
                <Pill color="var(--success)">Instant</Pill>
              </td>
            </tr>
            <tr className="border-b border-[var(--border)]">
              <td className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Memo</td>
              <td className="px-4 py-2.5 text-center"><Pill color="var(--text-dim)">N/A</Pill></td>
              <td className="px-4 py-2.5 text-center"><Pill color="var(--text-dim)">N/A</Pill></td>
              <td className="px-4 py-2.5 text-center"><Pill color="var(--success)">Native</Pill></td>
            </tr>
            <tr>
              <td className="px-4 py-2.5 font-mono text-[10px] uppercase tracking-wider text-[var(--text-dim)]">Explorer</td>
              {CHAIN_IDS.map((id) => {
                const cs = chainStates[id];
                const explorer = EXPLORER_URLS[id as keyof typeof EXPLORER_URLS];
                return (
                  <td key={id} className="px-4 py-2.5 text-center">
                    {cs?.hash ? (
                      <div className="flex flex-col items-center gap-1">
                        <CopyHash hash={cs.hash} />
                        <a
                          href={`${explorer}/tx/${cs.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[10px] font-mono text-[var(--tempo-primary)] hover:text-[var(--tempo-bright)] transition-colors"
                        >
                          View <ExternalLink className="size-2.5" />
                        </a>
                      </div>
                    ) : "\u2014"}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
