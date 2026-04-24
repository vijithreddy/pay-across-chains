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
      className="inline-flex items-center gap-1 font-mono text-xs hover:text-zinc-100 transition-colors"
    >
      {short}
      {copied ? (
        <Check className="size-3 text-emerald-400" />
      ) : (
        <Copy className="size-3 text-zinc-500" />
      )}
    </button>
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

  // Find winner
  const confirmed = CHAIN_IDS.filter(
    (id) => chainStates[id]?.state === "confirmed"
  );
  const winnerId = confirmed.reduce(
    (best, id) =>
      (chainStates[id]?.elapsedMs ?? Infinity) <
      (chainStates[best]?.elapsedMs ?? Infinity)
        ? id
        : best,
    confirmed[0]
  );

  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-800/50 bg-[#0a0a0f]">
      <div className="px-5 py-3.5 border-b border-zinc-800/50">
        <h3 className="text-sm font-semibold text-zinc-100">Race Results</h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800/40 text-zinc-500">
              <th className="px-4 py-2 text-left font-medium" />
              {CHAIN_IDS.map((id) => (
                <th
                  key={id}
                  className="px-4 py-2 text-center font-medium"
                  style={{
                    color:
                      CHAIN_COLORS[id as keyof typeof CHAIN_COLORS],
                  }}
                >
                  {CHAIN_NAMES[id as keyof typeof CHAIN_NAMES]}
                  {id === winnerId && " \u{1F3C6}"}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="text-zinc-300">
            {/* Time */}
            <tr className="border-b border-zinc-800/50">
              <td className="px-4 py-2 text-zinc-500 font-medium">Time</td>
              {CHAIN_IDS.map((id) => {
                const cs = chainStates[id];
                return (
                  <td
                    key={id}
                    className={`px-4 py-2 text-center font-mono ${id === winnerId ? "text-emerald-400 font-bold" : ""}`}
                  >
                    {cs?.state === "confirmed"
                      ? `${(cs.elapsedMs! / 1000).toFixed(2)}s`
                      : "Failed"}
                  </td>
                );
              })}
            </tr>

            {/* Fee */}
            <tr className="border-b border-zinc-800/50">
              <td className="px-4 py-2 text-zinc-500 font-medium">Fee</td>
              {CHAIN_IDS.map((id) => (
                <td key={id} className="px-4 py-2 text-center font-mono">
                  {chainStates[id]?.feeDisplay ?? "—"}
                </td>
              ))}
            </tr>

            {/* Fee Token */}
            <tr className="border-b border-zinc-800/50">
              <td className="px-4 py-2 text-zinc-500 font-medium">Fee Token</td>
              {CHAIN_IDS.map((id) => (
                <td key={id} className="px-4 py-2 text-center">
                  {chainStates[id]?.feeToken ?? "—"}
                  {id === tempo.id && (
                    <span className="ml-1 text-emerald-400 text-xs">
                      (same token!)
                    </span>
                  )}
                </td>
              ))}
            </tr>

            {/* Finality */}
            <tr className="border-b border-zinc-800/50">
              <td className="px-4 py-2 text-zinc-500 font-medium">Finality</td>
              <td className="px-4 py-2 text-center text-zinc-400">
                ~12 min (probabilistic)
              </td>
              <td className="px-4 py-2 text-center text-zinc-400">
                7-day challenge window
              </td>
              <td className="px-4 py-2 text-center text-emerald-400 font-medium">
                Instant (deterministic)
              </td>
            </tr>

            {/* Memo */}
            <tr className="border-b border-zinc-800/50">
              <td className="px-4 py-2 text-zinc-500 font-medium">Memo</td>
              <td className="px-4 py-2 text-center text-zinc-600">N/A</td>
              <td className="px-4 py-2 text-center text-zinc-600">N/A</td>
              <td className="px-4 py-2 text-center text-emerald-400">
                Native
              </td>
            </tr>

            {/* Tx Hash + Explorer */}
            <tr>
              <td className="px-4 py-2 text-zinc-500 font-medium">Explorer</td>
              {CHAIN_IDS.map((id) => {
                const cs = chainStates[id];
                const explorer =
                  EXPLORER_URLS[id as keyof typeof EXPLORER_URLS];
                return (
                  <td key={id} className="px-4 py-2 text-center">
                    {cs?.hash ? (
                      <div className="flex flex-col items-center gap-1">
                        <CopyHash hash={cs.hash} />
                        <a
                          href={`${explorer}/tx/${cs.hash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300"
                        >
                          View
                          <ExternalLink className="size-3" />
                        </a>
                      </div>
                    ) : (
                      "—"
                    )}
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
