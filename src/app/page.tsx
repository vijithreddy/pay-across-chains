"use client";

import { useState, useSyncExternalStore } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { FundingChecklist } from "@/components/funding-checklist";
import { RaceForm } from "@/components/race-form";
import { MigrationCards } from "@/components/migration-cards";
import { TempoConnect } from "@/components/tempo-connect";
import { RaceTrack } from "@/components/race-track";
import { useTempoWallet } from "@/components/tempo-provider";
import { Zap } from "lucide-react";
import { mainnet, base } from "wagmi/chains";
import { tempo } from "viem/chains";
import type { ChainRaceState } from "@/lib/race-engine";
import type { Tab } from "@/types";

// Idle states for the hero preview track
function makeIdleStates(): Record<number, ChainRaceState> {
  return {
    [mainnet.id]: { chainId: mainnet.id, name: "Ethereum", state: "idle" },
    [base.id]: { chainId: base.id, name: "Base", state: "idle" },
    [tempo.id]: { chainId: tempo.id, name: "Tempo", state: "idle" },
  };
}

export default function Home() {
  const { isConnected } = useAccount();
  const { address: tempoAddress } = useTempoWallet();
  const [allFunded, setAllFunded] = useState(false);
  const [raceStarted, setRaceStarted] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("race");
  // useSyncExternalStore avoids the cascading setState-in-useEffect pattern.
  // Returns false on server, true on client — no double render.
  const mounted = useSyncExternalStore(() => () => {}, () => true, () => false);
  const dryRun = useSyncExternalStore(
    () => () => {},
    () => typeof window !== "undefined" && window.location.search.includes("dry"),
    () => false
  );

  const bothConnected = isConnected && !!tempoAddress;
  const showHero = !mounted || (!isConnected && !dryRun);

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
          {/* Hide wallet buttons on hero screen */}
          {!showHero && (
            <div className="flex items-center gap-3">
              {mounted && tempoAddress && (
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(tempoAddress);
                  }}
                  title="Click to copy address"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-sm border border-[var(--tempo-primary)] bg-[var(--tempo-dim)] hover:bg-[var(--tempo-primary)]/15 transition-colors cursor-pointer"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--tempo-primary)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--tempo-primary)]" />
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--tempo-bright)]">
                    Tempo
                  </span>
                  <span className="font-mono text-[10px] text-[var(--text-secondary)]">
                    {tempoAddress.slice(0, 6)}...{tempoAddress.slice(-4)}
                  </span>
                </button>
              )}
              <ConnectButton
                showBalance={false}
                chainStatus="icon"
                accountStatus="address"
              />
            </div>
          )}
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
            showHero ? (
              /* ========== HERO — SPLIT LAYOUT ========== */
              <div className="diagonal-grid min-h-[70vh] flex items-center">
                <div className="w-full grid grid-cols-1 lg:grid-cols-[1fr_0.7fr] gap-12 items-center">
                  {/* Left: Introduction */}
                  <div className="space-y-6">
                    {/* Eyebrow */}
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--success)] opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--success)]" />
                      </span>
                      <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-[var(--success)]">
                        Mainnet &middot; Live
                      </span>
                    </div>

                    {/* Title */}
                    <h1 className="font-mono text-3xl lg:text-4xl font-medium tracking-[0.15em] uppercase text-[var(--text-primary)] leading-tight">
                      Pay Across<br />Chains
                    </h1>

                    {/* Subtitle */}
                    <p className="text-sm text-[var(--text-secondary)]">
                      Same payment. Ethereum. Base. Tempo. Watch who wins.
                    </p>

                    {/* Chain badges */}
                    <div className="flex gap-2">
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[var(--eth-primary)]/30 bg-[var(--eth-dim)] font-mono text-[10px] uppercase tracking-wider text-[var(--eth-primary)]">
                        <span>&#x2B21;</span> Ethereum
                      </span>
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[var(--base-primary)]/30 bg-[var(--base-dim)] font-mono text-[10px] uppercase tracking-wider text-[var(--base-primary)]">
                        <span>&#x25CE;</span> Base
                      </span>
                      <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm border border-[var(--tempo-primary)]/30 bg-[var(--tempo-dim)] font-mono text-[10px] uppercase tracking-wider text-[var(--tempo-primary)]">
                        <span>&#x26A1;</span> Tempo
                      </span>
                    </div>

                    {/* Connect button */}
                    <button
                      onClick={() => {
                        const btn = document.querySelector("[data-testid='rk-connect-button']") as HTMLButtonElement;
                        btn?.click();
                      }}
                      className="w-full rounded-sm bg-[var(--tempo-primary)] hover:bg-[var(--tempo-bright)] text-white font-mono text-xs uppercase tracking-[0.15em] py-3.5 transition-all"
                    >
                      Connect Wallet to Start &rarr;
                    </button>
                    {/* Hidden RainbowKit button */}
                    <div className="hidden"><ConnectButton /></div>
                  </div>

                  {/* Right: Idle race track preview */}
                  <div className="hidden lg:block opacity-40">
                    <RaceTrack chainStates={makeIdleStates()} />
                  </div>
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
