"use client";

import { useTempoWallet } from "./tempo-provider";
import { Loader2 } from "lucide-react";

/** Tempo Wallet sign-in/disconnect button — separate from MetaMask/RainbowKit */
export function TempoConnect() {
  const { address, signIn, signOut, isPending } = useTempoWallet();

  if (isPending) {
    return (
      <div className="flex items-center justify-center gap-3 rounded-xl border border-[var(--tempo-primary)]/20 bg-[var(--bg-surface)] px-5 py-4">
        <Loader2 className="size-4 animate-spin text-[var(--tempo-bright)]" />
        <span className="text-sm text-[var(--tempo-bright)]">
          Signing in to Tempo Wallet...
        </span>
      </div>
    );
  }

  if (address) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-[var(--tempo-primary)]/20 bg-[var(--bg-surface)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
            style={{ background: "var(--tempo-gradient)" }}
          >
            T
          </div>
          <div>
            <div className="text-sm font-medium text-white">Tempo Wallet</div>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent parent from intercepting the copy action
                navigator.clipboard.writeText(address);
              }}
              title="Click to copy"
              className="text-xs font-mono text-[var(--text-dim)] hover:text-white transition-colors"
            >
              {address.slice(0, 6)}...{address.slice(-4)}
            </button>
          </div>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-[var(--text-dim)] hover:text-white transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={signIn}
      className="btn-tempo w-full rounded-xl py-3.5 text-sm font-semibold"
    >
      Sign in to Tempo Wallet
    </button>
  );
}
