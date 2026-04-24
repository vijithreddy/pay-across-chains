"use client";

import {
  CHAIN_IDS,
  CHAIN_NAMES,
  CHAIN_COLORS,
  CHAIN_BORDER_CLASSES,
} from "@/lib/chains";
import type { ChainRaceState } from "@/lib/race-engine";
import { LiveTimer } from "./live-timer";

/** Shows per-chain timer cards during the confirmation race phase */
export function StatusCards({
  chainStates,
}: {
  chainStates: Record<number, ChainRaceState>;
}) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {CHAIN_IDS.map((id) => {
        const cs = chainStates[id];
        const color = CHAIN_COLORS[id as keyof typeof CHAIN_COLORS];
        const isConfirmed = cs?.state === "confirmed";
        const GLOW_OPACITY = "22";
        return (
          <div
            key={id}
            className={`${CHAIN_BORDER_CLASSES[id]} rounded-sm border bg-[var(--bg-surface)] px-3 py-3 transition-all ${
              isConfirmed
                ? "border-[var(--success)]/30"
                : "border-[var(--border)]"
            }`}
            style={
              isConfirmed
                ? { boxShadow: `0 0 12px 1px ${color}${GLOW_OPACITY}` }
                : undefined
            }
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span
                className="font-mono text-[10px] uppercase tracking-wider"
                style={{ color }}
              >
                {CHAIN_NAMES[id as keyof typeof CHAIN_NAMES]}
              </span>
            </div>
            <div
              className="font-mono text-xl timer-display"
              style={{
                color: isConfirmed ? "var(--success)" : "var(--text-primary)",
              }}
            >
              <LiveTimer
                startTime={cs?.startTime}
                frozen={isConfirmed ? cs?.endTime : undefined}
              />
            </div>
            <div className="font-mono text-[9px] uppercase tracking-wider mt-1 text-[var(--text-dim)]">
              {cs?.state === "racing"
                ? "CONFIRMING"
                : (cs?.state?.toUpperCase() ?? "IDLE")}
            </div>
          </div>
        );
      })}
    </div>
  );
}
