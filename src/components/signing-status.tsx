"use client";

import { CHAIN_IDS, CHAIN_NAMES, CHAIN_COLORS, CHAIN_BORDER_CLASSES } from "@/lib/chains";
import type { ChainRaceState } from "@/lib/race-engine";
import { Loader2, CheckCircle2 } from "lucide-react";

export function SigningStatus({ chainStates }: { chainStates: Record<number, ChainRaceState> }) {
  return (
    <div className="space-y-2 border border-[var(--border)] rounded-sm bg-[var(--bg-surface)] p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--text-dim)] mb-3">
        Awaiting Signatures
      </div>
      {CHAIN_IDS.map((id) => {
        const cs = chainStates[id];
        const color = CHAIN_COLORS[id as keyof typeof CHAIN_COLORS];
        const name = CHAIN_NAMES[id as keyof typeof CHAIN_NAMES];
        const isSigning = cs?.state === "signing";
        const isSigned = cs?.state === "signed" || cs?.state === "racing" || cs?.state === "confirmed";
        return (
          <div
            key={id}
            className={`${CHAIN_BORDER_CLASSES[id]} flex items-center justify-between px-4 py-3 rounded-sm border transition-all ${
              isSigned
                ? "border-[var(--success)]/20 bg-[var(--success)]/5"
                : isSigning
                  ? "border-[var(--tempo-primary)]/30 bg-[var(--tempo-dim)]"
                  : "border-[var(--border)] bg-[var(--bg-base)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm font-mono text-[var(--text-primary)]">{name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              {isSigning && (
                <>
                  <Loader2 className="size-3.5 animate-spin" style={{ color }} />
                  <span style={{ color }}>SIGNING</span>
                </>
              )}
              {isSigned && (
                <>
                  <CheckCircle2 className="size-3.5 text-[var(--success)]" />
                  <span className="text-[var(--success)]">SIGNED</span>
                </>
              )}
              {!isSigning && !isSigned && cs?.state !== "error" && (
                <span className="text-[var(--text-dim)] uppercase">Waiting</span>
              )}
              {cs?.state === "error" && (
                <span className="text-[var(--destructive)] truncate max-w-48">
                  {cs.error ?? "Failed"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
