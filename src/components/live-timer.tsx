"use client";

import { useState, useEffect } from "react";

/** Formats milliseconds as MM:SS.cc (e.g. 00:03.48) */
function formatTimer(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const frac = Math.floor((ms % 1000) / 10);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${frac.toString().padStart(2, "0")}`;
}

/** Continuously ticking timer — freezes when frozen timestamp is provided (on chain confirm) */
export function LiveTimer({ startTime, frozen }: { startTime?: number; frozen?: number }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!startTime || frozen) return;
    const id = setInterval(() => setNow(performance.now()), 16);
    return () => clearInterval(id);
  }, [startTime, frozen]);

  if (!startTime) return <span className="text-[var(--text-dim)]">--:--.--</span>;
  const elapsed = (frozen ?? now) - startTime;
  return <span>{formatTimer(elapsed)}</span>;
}
