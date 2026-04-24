"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { useAccount } from "wagmi";
import { mainnet, base } from "wagmi/chains";
import { tempo, CHAIN_NAMES, CHAIN_COLORS } from "@/lib/chains";
import { startRace, type ChainRaceState, type TxState } from "@/lib/race-engine";
import { RaceTrack } from "./race-track";
import { ResultsTable } from "./results-table";
import { Button } from "@/components/ui/button";
import { Loader2, Zap } from "lucide-react";
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

export function RaceForm({ allFunded }: { allFunded: boolean }) {
  const { address } = useAccount();
  const [recipient, setRecipient] = useState("");
  const [amount] = useState("1");
  const [memo] = useState("Invoice #1042 \u2014 Demo Payment");
  const [racing, setRacing] = useState(false);
  const [chainStates, setChainStates] = useState(makeInitialStates);
  const confettiFired = useRef(false);

  const handleUpdate = useCallback(
    (chainId: number, update: Partial<ChainRaceState>) => {
      setChainStates((prev) => ({
        ...prev,
        [chainId]: { ...prev[chainId], ...update },
      }));

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
    setRacing(true);
    confettiFired.current = false;
    setChainStates(makeInitialStates());

    await startRace({
      recipient: recipient as `0x${string}`,
      amount,
      memo,
      account: address,
      onUpdate: handleUpdate,
    });

    setRacing(false);
  };

  const allDone = CHAIN_IDS.every(
    (id) =>
      chainStates[id]?.state === "confirmed" ||
      chainStates[id]?.state === "error"
  );

  return (
    <div className="space-y-6">
      {/* Race Track */}
      <RaceTrack chainStates={chainStates} />

      {/* Live Timers */}
      {racing && (
        <div className="grid grid-cols-3 gap-3">
          {CHAIN_IDS.map((id) => {
            const cs = chainStates[id];
            const color = CHAIN_COLORS[id as keyof typeof CHAIN_COLORS];
            const isConfirmed = cs?.state === "confirmed";
            return (
              <div
                key={id}
                className={`rounded-lg border px-4 py-3 text-center ${
                  isConfirmed
                    ? "border-emerald-500/50 bg-emerald-500/10"
                    : "border-zinc-800 bg-zinc-900/50"
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
                  {cs?.state ?? "idle"}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Race Form */}
      {!racing && !allDone && (
        <div className="space-y-4 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
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
              Fund all chains above to unlock the race
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
