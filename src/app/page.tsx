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
      <header className="border-b border-zinc-800/50 px-4 py-3.5">
        <div className="mx-auto max-w-4xl flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Zap className="size-5 text-purple-400" />
            <span className="font-semibold text-zinc-100 tracking-tight">
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

      {/* Tabs */}
      <div className="border-b border-zinc-800/50">
        <div className="mx-auto max-w-4xl flex gap-1">
          <button
            onClick={() => setActiveTab("race")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "race"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            The Race
          </button>
          <button
            onClick={() => setActiveTab("migration")}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === "migration"
                ? "border-purple-500 text-purple-400"
                : "border-transparent text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Migration Patterns
          </button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 py-8 px-4">
        <div className="mx-auto max-w-4xl">
          {activeTab === "race" ? (
            !mounted || !isConnected ? (
              /* Hero — not connected */
              <div className="flex flex-col items-center justify-center py-24 text-center space-y-6">
                <div className="space-y-3">
                  <h1 className="text-4xl font-bold tracking-tight">
                    Same Payment.{" "}
                    <span className="text-purple-400">Three Chains.</span>
                  </h1>
                  <p className="text-lg text-zinc-400 max-w-md mx-auto">
                    Send 1 USDC on Ethereum, Base, and Tempo simultaneously.
                    Watch Tempo finish in ~500ms.
                  </p>
                </div>
                <ConnectButton />
                <p className="text-xs text-zinc-600">
                  Real mainnet transactions. Real fees. Real explorer links.
                </p>
              </div>
            ) : (
              /* EVM connected — show Tempo connect + funding + race */
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
      <footer className="border-t border-zinc-800/50 py-4 px-4">
        <div className="mx-auto max-w-4xl flex items-center justify-between text-xs text-zinc-600">
          <span>Built for Tempo SE Interview</span>
          <span>All transactions on mainnet</span>
        </div>
      </footer>
    </div>
  );
}
