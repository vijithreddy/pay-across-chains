"use client";

import { useTempoWallet } from "./tempo-provider";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TempoConnect() {
  const { address, signIn, signOut, isPending } = useTempoWallet();

  if (isPending) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-purple-500/30 bg-purple-950/10 px-4 py-3">
        <Loader2 className="size-4 animate-spin text-purple-400" />
        <span className="text-sm text-purple-400">
          Signing in to Tempo Wallet...
        </span>
      </div>
    );
  }

  if (address) {
    return (
      <div className="flex items-center justify-between rounded-xl border border-purple-500/20 bg-purple-950/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <div>
            <div className="text-sm font-medium text-zinc-200">
              Tempo Wallet
            </div>
            <div className="text-xs text-zinc-500 font-mono">
              {address.slice(0, 6)}...{address.slice(-4)}
            </div>
          </div>
        </div>
        <button
          onClick={signOut}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <Button
      onClick={signIn}
      variant="outline"
      className="w-full border-purple-500/30 text-purple-400 hover:bg-purple-950/20 hover:text-purple-300"
    >
      Sign in to Tempo Wallet
    </Button>
  );
}
