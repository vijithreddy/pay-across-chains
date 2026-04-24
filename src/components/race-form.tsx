"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { mainnet, base } from "wagmi/chains";
import { tempo, CHAIN_NAMES, CHAIN_COLORS } from "@/lib/chains";
import { startRace, type ChainRaceState, type TxState } from "@/lib/race-engine";
import { useTempoWallet } from "./tempo-provider";
import { RaceTrack } from "./race-track";
import { ResultsTable } from "./results-table";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, CheckCircle2 } from "lucide-react";
import confetti from "canvas-confetti";

const CHAIN_IDS = [mainnet.id, base.id, tempo.id] as const;

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

function LiveTimer({ startTime, frozen }: { startTime?: number; frozen?: number }) {
  const [now, setNow] = useState(performance.now());

  useEffect(() => {
    if (!startTime || frozen) return;
    const id = setInterval(() => setNow(performance.now()), 16);
    return () => clearInterval(id);
  }, [startTime, frozen]);

  if (!startTime) return <span className="text-zinc-600">—</span>;
  const elapsed = (frozen ?? now) - startTime;
  return (
    <span className="font-mono tabular-nums">
      {(elapsed / 1000).toFixed(2)}s
    </span>
  );
}

function SigningStatus({ chainStates }: { chainStates: Record<number, ChainRaceState> }) {
  return (
    <div className="space-y-3 rounded-2xl border border-zinc-800/50 bg-[#0a0a0f] p-5">
      <div className="text-sm font-medium text-zinc-400 mb-3">
        Sign each transaction — race starts after all 3 are signed
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
            className={`flex items-center justify-between rounded-xl border px-4 py-3.5 transition-colors duration-300 ${
              isSigned
                ? "border-emerald-500/20 bg-emerald-950/20"
                : isSigning
                  ? "border-purple-500/30 bg-purple-950/10"
                  : "border-zinc-800/40 bg-zinc-900/20"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm font-medium text-zinc-200">{name}</span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              {isSigning && (
                <>
                  <Loader2 className="size-4 animate-spin text-purple-400" />
                  <span className="text-purple-400">Awaiting signature...</span>
                </>
              )}
              {isSigned && (
                <>
                  <CheckCircle2 className="size-4 text-emerald-400" />
                  <span className="text-emerald-400">Signed</span>
                </>
              )}
              {!isSigning && !isSigned && cs?.state !== "error" && (
                <span className="text-zinc-600">Waiting</span>
              )}
              {cs?.state === "error" && (
                <span className="text-red-400 text-xs truncate max-w-48">
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
}: {
  allFunded: boolean;
  tempoAddress?: `0x${string}`;
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

      // Transition to racing phase when we see the first "racing" state
      if (update.state === "racing") {
        setPhase("racing");
      }

      // Fire confetti when Tempo confirms first
      if (update.state === "confirmed" && chainId === tempo.id && !confettiFired.current) {
        confettiFired.current = true;
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.4 },
          colors: ["#7C3AED", "#22c55e", "#a855f7"],
        });
      }
    },
    []
  );

  const handleStart = async () => {
    if (!address || !recipient) return;
    if (!tempoClient || !tempoAddress) {
      console.error("[race-form] Cannot start race: Tempo Wallet not connected");
      console.error("[race-form] tempoClient:", tempoClient, "tempoAddress:", tempoAddress);
      alert("Please sign in to Tempo Wallet first");
      return;
    }
    console.log("[race-form] Starting race...");
    console.log("[race-form] EVM address:", address);
    console.log("[race-form] tempoClient:", tempoClient);
    console.log("[race-form] tempoClient?.account:", (tempoClient as any)?.account);
    console.log("[race-form] tempoAddress:", tempoAddress);
    setRacing(true);
    setPhase("signing");
    confettiFired.current = false;
    setChainStates(makeInitialStates());

    try {
      await startRace({
        recipient: recipient as `0x${string}`,
        amount,
        memo,
        account: address,
        tempoClient,
        onUpdate: handleUpdate,
      });
    } catch (err) {
      console.error("[race-form] Race error:", err);
      // Signing was rejected — stay in current state to show error
    }

    setRacing(false);
    setPhase("done");
  };

  const allDone = CHAIN_IDS.every(
    (id) =>
      chainStates[id]?.state === "confirmed" ||
      chainStates[id]?.state === "error"
  );

  const hasError = CHAIN_IDS.some((id) => chainStates[id]?.state === "error");
  const isSigning = phase === "signing" && !allDone;
  const isRacing = phase === "racing" && !allDone;

  return (
    <div className="space-y-6">
      {/* Signing Phase */}
      {isSigning && <SigningStatus chainStates={chainStates} />}

      {/* Race Track — show during racing and results */}
      {(isRacing || allDone) && <RaceTrack chainStates={chainStates} />}

      {/* Live Timers — only during racing phase */}
      {isRacing && (
        <div className="grid grid-cols-3 gap-3">
          {CHAIN_IDS.map((id) => {
            const cs = chainStates[id];
            const color = CHAIN_COLORS[id as keyof typeof CHAIN_COLORS];
            const isConfirmed = cs?.state === "confirmed";
            return (
              <div
                key={id}
                className={`rounded-xl border px-4 py-3 text-center transition-colors duration-300 ${
                  isConfirmed
                    ? "border-emerald-500/20 bg-emerald-950/20"
                    : "border-zinc-800/40 bg-[#0a0a0f]"
                }`}
              >
                <div
                  className="text-xs font-medium mb-1"
                  style={{ color }}
                >
                  {CHAIN_NAMES[id as keyof typeof CHAIN_NAMES]}
                </div>
                <div className={`text-lg ${isConfirmed ? "text-emerald-400" : "text-zinc-100"}`}>
                  <LiveTimer
                    startTime={cs?.startTime}
                    frozen={isConfirmed ? cs?.endTime : undefined}
                  />
                </div>
                <div className="text-xs text-zinc-500 mt-1 capitalize">
                  {cs?.state === "racing" ? "confirming" : cs?.state ?? "idle"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Race Form */}
      {phase === "idle" && (
        <div className="space-y-4 rounded-2xl border border-zinc-800/50 bg-[#0a0a0f] p-5">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">
              Recipient Address
            </label>
            <input
              type="text"
              value={recipient}
              onChange={(e) => setRecipient(e.target.value)}
              placeholder="0x..."
              className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 font-mono placeholder:text-zinc-600 focus:border-purple-500 focus:outline-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Amount
              </label>
              <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 font-mono">
                {amount} USDC
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">
                Memo (Tempo only)
              </label>
              <div className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-300 font-mono truncate">
                {memo}
              </div>
            </div>
          </div>

          <Button
            onClick={handleStart}
            disabled={!allFunded || !recipient || racing}
            size="lg"
            className="w-full bg-purple-600 hover:bg-purple-500 text-white font-semibold h-12 text-base disabled:opacity-40"
          >
            <Zap className="size-5 mr-2" />
            Send on All Three
          </Button>
          {!allFunded && (
            <p className="text-xs text-zinc-500 text-center">
              {!tempoAddress
                ? "Connect Tempo Wallet above to unlock the race"
                : "Fund all chains above to unlock the race"}
            </p>
          )}
        </div>
      )}

      {/* Results */}
      {allDone && <ResultsTable chainStates={chainStates} />}

      {/* Race again */}
      {allDone && (
        <Button
          onClick={() => {
            setChainStates(makeInitialStates());
            setPhase("idle");
            confettiFired.current = false;
          }}
          variant="outline"
          className="w-full"
        >
          Race Again
        </Button>
      )}
    </div>
  );
}
