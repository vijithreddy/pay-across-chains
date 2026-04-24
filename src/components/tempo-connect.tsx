"use client";

import { useTempoWallet } from "./tempo-provider";
import { Loader2 } from "lucide-react";

/** Tempo Wallet sign-in/disconnect button — separate from MetaMask/RainbowKit */
export function TempoConnect() {
  const { address, signIn, signOut, isPending } = useTempoWallet();

  if (isPending) {
    return (
      <div className="chain-border-tempo flex items-center gap-2 rounded-sm border border-[var(--tempo-primary)]/30 bg-[var(--tempo-dim)] px-4 py-3">
        <Loader2 className="size-3.5 animate-spin text-[var(--tempo-primary)]" />
        <span className="text-xs font-mono uppercase tracking-wider text-[var(--tempo-primary)]">
          Signing in to Tempo Wallet...
        </span>
      </div>
    );
  }

  if (address) {
    return (
      <div className="chain-border-tempo flex items-center justify-between rounded-sm border border-[var(--tempo-primary)]/20 bg-[var(--tempo-dim)] px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-[var(--tempo-primary)]" />
          <div>
            <div className="text-xs font-mono uppercase tracking-wider text-[var(--text-primary)]">
              Tempo Wallet
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent parent div click from triggering signOut
                navigator.clipboard.writeText(address);
              }}
              title="Click to copy"
              className="text-[10px] font-mono text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              {address.slice(0, 6)}...{address.slice(-4)}
            </button>
          </div>
        </div>
        <button
          onClick={signOut}
          className="text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={signIn}
      className="w-full rounded-sm border border-[var(--tempo-primary)]/30 bg-[var(--bg-surface)] hover:bg-[var(--tempo-dim)] text-[var(--tempo-primary)] font-mono text-xs uppercase tracking-wider py-3 transition-all hover:border-[var(--tempo-primary)]/50"
    >
      Sign in to Tempo Wallet
    </button>
  );
}
