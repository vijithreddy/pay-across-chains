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
  const [raceStarted, setRaceStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("race");
  const [mounted, setMounted] = useState(false);
  const [dryRun, setDryRun] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (typeof window !== "undefined" && window.location.search.includes("dry")) {
      setDryRun(true);
    }
  }, []);

  const bothConnected = isConnected && !!tempoAddress;

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-4 py-2.5">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="size-4 text-[var(--tempo-primary)]" />
            <span className="font-mono text-sm font-medium tracking-widest uppercase text-[var(--text-primary)]">
              Pay Across Chains
            </span>
          </div>
          <div className="flex items-center gap-3">
            {/* Tempo account pill */}
            {mounted && tempoAddress && (
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-[var(--tempo-primary)] bg-[var(--tempo-dim)]">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--tempo-primary)] opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--tempo-primary)]" />
                </span>
                <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--tempo-bright)]">
                  Tempo
                </span>
                <span className="font-mono text-[10px] text-[var(--text-dim)]">
                  {tempoAddress.slice(0, 6)}...{tempoAddress.slice(-4)}
                </span>
              </div>
            )}
            {/* RainbowKit MetaMask button */}
            <ConnectButton
              showBalance={false}
              chainStatus="icon"
              accountStatus="address"
            />
          </div>
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
            !mounted || (!isConnected && !dryRun) ? (
              /* Hero — not connected */
              <div
                className="relative flex flex-col items-center justify-center py-32 text-center rounded-sm"
                style={{
                  background: "radial-gradient(ellipse at center, var(--tempo-dim) 0%, var(--bg-base) 70%)",
                }}
              >
                <div className="glass-card rounded-sm px-12 py-10 max-w-lg mx-auto space-y-6">
                  <h1 className="font-mono text-2xl font-medium tracking-[0.2em] uppercase text-[var(--text-primary)]">
                    Pay Across Chains
                  </h1>
                  <p className="text-sm text-[var(--text-secondary)]">
                    One payment. Three chains. One winner.
                  </p>
                  <button
                    onClick={() => {
                      const btn = document.querySelector("[data-testid='rk-connect-button']") as HTMLButtonElement;
                      btn?.click();
                    }}
                    className="w-full rounded-sm bg-[var(--tempo-primary)] hover:bg-[var(--tempo-bright)] text-white font-mono text-xs uppercase tracking-wider py-3 transition-all"
                  >
                    Connect Wallet
                  </button>
                  {/* Hidden RainbowKit button */}
                  <div className="hidden"><ConnectButton /></div>
                  <p className="text-[10px] text-[var(--text-dim)] font-mono">
                    Real mainnet transactions &middot; Real fees &middot; Real explorer links
                  </p>
                </div>
              </div>
            ) : !raceStarted && !dryRun ? (
              /* Funding checklist screen */
              <div className="space-y-6">
                {!tempoAddress && <TempoConnect />}
                <FundingChecklist
                  onAllFunded={setAllFunded}
                  tempoAddress={tempoAddress}
                />
                {allFunded && bothConnected && (
                  <button
                    onClick={() => setRaceStarted(true)}
                    className="w-full rounded-sm bg-[var(--tempo-primary)] hover:bg-[var(--tempo-bright)] text-white font-mono text-sm uppercase tracking-wider h-12 transition-all flex items-center justify-center gap-2"
                  >
                    Start the Race &rarr;
                  </button>
                )}
                {(!allFunded || !bothConnected) && (
                  <p className="text-[10px] font-mono text-[var(--text-dim)] text-center uppercase tracking-wider">
                    {!tempoAddress
                      ? "Connect Tempo Wallet to continue"
                      : "Fund all chains to unlock the race"}
                  </p>
                )}
              </div>
            ) : (
              /* Race screen */
              <div className="space-y-4">
                <RaceForm
                  allFunded={true}
                  tempoAddress={tempoAddress}
                  onBack={() => setRaceStarted(false)}
                  dryRun={dryRun}
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
        <div className="mx-auto max-w-5xl flex justify-end">
          <span className="text-[10px] text-[var(--text-dim)] font-mono">
            All transactions settle on mainnet
          </span>
        </div>
      </footer>
    </div>
  );
}
