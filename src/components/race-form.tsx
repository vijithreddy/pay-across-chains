"use client";

import { useState, useCallback, useRef } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { tempo, CHAIN_IDS, CHAIN_NAMES } from "@/lib/chains";
import {
  startRace,
  startDryRace,
  type ChainRaceState,
} from "@/lib/race-engine";
import { useTempoWallet } from "./tempo-provider";
import { SigningStatus } from "./signing-status";
import { StatusCards } from "./status-cards";
import { RaceTrack } from "./race-track";
import { ResultsTable } from "./results-table";
import { Zap, ArrowLeft, Check, Share2 } from "lucide-react";
import confetti from "canvas-confetti";
import { SponsorToggle } from "./sponsor-toggle";
import type { RaceResult } from "@/types";

const CONFETTI_CONFIG = {
  particleCount: 150,
  spread: 80,
  origin: { y: 0.4 },
  colors: ["#7C3AED", "#A78BFA"],
};
const DRY_RUN_RECIPIENT =
  "0xDEAD000000000000000000000000000000000000" as `0x${string}`;

/** Creates idle chain states for initializing the race */
function makeInitialStates(): Record<number, ChainRaceState> {
  const states: Record<number, ChainRaceState> = {};
  for (const id of CHAIN_IDS) {
    states[id] = {
      chainId: id,
      name: CHAIN_NAMES[id as keyof typeof CHAIN_NAMES],
      state: "idle",
    };
  }
  return states;
}

/** Orchestrates the 3-chain race: form input, signing, track animation, results */
export function RaceForm({
  allFunded,
  tempoAddress,
  onBack,
  dryRun,
  enabledChains,
}: {
  allFunded: boolean;
  tempoAddress?: `0x${string}`;
  onBack?: () => void;
  dryRun?: boolean;
  enabledChains?: Set<number>;
}) {
  const { address } = useAccount();
  const { client: tempoClient } = useTempoWallet();
  const [recipient, setRecipient] = useState("");
  const [amount] = useState("1");
  const [memo] = useState("Invoice #1042 \u2014 Demo Payment");
  const [sponsored, setSponsored] = useState(false);
  const [raceError, setRaceError] = useState<string | null>(null);
  const [racing, setRacing] = useState(false);
  const [phase, setPhase] = useState<
    "idle" | "signing" | "waiting" | "racing" | "done"
  >("idle");
  const [chainStates, setChainStates] = useState(makeInitialStates);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const confettiFired = useRef(false);

  /** Handles state updates from the race engine for each chain */
  const handleUpdate = useCallback(
    (chainId: number, update: Partial<ChainRaceState>) => {
      setChainStates((prev) => ({
        ...prev,
        [chainId]: { ...prev[chainId], ...update },
      }));
      if (update.state === "waiting") setPhase("waiting");
      if (update.state === "racing") setPhase("racing");
      // Fire confetti when Tempo wins — it should always confirm first
      if (
        update.state === "confirmed" &&
        chainId === tempo.id &&
        !confettiFired.current
      ) {
        confettiFired.current = true;
        confetti(CONFETTI_CONFIG);
      }
    },
    []
  );

  /** Validates inputs, then runs the race (real or dry) */
  const handleStart = async () => {
    if (!dryRun && (!address || !recipient)) return;
    if (!dryRun && !isAddress(recipient)) {
      alert("Invalid recipient address");
      return;
    }
    if (!dryRun && (!tempoClient || !tempoAddress)) {
      alert("Please sign in to Tempo Wallet first");
      return;
    }
    setRacing(true);
    setPhase("signing");
    setRaceError(null);
    confettiFired.current = false;
    setChainStates(makeInitialStates());
    let raceResults: ChainRaceState[] = [];
    try {
      // Dry run uses mock timing; real run uses actual wallet signing
      if (dryRun) {
        raceResults = await startDryRace({
          recipient: (recipient || DRY_RUN_RECIPIENT) as `0x${string}`,
          amount,
          memo,
          enabledChains,
          sponsored,
          onUpdate: handleUpdate,
        });
      } else {
        raceResults = await startRace({
          recipient: recipient as `0x${string}`,
          amount,
          memo,
          account: address!,
          tempoClient,
          enabledChains,
          sponsored,
          onUpdate: handleUpdate,
        });
      }
    } catch (err) {
      // Show error visually — don't swallow silently
      const msg = err instanceof Error ? err.message : "Unknown error";
      setRaceError(msg);
      console.error("[race] Error:", err);
    }
    setRacing(false);
    setPhase("done");

    // Auto-save using the returned results (not React state which hasn't re-rendered yet)
    if (raceResults.length > 0) {
      saveRaceResult(raceResults, recipient || DRY_RUN_RECIPIENT, amount, memo);
    }
  };

  /** Saves the completed race to the API and generates a share URL */
  const saveRaceResult = async (
    results: ChainRaceState[],
    raceRecipient: string,
    raceAmount: string,
    raceMemo: string
  ) => {
    try {
      const id = crypto.randomUUID().slice(0, 8);
      const chains = results.map((cs) => ({
        chainId: cs.chainId,
        name: cs.name,
        elapsedMs: cs.elapsedMs ?? 0,
        feeDisplay: cs.feeDisplay ?? "",
        feeToken: cs.feeToken ?? "",
        hash: cs.hash ?? "",
        state: (cs.state === "confirmed" ? "confirmed" : "error") as
          | "confirmed"
          | "error",
        error: cs.error,
      }));
      const winner =
        chains
          .filter((c) => c.state === "confirmed")
          .sort((a, b) => a.elapsedMs - b.elapsedMs)[0]?.name ?? "None";

      const body: RaceResult = {
        id,
        timestamp: Date.now(),
        chains,
        winner,
        recipient: raceRecipient,
        amount: raceAmount,
        memo: raceMemo,
      };

      const res = await fetch("/api/race", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        setShareUrl(`${window.location.origin}/race/${id}`);
      }
    } catch {
      // Non-critical — race completed even if save fails
    }
  };

  // Only check enabled chains — disabled chains stay "idle" and should not block completion
  const activeChains = enabledChains
    ? CHAIN_IDS.filter((id) => enabledChains.has(id))
    : CHAIN_IDS;
  const allDone = activeChains.every(
    (id) =>
      chainStates[id]?.state === "confirmed" ||
      chainStates[id]?.state === "error"
  );
  const isSigning = phase === "signing" && !allDone;
  const isRacing = phase === "racing" && !allDone;

  return (
    <div className="space-y-4">
      {phase === "idle" && onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <ArrowLeft className="size-3" /> Back to checklist
        </button>
      )}

      {phase === "idle" && (
        <PaymentForm
          recipient={recipient}
          setRecipient={setRecipient}
          amount={amount}
          memo={memo}
          allFunded={allFunded}
          racing={racing}
          onStart={handleStart}
          tempoAddress={tempoAddress}
          sponsored={sponsored}
          setSponsored={setSponsored}
        />
      )}
      {isSigning && <SigningStatus chainStates={chainStates} />}

      {/* Waiting for confirmations — all signed, collecting results before replay */}
      {phase === "waiting" && (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="w-8 h-8 border-2 border-[var(--tempo-primary)] border-t-transparent rounded-full animate-spin" />
          <p className="text-sm text-[var(--text-secondary)]">
            Waiting for confirmations across all 3 chains...
          </p>
          <p className="text-xs text-[var(--text-dim)]">
            Race replay starts once all transactions confirm
          </p>
        </div>
      )}

      {/* Error banner — shows the actual error instead of swallowing silently */}
      {raceError && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 space-y-1">
          <p className="text-sm font-medium text-red-400">Race failed</p>
          <p className="text-xs text-red-400/80 font-mono break-all">
            {raceError}
          </p>
        </div>
      )}

      {(isRacing || allDone) && <RaceTrack chainStates={chainStates} />}
      {isRacing && <StatusCards chainStates={chainStates} />}
      {allDone && <ResultsTable chainStates={chainStates} />}

      {/* Share + Race Again buttons */}
      {allDone && (
        <div className="flex gap-3">
          {shareUrl && (
            <button
              onClick={() => {
                navigator.clipboard.writeText(shareUrl);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="flex-1 rounded-xl border border-[var(--border-bright)] bg-[var(--bg-raised)] text-[var(--text-secondary)] hover:text-white text-sm font-medium h-10 transition-all flex items-center justify-center gap-2"
            >
              {copied ? (
                <>
                  <Check className="size-4 text-[var(--success)]" /> Link Copied
                </>
              ) : (
                <>
                  <Share2 className="size-4" /> Share Results
                </>
              )}
            </button>
          )}
          <button
            onClick={() => {
              setChainStates(makeInitialStates());
              setPhase("idle");
              setShareUrl(null);
              confettiFired.current = false;
            }}
            className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-bright)] text-[var(--text-secondary)] text-sm font-medium h-10 transition-all"
          >
            Race Again
          </button>
        </div>
      )}
    </div>
  );
}

