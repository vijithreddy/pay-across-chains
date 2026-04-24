"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { FundingChecklist } from "@/components/funding-checklist";
import { RaceForm } from "@/components/race-form";
import { MigrationCards } from "@/components/migration-cards";
import { TempoConnect } from "@/components/tempo-connect";
import { useTempoWallet } from "@/components/tempo-provider";
import { Zap } from "lucide-react";

type Tab = "race" | "migration";

export default function Home() {
  const { isConnected } = useAccount();
  const { address: tempoAddress } = useTempoWallet();
  const [allFunded, setAllFunded] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("race");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const bothConnected = isConnected && !!tempoAddress;

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 py-3">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="size-4 text-[var(--tempo-primary)]" />
            <span className="font-mono text-sm font-medium tracking-widest uppercase text-[var(--text-primary)]">
              Pay Across Chains
            </span>
          </div>
          <ConnectButton
            showBalance={false}
            chainStatus="icon"
            accountStatus="address"
          />
        </div>
      </header>

      {/* Pill Tabs */}
      <div className="border-b border-[var(--border)] px-4 py-2">
        <div className="mx-auto max-w-5xl flex gap-2">
          {(["race", "migration"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-1.5 rounded-sm font-mono text-xs uppercase tracking-wider transition-all ${
                activeTab === tab
                  ? "bg-[var(--bg-raised)] text-[var(--tempo-bright)] border border-[var(--tempo-primary)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text-secondary)] border border-transparent"
              }`}
            >
              {tab === "race" ? "The Race" : "Migration Patterns"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-4">
        <div className="mx-auto max-w-5xl py-8">
          {activeTab === "race" ? (
            !mounted || !isConnected ? (
              /* Hero — not connected */
              <div className="relative flex flex-col items-center justify-center py-32 text-center dot-grid rounded-sm">
                <div className="glass-card rounded-sm px-12 py-10 max-w-lg mx-auto space-y-6">
                  <h1 className="font-mono text-2xl font-medium tracking-[0.2em] uppercase text-[var(--text-primary)]">
                    Pay Across Chains
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)]">
                    One payment. Three chains. One winner.
                  </p>
                  <ConnectButton />
                  <p className="text-xs text-[var(--text-dim)] font-mono">
                    Real mainnet transactions. Real fees. Real explorer links.
                  </p>
                </div>
              </div>
            ) : (
              /* Connected — show Tempo connect + funding + race */
              <div className="space-y-6">
                <TempoConnect />
                <FundingChecklist
                  onAllFunded={setAllFunded}
                  tempoAddress={tempoAddress}
                />
                <RaceForm
                  allFunded={allFunded && bothConnected}
                  tempoAddress={tempoAddress}
                />
              </div>
            )
          ) : (
            <MigrationCards />
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-3 px-4">
        <div className="mx-auto max-w-5xl flex items-center justify-between text-xs text-[var(--text-dim)] font-mono">
          <span>Built for Tempo SE Interview</span>
          <span>All transactions on mainnet</span>
        </div>
      </footer>
    </div>
  );
}
