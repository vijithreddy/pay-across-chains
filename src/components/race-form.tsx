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
import { Zap, ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";

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
}: {
  allFunded: boolean;
  tempoAddress?: `0x${string}`;
  onBack?: () => void;
  dryRun?: boolean;
}) {
  const { address } = useAccount();
  const { client: tempoClient } = useTempoWallet();
  const [recipient, setRecipient] = useState("");
  const [amount] = useState("1");
  const [memo] = useState("Invoice #1042 \u2014 Demo Payment");
  const [racing, setRacing] = useState(false);
  const [phase, setPhase] = useState<"idle" | "signing" | "racing" | "done">(
    "idle"
  );
  const [chainStates, setChainStates] = useState(makeInitialStates);
  const confettiFired = useRef(false);

  /** Handles state updates from the race engine for each chain */
  const handleUpdate = useCallback(
    (chainId: number, update: Partial<ChainRaceState>) => {
      setChainStates((prev) => ({
        ...prev,
        [chainId]: { ...prev[chainId], ...update },
      }));
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
    confettiFired.current = false;
    setChainStates(makeInitialStates());
    try {
      // Dry run uses mock timing; real run uses actual wallet signing
      if (dryRun) {
        await startDryRace({
          recipient: (recipient || DRY_RUN_RECIPIENT) as `0x${string}`,
          amount,
          memo,
          onUpdate: handleUpdate,
        });
      } else {
        await startRace({
          recipient: recipient as `0x${string}`,
          amount,
          memo,
          account: address!,
          tempoClient,
          onUpdate: handleUpdate,
        });
      }
    } catch (err) {
      // Race can fail if user rejects a wallet prompt or RPC is down
      if (process.env.NODE_ENV === "development")
        console.error("[race] Error:", err);
    }
    setRacing(false);
    setPhase("done");
  };

  const allDone = CHAIN_IDS.every(
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
        />
      )}
      {isSigning && <SigningStatus chainStates={chainStates} />}
      {(isRacing || allDone) && <RaceTrack chainStates={chainStates} />}
      {isRacing && <StatusCards chainStates={chainStates} />}
      {allDone && <ResultsTable chainStates={chainStates} />}
      {allDone && (
        <button
          onClick={() => {
            setChainStates(makeInitialStates());
            setPhase("idle");
            confettiFired.current = false;
          }}
          className="w-full rounded-xl border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-bright)] text-[var(--text-secondary)] font-mono text-xs uppercase tracking-wider h-10 transition-all"
        >
          Race Again
        </button>
      )}
    </div>
  );
}

/** Compact single-row payment form with recipient, amount, and memo fields */
function PaymentForm({
  recipient,
  setRecipient,
  amount,
  memo,
  allFunded,
  racing,
  onStart,
  tempoAddress,
}: {
  recipient: string;
  setRecipient: (v: string) => void;
  amount: string;
  memo: string;
  allFunded: boolean;
  racing: boolean;
  onStart: () => void;
  tempoAddress?: `0x${string}`;
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
