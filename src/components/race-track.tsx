"use client";

import { motion } from "framer-motion";
import { CHAIN_COLORS, CHAIN_NAMES } from "@/lib/chains";
import type { ChainRaceState, TxState } from "@/lib/race-engine";
import { mainnet, base } from "wagmi/chains";
import { tempo } from "viem/chains";

const CHAIN_IDS = [mainnet.id, base.id, tempo.id] as const;
const CHAIN_INITIALS: Record<number, string> = {
  [mainnet.id]: "E",
  [base.id]: "B",
  [tempo.id]: "T",
};

// Layout constants — wider viewBox for label room
const VIEWBOX_W = 820;
const LABEL_X = 85;
const START_X = 105;
const FINISH_X = 720;
const RUNNER_TRAVEL = FINISH_X - START_X;
const TIME_X = FINISH_X + 20;
const LANE_Y = [65, 145, 225] as const;

function getTargetX(state: TxState): number {
  switch (state) {
    case "idle":
    case "signing":
    case "signed":
      return START_X;
    case "racing":
      // Slow crawl toward 80% — never reaches finish on its own
      return START_X + RUNNER_TRAVEL * 0.8;
    case "confirmed":
      return FINISH_X;
    case "error":
      return START_X + RUNNER_TRAVEL * 0.08;
  }
}

function getTransition(state: TxState) {
  if (state === "racing") {
    return { duration: 45, ease: "linear" as const };
  }
  if (state === "confirmed") {
    return { type: "spring" as const, stiffness: 180, damping: 22, mass: 0.8 };
  }
  return { type: "spring" as const, stiffness: 80, damping: 20 };
}

