"use client";

import { motion } from "framer-motion";
import { CHAIN_COLORS, CHAIN_NAMES, tempo } from "@/lib/chains";
import type { ChainRaceState, TxState } from "@/lib/race-engine";
import { mainnet, base } from "wagmi/chains";

const CHAIN_IDS = [mainnet.id, base.id, tempo.id] as const;

function stateToProgress(state: TxState): number {
  switch (state) {
    case "idle":
      return 0;
    case "broadcasting":
      return 0.15;
    case "pending":
      return 0.5;
    case "confirmed":
      return 1;
    case "error":
      return 0;
  }
}

const LANE_Y = [60, 130, 200] as const;
const TRACK_WIDTH = 700;
const START_X = 60;
const FINISH_X = TRACK_WIDTH - 60;
const RUNNER_RADIUS = 16;

export function RaceTrack({
  chainStates,
}: {
  chainStates: Record<number, ChainRaceState>;
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950 p-4">
      <svg
        viewBox={`0 0 ${TRACK_WIDTH} 260`}
        className="w-full h-auto"
        role="img"
        aria-label="Race track showing transaction progress"
      >
        {/* Track background */}
        <rect
          x="40"
          y="30"
          width={TRACK_WIDTH - 80}
          height="210"
          rx="16"
          fill="#18181b"
          stroke="#27272a"
          strokeWidth="2"
        />

        {/* Finish line */}
        <line
          x1={FINISH_X}
          y1="30"
          x2={FINISH_X}
          y2="240"
          stroke="#3f3f46"
          strokeWidth="3"
          strokeDasharray="8 4"
        />
        <text
          x={FINISH_X}
          y="20"
          textAnchor="middle"
          fill="#71717a"
          fontSize="11"
          fontFamily="monospace"
        >
          FINISH
        </text>

        {/* Lanes */}
        {CHAIN_IDS.map((chainId, i) => {
          const cs = chainStates[chainId];
          const progress = cs ? stateToProgress(cs.state) : 0;
          const x =
            START_X + progress * (FINISH_X - START_X - RUNNER_RADIUS);
          const y = LANE_Y[i];
          const color =
            CHAIN_COLORS[chainId as keyof typeof CHAIN_COLORS];
          const name =
            CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];
          const isConfirmed = cs?.state === "confirmed";
          const isError = cs?.state === "error";

          return (
            <g key={chainId}>
              {/* Lane line */}
              <line
                x1={START_X}
                y1={y}
                x2={FINISH_X}
                y2={y}
                stroke="#27272a"
                strokeWidth="1"
              />

              {/* Chain label */}
              <text
                x={START_X - 8}
                y={y + 5}
                textAnchor="end"
                fill={color}
                fontSize="12"
                fontWeight="600"
                fontFamily="monospace"
              >
                {name}
              </text>

              {/* Runner */}
              <motion.circle
                cx={START_X}
                cy={y}
                r={RUNNER_RADIUS}
                fill={isError ? "#ef4444" : color}
                opacity={cs?.state === "idle" ? 0.4 : 1}
                animate={{ cx: x }}
                transition={{
                  type: "spring",
                  stiffness: 60,
                  damping: 20,
                  mass: 1,
                }}
              />

              {/* Timer label on runner */}
              {cs && cs.state !== "idle" && (
                <motion.text
                  x={START_X}
                  y={y + 4}
                  textAnchor="middle"
                  fill="white"
                  fontSize="9"
                  fontWeight="700"
                  fontFamily="monospace"
                  animate={{ x }}
                  transition={{
                    type: "spring",
                    stiffness: 60,
                    damping: 20,
                    mass: 1,
                  }}
                >
                  {isConfirmed
                    ? `${(cs.elapsedMs! / 1000).toFixed(1)}s`
                    : isError
                      ? "ERR"
                      : "..."}
                </motion.text>
              )}

              {/* Confirmed flash */}
              {isConfirmed && (
                <motion.circle
                  cx={FINISH_X - RUNNER_RADIUS}
                  cy={y}
                  r={RUNNER_RADIUS + 6}
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="2"
                  initial={{ opacity: 1, scale: 1 }}
                  animate={{ opacity: 0, scale: 1.5 }}
                  transition={{ duration: 0.8 }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