/** Compact single-row payment form with recipient, amount, memo, and sponsor toggle */
function PaymentForm({
  recipient,
  setRecipient,
  amount,
  memo,
  allFunded,
  racing,
  onStart,
  tempoAddress,
  sponsored,
  setSponsored,
}: {
  recipient: string;
  setRecipient: (v: string) => void;
  amount: string;
  memo: string;
  allFunded: boolean;
  racing: boolean;
  onStart: () => void;
  tempoAddress?: `0x${string}`;
  sponsored: boolean;
  setSponsored: (v: boolean) => void;
}) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-[1fr_120px_1fr] gap-2">
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-1">
            Recipient
          </label>
          <input
            type="text"
            value={recipient}
            onChange={(e) => setRecipient(e.target.value)}
            placeholder="0x..."
            className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-dim)] focus:border-[var(--tempo-primary)] focus:outline-none transition-colors"
          />
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-1">
            Amount
          </label>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-secondary)] font-mono">
            {amount} USDC
          </div>
        </div>
        <div>
          <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-1">
            Memo{" "}
            <span className="ml-1.5 px-1.5 py-0.5 rounded-xl text-[8px] bg-[var(--tempo-dim)] text-[var(--tempo-bright)] border border-[var(--tempo-primary)]/30">
              TEMPO EXCLUSIVE
            </span>
          </label>
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-secondary)] font-mono truncate">
            {memo}
          </div>
        </div>
      </div>

      {/* Sponsor toggle — Tempo exclusive feature */}
      <SponsorToggle sponsored={sponsored} setSponsored={setSponsored} />

      <button
        onClick={onStart}
        disabled={!allFunded || !recipient || racing}
        className="w-full rounded-xl bg-[var(--tempo-primary)] hover:bg-[var(--tempo-bright)] text-white font-mono text-sm uppercase tracking-wider h-11 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        <Zap className="size-4" /> Send on All Three
      </button>
      {!allFunded && (
        <p className="text-[10px] font-mono text-[var(--text-dim)] text-center uppercase tracking-wider">
          {!tempoAddress
            ? "Connect Tempo Wallet to unlock"
            : "Fund all chains to unlock"}
        </p>
      )}
    </div>
  );
}

