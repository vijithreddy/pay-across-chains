"use client";

import { useState } from "react";
import { CHAIN_COLORS, EXPLORER_URLS } from "@/lib/chains";
import { ExternalLink, Copy, Check, Zap } from "lucide-react";
import type { RaceResult } from "@/types";

/** Renders a saved race result — no wallet needed, anyone can view */
export function SharedRaceView({ result }: { result: RaceResult }) {
  const [copied, setCopied] = useState(false);
  const winner = result.chains.find((c) => c.name === result.winner);
  const raceDate = new Date(result.timestamp).toLocaleString();

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-white">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-3">
        <div className="mx-auto max-w-3xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="size-5 text-[var(--tempo-bright)]" />
            <span className="font-[var(--font-bricolage)] text-lg font-bold">
              Pay Across Chains
            </span>
          </div>
          <span className="text-xs text-[var(--text-dim)]">{raceDate}</span>
        </div>
      </header>

      <main className="px-6 py-10">
        <div className="mx-auto max-w-3xl space-y-8">
          {/* Winner banner */}
          <div className="text-center space-y-3">
            <h1 className="font-[var(--font-bricolage)] text-3xl font-bold">
              {result.winner} Won
            </h1>
            {winner && (
              <p className="text-lg text-[var(--text-secondary)]">
                Confirmed in{" "}
                <span className="font-mono text-[var(--success)]">
                  {(winner.elapsedMs / 1000).toFixed(2)}s
                </span>
              </p>
            )}
          </div>

          {/* Results table */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--border)]">
                  <th className="px-4 py-3 text-left text-xs text-[var(--text-dim)]" />
                  {result.chains.map((c) => (
                    <th key={c.chainId} className="px-4 py-3 text-center">
                      <span
                        className="text-xs font-medium"
                        style={{
                          color:
                            CHAIN_COLORS[
                              c.chainId as keyof typeof CHAIN_COLORS
                            ],
                        }}
                      >
                        {c.name}
                        {c.name === result.winner && " 🏆"}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-[var(--text-secondary)]">
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-3 text-xs text-[var(--text-dim)]">
                    Time
                  </td>
                  {result.chains.map((c) => (
                    <td
                      key={c.chainId}
                      className="px-4 py-3 text-center font-mono"
                    >
                      {c.state === "confirmed" ? (
                        <span
                          className={
                            c.name === result.winner
                              ? "text-[var(--success)] font-bold"
                              : ""
                          }
                        >
                          {(c.elapsedMs / 1000).toFixed(2)}s
                        </span>
                      ) : (
                        "Failed"
                      )}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-3 text-xs text-[var(--text-dim)]">
                    Fee
                  </td>
                  {result.chains.map((c) => (
                    <td
                      key={c.chainId}
                      className="px-4 py-3 text-center font-mono text-xs"
                    >
                      {c.feeDisplay}
                    </td>
                  ))}
                </tr>
                <tr className="border-b border-[var(--border)]">
                  <td className="px-4 py-3 text-xs text-[var(--text-dim)]">
                    Explorer
                  </td>
                  {result.chains.map((c) => {
                    const explorer =
                      EXPLORER_URLS[c.chainId as keyof typeof EXPLORER_URLS];
                    return (
                      <td key={c.chainId} className="px-4 py-3 text-center">
                        {c.hash ? (
                          <a
                            href={`${explorer}/tx/${c.hash}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-[var(--tempo-bright)] hover:text-white transition-colors"
                          >
                            View <ExternalLink className="size-2.5" />
                          </a>
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

          {/* Payment details */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] p-5 space-y-3">
            <h3 className="text-xs text-[var(--text-dim)] uppercase tracking-wider">
              Payment Details
            </h3>
            <div className="grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-xs text-[var(--text-dim)]">Amount</div>
                <div className="font-mono">{result.amount} USDC</div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-dim)]">Recipient</div>
                <div className="font-mono text-xs truncate">
                  {result.recipient}
                </div>
              </div>
              <div>
                <div className="text-xs text-[var(--text-dim)]">Memo</div>
                <div className="font-mono text-xs truncate">{result.memo}</div>
              </div>
            </div>
          </div>

          {/* Share button */}
          <div className="text-center">
            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl border border-[var(--border-bright)] bg-[var(--bg-raised)] text-sm text-[var(--text-secondary)] hover:text-white transition-all"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-[var(--success)]" /> Copied!
                </>
              ) : (
                <>
                  <Copy className="size-4" /> Copy Share Link
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