function RunnerFigure({
  color,
  initial,
  state,
}: {
  color: string;
  initial: string;
  state: TxState;
}) {
  const isRunning = state === "racing";
  const isFinished = state === "confirmed";
  const isError = state === "error";
  const fill = isError ? "#ef4444" : color;
  const opacity = state === "idle" || state === "signing" ? 0.35 : 1;
  const legDuration = 0.32;

  return (
    <g opacity={opacity}>
      {/* Head */}
      <circle r="9" cy="-18" fill={fill} />
      <text
        y="-14"
        textAnchor="middle"
        fill="white"
        fontSize="10"
        fontWeight="700"
        fontFamily="system-ui, -apple-system, sans-serif"
      >
        {initial}
      </text>

      {/* Torso */}
      <line
        x1="0" y1="-9" x2="0" y2="5"
        stroke={fill} strokeWidth="3" strokeLinecap="round"
      />

      {/* Arms */}
      {isFinished ? (
        // Victory pose
        <>
          <line x1="0" y1="-5" x2="-8" y2="-15" stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="0" y1="-5" x2="8" y2="-15" stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
        </>
      ) : isRunning ? (
        <>
          <motion.line
            x1="0" y1="-5"
            stroke={fill} strokeWidth="2.5" strokeLinecap="round"
            animate={{ x2: [-8, 8, -8], y2: [2, -5, 2] }}
            transition={{ repeat: Infinity, duration: legDuration, ease: "easeInOut" }}
          />
          <motion.line
            x1="0" y1="-5"
            stroke={fill} strokeWidth="2.5" strokeLinecap="round"
            animate={{ x2: [8, -8, 8], y2: [-5, 2, -5] }}
            transition={{ repeat: Infinity, duration: legDuration, ease: "easeInOut" }}
          />
        </>
      ) : (
        <>
          <line x1="0" y1="-5" x2="-6" y2="0" stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
          <line x1="0" y1="-5" x2="6" y2="0" stroke={fill} strokeWidth="2.5" strokeLinecap="round" />
        </>
      )}

      {/* Legs */}
      {isRunning ? (
        <>
          <motion.line
            x1="0" y1="5"
            stroke={fill} strokeWidth="3" strokeLinecap="round"
            animate={{ x2: [-6, 7, -6], y2: [16, 14, 16] }}
            transition={{ repeat: Infinity, duration: legDuration, ease: "easeInOut" }}
          />
          <motion.line
            x1="0" y1="5"
            stroke={fill} strokeWidth="3" strokeLinecap="round"
            animate={{ x2: [7, -6, 7], y2: [14, 16, 14] }}
            transition={{ repeat: Infinity, duration: legDuration, ease: "easeInOut" }}
          />
        </>
      ) : (
        <>
          <line x1="0" y1="5" x2="-4" y2="16" stroke={fill} strokeWidth="3" strokeLinecap="round" />
          <line x1="0" y1="5" x2="4" y2="16" stroke={fill} strokeWidth="3" strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

export function RaceTrack({
  chainStates,
}: {
  chainStates: Record<number, ChainRaceState>;
}) {
  return (
    <div className="w-full overflow-hidden rounded-2xl border border-zinc-800/50 bg-[#0a0a0f] p-5">
      <svg
        viewBox={`0 0 ${VIEWBOX_W} 290`}
        className="w-full h-auto"
        role="img"
        aria-label="Race track showing transaction progress"
      >
        {/* Track surface */}
        <rect
          x={START_X - 8}
          y="28"
          width={FINISH_X - START_X + 24}
          height="230"
          rx="10"
          fill="#111118"
          stroke="#1c1c2e"
          strokeWidth="1"
        />

        {/* Finish line */}
        <line
          x1={FINISH_X + 8}
          y1="28"
          x2={FINISH_X + 8}
          y2="258"
          stroke="#2a2a3e"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        <text
          x={FINISH_X + 8}
          y="20"
          textAnchor="middle"
          fill="#3f3f5a"
          fontSize="10"
          fontFamily="system-ui, -apple-system, sans-serif"
          fontWeight="600"
          letterSpacing="0.08em"
        >
          FINISH
        </text>

        {/* Lanes */}
        {CHAIN_IDS.map((chainId, i) => {
          const cs = chainStates[chainId];
          const state = cs?.state ?? "idle";
          const targetX = getTargetX(state);
          const transition = getTransition(state);
          const color = CHAIN_COLORS[chainId as keyof typeof CHAIN_COLORS];
          const name = CHAIN_NAMES[chainId as keyof typeof CHAIN_NAMES];
          const initial = CHAIN_INITIALS[chainId];
          const y = LANE_Y[i];
          const isConfirmed = state === "confirmed";
          const isError = state === "error";

          return (
            <g key={chainId}>
              {/* Lane track line */}
              <line
                x1={START_X}
                y1={y}
                x2={FINISH_X + 8}
                y2={y}
                stroke="#1a1a2a"
                strokeWidth="1"
              />

              {/* Start marker */}
              <line
                x1={START_X}
                y1={y - 12}
                x2={START_X}
                y2={y + 12}
                stroke="#1f1f32"
                strokeWidth="1"
              />

              {/* Chain label */}
              <text
                x={LABEL_X}
                y={y + 5}
                textAnchor="end"
                fill={color}
                fontSize="14"
                fontWeight="600"
                fontFamily="system-ui, -apple-system, sans-serif"
              >
                {name}
              </text>

              {/* Runner figure */}
              <motion.g
                initial={{ x: START_X, y: 0 }}
                animate={{ x: targetX }}
                transition={transition}
              >
                <g transform={`translate(0, ${y})`}>
                  <RunnerFigure
                    color={color}
                    initial={initial}
                    state={state}
                  />
                </g>
              </motion.g>

              {/* Time badge — right side */}
              {(isConfirmed || isError) && (
                <g>
                  <rect
                    x={TIME_X}
                    y={y - 12}
                    width="60"
                    height="24"
                    rx="6"
                    fill={isConfirmed ? "#22c55e15" : "#ef444415"}
                    stroke={isConfirmed ? "#22c55e30" : "#ef444430"}
                    strokeWidth="1"
                  />
                  <text
                    x={TIME_X + 30}
                    y={y + 4}
                    textAnchor="middle"
                    fill={isConfirmed ? "#4ade80" : "#f87171"}
                    fontSize="12"
                    fontWeight="600"
                    fontFamily="ui-monospace, monospace"
                  >
                    {isConfirmed
                      ? `${(cs.elapsedMs! / 1000).toFixed(1)}s`
                      : "ERR"}
                  </text>
                </g>
              )}

              {/* Confirmed pulse ring */}
              {isConfirmed && (
                <motion.circle
                  cx={FINISH_X}
                  cy={y}
                  r="14"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="1.5"
                  initial={{ opacity: 0.7, scale: 1 }}
                  animate={{ opacity: 0, scale: 2.5 }}
                  transition={{ duration: 1.2 }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
