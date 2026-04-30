"use client";

import { useState, useSyncExternalStore } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import { FundingChecklist } from "@/components/funding-checklist";
import { RaceForm } from "@/components/race-form";
import { MigrationCards } from "@/components/migration-cards";
import { TempoConnect } from "@/components/tempo-connect";
import { useTempoWallet } from "@/components/tempo-provider";
import { Zap } from "lucide-react";
import { mainnet, base } from "wagmi/chains";
import { tempo } from "viem/chains";
import type { Tab } from "@/types";

/** Main app page — routes between hero, funding checklist, race screen, and migration cards */
export default function Home() {
  const { isConnected } = useAccount();
  const { address: tempoAddress } = useTempoWallet();
  const [allFunded, setAllFunded] = useState(false);
  const [raceStarted, setRaceStarted] = useState(false);
  // Toggle chains on/off — Tempo always on, Eth/Base can be disabled to save gas
  const [enabledChains, setEnabledChains] = useState<Set<number>>(
    () => new Set([mainnet.id, base.id, tempo.id])
  );
  const [activeTab, setActiveTab] = useState<Tab>("race");
  // useSyncExternalStore: false on server, true on client — no cascading renders
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false
  );
  const dryRun = useSyncExternalStore(
    () => () => {},
    () =>
      typeof window !== "undefined" && window.location.search.includes("dry"),
    () => false
  );

  const bothConnected = isConnected && !!tempoAddress;
  const showHero = !mounted || (!isConnected && !dryRun);

  return (
    <div className="flex flex-col flex-1">
      {/* Header */}
      <header className="border-b border-[var(--border)] px-6 py-3">
        <div className="mx-auto max-w-5xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="size-5 text-[var(--tempo-bright)]" />
            <span className="font-[var(--font-bricolage)] text-lg font-bold text-white">
              Pay Across Chains
            </span>
          </div>
          {!showHero && (
            <div className="flex items-center gap-3">
              {/* Tempo account pill in header */}
              {mounted && tempoAddress && (
                <button
                  onClick={() => navigator.clipboard.writeText(tempoAddress)}
                  title="Click to copy Tempo address"
                  className="pill-gradient bg-[var(--bg-raised)] border-[var(--tempo-primary)]/30 text-[var(--tempo-bright)] cursor-pointer"
                >
                  <span className="relative flex h-2 w-2">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--tempo-primary)] opacity-75" />
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--tempo-primary)]" />
                  </span>
                  <span className="text-xs font-medium">Tempo</span>
                  <span className="text-xs text-[var(--text-dim)] font-mono">
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

      {/* Tabs */}
      <div className="border-b border-[var(--border)] px-6 py-2">
        <div className="mx-auto max-w-5xl flex gap-1">
          {(["race", "migration"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab
                  ? "bg-[var(--bg-raised)] text-white border border-[var(--border-bright)]"
                  : "text-[var(--text-dim)] hover:text-[var(--text-secondary)] border border-transparent"
              }`}
            >
              {tab === "race" ? "The Race" : "Migration Patterns"}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1">
        {activeTab === "race" ? (
          showHero ? (
            /* ========== HERO — Living mesh gradient ========== */
            <div className="mesh-gradient min-h-[85vh] flex items-center justify-center px-6">
              <div className="relative z-10 text-center max-w-2xl mx-auto space-y-8">
                {/* Heading */}
                <h1 className="font-[var(--font-bricolage)] text-5xl md:text-6xl font-extrabold text-white leading-[1.1]">
                  Pay Across Chains
                </h1>

                {/* Subtext */}
                <p className="text-lg text-[var(--text-secondary)] max-w-md mx-auto">
                  The same payment. Three chains. Watch Tempo win.
                </p>

                {/* Chain badges */}
                <div className="flex justify-center gap-3">
                  <span
                    className="pill-gradient border-[var(--eth-primary)]/40 text-[var(--eth-primary)]"
                    style={{ background: "var(--bg-raised)" }}
                  >
                    <span>&#x2B21;</span> Ethereum
                  </span>
                  <span
                    className="pill-gradient border-[var(--base-primary)]/40 text-[var(--base-primary)]"
                    style={{ background: "var(--bg-raised)" }}
                  >
                    <span>&#x25CE;</span> Base
                  </span>
                  <span
                    className="pill-gradient border-[var(--tempo-primary)]/40 text-[var(--tempo-primary)]"
                    style={{ background: "var(--bg-raised)" }}
                  >
                    <span>&#x26A1;</span> Tempo
                  </span>
                </div>

                {/* Connect CTA */}
                <div className="space-y-3">
                  <button
                    onClick={() => {
                      const btn = document.querySelector(
                        "[data-testid='rk-connect-button']"
                      ) as HTMLButtonElement;
                      btn?.click();
                    }}
                    className="btn-tempo rounded-xl px-10 py-4 text-base font-semibold mx-auto block"
                  >
                    Connect Wallet
                  </button>
                  <div className="hidden">
                    <ConnectButton />
                  </div>
                  <p className="text-sm text-[var(--text-dim)]">
                    Real transactions on mainnet
                  </p>
                </div>
              </div>
            </div>
          ) : !raceStarted && !dryRun ? (
            /* Funding checklist screen */
            <div className="px-6 py-10">
              <div className="mx-auto max-w-lg space-y-6">
                {!tempoAddress && <TempoConnect />}
                <FundingChecklist
                  onAllFunded={setAllFunded}
                  tempoAddress={tempoAddress}
                  enabledChains={enabledChains}
                  onToggleChain={(chainId) => {
                    // Tempo cannot be disabled — it's the whole point
                    if (chainId === tempo.id) return;
                    setEnabledChains((prev) => {
                      const next = new Set(prev);
                      if (next.has(chainId)) next.delete(chainId);
                      else next.add(chainId);
                      return next;
                    });
                  }}
                />
                {allFunded && bothConnected && (
                  <button
                    onClick={() => setRaceStarted(true)}
                    className="btn-tempo w-full rounded-xl py-4 text-base font-bold"
                  >
                    Start the Race &rarr;
                  </button>
                )}
                {(!allFunded || !bothConnected) && (
                  <p className="text-sm text-[var(--text-dim)] text-center">
                    {!tempoAddress
                      ? "Connect Tempo Wallet to continue"
                      : "Fund all chains to unlock the race"}
                  </p>
                )}
              </div>
            </div>
          ) : (
            /* Race screen */
            <div className="px-6 py-8">
              <div className="mx-auto max-w-5xl space-y-4">
                <RaceForm
                  allFunded={true}
                  tempoAddress={tempoAddress}
                  onBack={() => setRaceStarted(false)}
                  dryRun={dryRun}
                  enabledChains={enabledChains}
                />
              </div>
            </div>
          )
        ) : (
          <div className="px-6 py-10">
            <div className="mx-auto max-w-3xl">
              <MigrationCards />
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--border)] py-4 px-6">
        <div className="mx-auto max-w-5xl flex justify-end">
          <span className="text-xs text-[var(--text-dim)]">
            All transactions settle on mainnet
          </span>
        </div>
      </footer>
    </div>
  );
}
