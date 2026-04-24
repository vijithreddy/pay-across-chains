"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { isAddress } from "viem";
import { mainnet, base } from "wagmi/chains";
import { tempo, CHAIN_NAMES, CHAIN_COLORS } from "@/lib/chains";
import { startRace, startDryRace, type ChainRaceState, type TxState } from "@/lib/race-engine";
import { useTempoWallet } from "./tempo-provider";
import { RaceTrack } from "./race-track";
import { ResultsTable } from "./results-table";
import { Loader2, Zap, CheckCircle2, ArrowLeft } from "lucide-react";
import confetti from "canvas-confetti";

const CHAIN_IDS = [mainnet.id, base.id, tempo.id] as const;

const CHAIN_BORDER_CLASSES: Record<number, string> = {
  [mainnet.id]: "chain-border-eth",
  [base.id]: "chain-border-base",
  [tempo.id]: "chain-border-tempo",
};

function makeInitialStates(): Record<number, ChainRaceState> {
  const states: Record<number, ChainRaceState> = {};
  for (const id of CHAIN_IDS) {
    states[id] = { chainId: id, name: CHAIN_NAMES[id as keyof typeof CHAIN_NAMES], state: "idle" };
  }
  return states;
}

function formatTimer(ms: number): string {
  const secs = Math.floor(ms / 1000);
  const frac = Math.floor((ms % 1000) / 10);
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}.${frac.toString().padStart(2, "0")}`;
}

function LiveTimer({ startTime, frozen }: { startTime?: number; frozen?: number }) {
  const [now, setNow] = useState(0);
  useEffect(() => {
    if (!startTime || frozen) return;
    const id = setInterval(() => setNow(performance.now()), 16);
    return () => clearInterval(id);
  }, [startTime, frozen]);

  if (!startTime) return <span className="text-[var(--text-dim)]">--:--.--</span>;
  const elapsed = (frozen ?? now) - startTime;
  return <span>{formatTimer(elapsed)}</span>;
}

function SigningStatus({ chainStates }: { chainStates: Record<number, ChainRaceState> }) {
  return (
    <div className="space-y-2 border border-[var(--border)] rounded-sm bg-[var(--bg-surface)] p-4">
      <div className="text-[10px] font-mono uppercase tracking-[0.15em] text-[var(--text-dim)] mb-3">
        Awaiting Signatures
      </div>
      {CHAIN_IDS.map((id) => {
        const cs = chainStates[id];
        const color = CHAIN_COLORS[id as keyof typeof CHAIN_COLORS];
        const name = CHAIN_NAMES[id as keyof typeof CHAIN_NAMES];
        const isSigning = cs?.state === "signing";
        const isSigned = cs?.state === "signed" || cs?.state === "racing" || cs?.state === "confirmed";
        return (
          <div
            key={id}
            className={`${CHAIN_BORDER_CLASSES[id]} flex items-center justify-between px-4 py-3 rounded-sm border transition-all ${
              isSigned
                ? "border-[var(--success)]/20 bg-[var(--success)]/5"
                : isSigning
                  ? "border-[var(--tempo-primary)]/30 bg-[var(--tempo-dim)]"
                  : "border-[var(--border)] bg-[var(--bg-base)]"
            }`}
          >
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-sm font-mono text-[var(--text-primary)]">{name}</span>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono">
              {isSigning && (
                <>
                  <Loader2 className="size-3.5 animate-spin" style={{ color }} />
                  <span style={{ color }}>SIGNING</span>
                </>
              )}
              {isSigned && (
                <>
                  <CheckCircle2 className="size-3.5 text-[var(--success)]" />
                  <span className="text-[var(--success)]">SIGNED</span>
                </>
              )}
              {!isSigning && !isSigned && cs?.state !== "error" && (
                <span className="text-[var(--text-dim)] uppercase">Waiting</span>
              )}
              {cs?.state === "error" && (
                <span className="text-[var(--destructive)] truncate max-w-48">
                  {cs.error ?? "Failed"}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

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
  const [phase, setPhase] = useState<"idle" | "signing" | "racing" | "done">("idle");
  const [chainStates, setChainStates] = useState(makeInitialStates);
  const confettiFired = useRef(false);

  const handleUpdate = useCallback(
    (chainId: number, update: Partial<ChainRaceState>) => {
      setChainStates((prev) => ({
        ...prev,
        [chainId]: { ...prev[chainId], ...update },
      }));
      if (update.state === "racing") setPhase("racing");
      if (update.state === "confirmed" && chainId === tempo.id && !confettiFired.current) {
        confettiFired.current = true;
        confetti({ particleCount: 150, spread: 80, origin: { y: 0.4 }, colors: ["#7C3AED", "#A78BFA"] });
      }
    },
    []
  );

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
      if (dryRun) {
        await startDryRace({
          recipient: (recipient || "0xDEAD000000000000000000000000000000000000") as `0x${string}`,
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
      if (process.env.NODE_ENV === "development") console.error("[race] Error:", err);
    }
    setRacing(false);
    setPhase("done");
  };

  const allDone = CHAIN_IDS.every(
    (id) => chainStates[id]?.state === "confirmed" || chainStates[id]?.state === "error"
  );
  const isSigning = phase === "signing" && !allDone;
  const isRacing = phase === "racing" && !allDone;

  return (
    <div className="space-y-4">
      {/* Back button */}
      {phase === "idle" && onBack && (
        <button
          onClick={onBack}
          className="flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] hover:text-[var(--text-secondary)] transition-colors"
        >
          <ArrowLeft className="size-3" /> Back to checklist
        </button>
      )}

      {/* Compact payment form — single row */}
      {phase === "idle" && (
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
                className="w-full rounded-sm border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-primary)] font-mono placeholder:text-[var(--text-dim)] focus:border-[var(--tempo-primary)] focus:outline-none transition-colors"
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-1">
                Amount
              </label>
              <div className="rounded-sm border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-secondary)] font-mono">
                {amount} USDC
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-mono uppercase tracking-wider text-[var(--text-dim)] mb-1">
                Memo
                <span className="ml-1.5 px-1.5 py-0.5 rounded-sm text-[8px] bg-[var(--tempo-dim)] text-[var(--tempo-bright)] border border-[var(--tempo-primary)]/30">
                  TEMPO EXCLUSIVE
                </span>
              </label>
              <div className="rounded-sm border border-[var(--border)] bg-[var(--bg-raised)] px-3 py-2 text-sm text-[var(--text-secondary)] font-mono truncate">
                {memo}
              </div>
            </div>
          </div>

          <button
            onClick={handleStart}
            disabled={!allFunded || !recipient || racing}
            className="w-full rounded-sm bg-[var(--tempo-primary)] hover:bg-[var(--tempo-bright)] text-white font-mono text-sm uppercase tracking-wider h-11 transition-all disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            <Zap className="size-4" />
            Send on All Three
          </button>
        </div>
      )}

      {/* Signing phase */}
      {isSigning && <SigningStatus chainStates={chainStates} />}

      {/* Race track */}
      {(isRacing || allDone) && <RaceTrack chainStates={chainStates} />}

      {/* Status cards during racing */}
      {isRacing && (
        <div className="grid grid-cols-3 gap-2">
          {CHAIN_IDS.map((id) => {
            const cs = chainStates[id];
            const color = CHAIN_COLORS[id as keyof typeof CHAIN_COLORS];
            const isConfirmed = cs?.state === "confirmed";
            return (
              <div
                key={id}
                className={`${CHAIN_BORDER_CLASSES[id]} rounded-sm border bg-[var(--bg-surface)] px-3 py-3 transition-all ${
                  isConfirmed ? "border-[var(--success)]/30" : "border-[var(--border)]"
                }`}
                style={isConfirmed ? { boxShadow: `0 0 12px 1px ${color}22` } : undefined}
              >
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                  <span className="font-mono text-[10px] uppercase tracking-wider" style={{ color }}>
                    {CHAIN_NAMES[id as keyof typeof CHAIN_NAMES]}
                  </span>
                </div>
                <div
                  className="font-mono text-xl timer-display"
                  style={{ color: isConfirmed ? "var(--success)" : "var(--text-primary)" }}
                >
                  <LiveTimer startTime={cs?.startTime} frozen={isConfirmed ? cs?.endTime : undefined} />
                </div>
                <div className="font-mono text-[9px] uppercase tracking-wider mt-1 text-[var(--text-dim)]">
                  {cs?.state === "racing" ? "CONFIRMING" : cs?.state?.toUpperCase() ?? "IDLE"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Results */}
      {allDone && <ResultsTable chainStates={chainStates} />}

      {/* Race again */}
      {allDone && (
        <button
          onClick={() => {
            setChainStates(makeInitialStates());
            setPhase("idle");
            confettiFired.current = false;
          }}
          className="w-full rounded-sm border border-[var(--border)] bg-[var(--bg-surface)] hover:border-[var(--border-bright)] text-[var(--text-secondary)] font-mono text-xs uppercase tracking-wider h-10 transition-all"
        >
          Race Again
        </button>
      )}
    </div>
  );
}
