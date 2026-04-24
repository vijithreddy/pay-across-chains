"use client";

import { motion } from "framer-motion";
import {
  CHAIN_IDS,
  CHAIN_COLORS,
  CHAIN_NAMES,
  CHAIN_INITIALS,
} from "@/lib/chains";
import type { ChainRaceState, TxState } from "@/lib/race-engine";

const VIEWBOX_W = 860;
const VIEWBOX_H = 300;
const LABEL_X = 80;
const START_X = 100;
const FINISH_X = 760;
const RUNNER_TRAVEL = FINISH_X - START_X;
const LANE_H = 80;
const LANE_Y = [60, 140, 220] as const;

/** Maps tx state to runner X position on the track (0=start, FINISH_X=end) */
function getTargetX(state: TxState): number {
  switch (state) {
    case "idle":
    case "signing":
    case "signed":
      return START_X;
    case "racing":
      return START_X + RUNNER_TRAVEL * 0.8;
    case "confirmed":
      return FINISH_X;
    case "error":
      return START_X + RUNNER_TRAVEL * 0.06;
  }
}

/** Returns Framer Motion transition config — slow crawl while racing, spring snap on confirm */
function getTransition(state: TxState) {
  if (state === "racing") return { duration: 45, ease: "linear" as const };
  if (state === "confirmed")
    return { type: "spring" as const, stiffness: 200, damping: 22, mass: 0.8 };
  return { type: "spring" as const, stiffness: 80, damping: 20 };
}

/** Animated stick-figure runner with chain-initial head — legs/arms cycle while racing */
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
  const fill = isError ? "#EF4444" : color;
  const opacity = state === "idle" || state === "signing" ? 0.25 : 1;
  const legDuration = 0.5;

  return (
    <g opacity={opacity}>
      {/* Motion blur trail behind head */}
      {isRunning && (
        <g filter="url(#motionBlur)" opacity="0.3">
          <circle r="12" cy="-20" fill={fill} />
        </g>
      )}

      {/* Head with chain initial */}
      <circle r="12" cy="-20" fill={fill} stroke={fill} strokeWidth="1" />
      <text
        y="-16"
        textAnchor="middle"
        fill="white"
        fontSize="12"
        fontWeight="700"
        fontFamily="var(--font-dm-mono), monospace"
      >
        {initial}
      </text>

      {/* Torso */}
      <line
        x1="0"
        y1="-8"
        x2="0"
        y2="6"
        stroke={fill}
        strokeWidth="2.5"
        strokeLinecap="round"
      />

      {/* Arms */}
      {isFinished ? (
        <>
          <line
            x1="0"
            y1="-4"
            x2="-9"
            y2="-16"
            stroke={fill}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="0"
            y1="-4"
            x2="9"
            y2="-16"
            stroke={fill}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      ) : isRunning ? (
        <>
          <motion.line
            x1="0"
            y1="-4"
            stroke={fill}
            strokeWidth="2"
            strokeLinecap="round"
            animate={{ x2: [-8, 8, -8], y2: [3, -6, 3] }}
            transition={{
              repeat: Infinity,
              duration: legDuration,
              ease: "easeInOut",
            }}
          />
          <motion.line
            x1="0"
            y1="-4"
            stroke={fill}
            strokeWidth="2"
            strokeLinecap="round"
            animate={{ x2: [8, -8, 8], y2: [-6, 3, -6] }}
            transition={{
              repeat: Infinity,
              duration: legDuration,
              ease: "easeInOut",
            }}
          />
        </>
      ) : (
        <>
          <line
            x1="0"
            y1="-4"
            x2="-6"
            y2="1"
            stroke={fill}
            strokeWidth="2"
            strokeLinecap="round"
          />
          <line
            x1="0"
            y1="-4"
            x2="6"
            y2="1"
            stroke={fill}
            strokeWidth="2"
            strokeLinecap="round"
          />
        </>
      )}

      {/* Legs */}
      {isRunning ? (
        <>
          <motion.line
            x1="0"
            y1="6"
            stroke={fill}
            strokeWidth="2.5"
            strokeLinecap="round"
            animate={{ x2: [-7, 8, -7], y2: [18, 16, 18] }}
            transition={{
              repeat: Infinity,
              duration: legDuration,
              ease: "easeInOut",
            }}
          />
          <motion.line
            x1="0"
            y1="6"
            stroke={fill}
            strokeWidth="2.5"
            strokeLinecap="round"
            animate={{ x2: [8, -7, 8], y2: [16, 18, 16] }}
            transition={{
              repeat: Infinity,
              duration: legDuration,
              ease: "easeInOut",
            }}
          />
        </>
      ) : (
        <>
          <line
            x1="0"
            y1="6"
            x2="-4"
            y2="18"
            stroke={fill}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
          <line
            x1="0"
            y1="6"
            x2="4"
            y2="18"
            stroke={fill}
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </>
      )}
    </g>
  );
}

/** SVG 3-lane race track with animated runners — position driven by real tx state */
export function RaceTrack({
  chainStates,
}: {
  chainStates: Record<number, ChainRaceState>;
}) {
  return (
    <div className="w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-surface)]">
      <svg
        viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`}
        className="w-full h-auto"
        role="img"
        aria-label="Race track"
      >
        <defs>
          <filter id="motionBlur">
            <feGaussianBlur in="SourceGraphic" stdDeviation="8 0" />
          </filter>
        </defs>

        {/* Finish line */}
        <line
          x1={FINISH_X + 10}
          y1="20"
          x2={FINISH_X + 10}
          y2={VIEWBOX_H - 20}
          stroke="var(--border-bright)"
          strokeWidth="2"
          strokeDasharray="6 4"
        />
        <text
          x={FINISH_X + 10}
          y="14"
          textAnchor="middle"
          fill="var(--text-dim)"
          fontSize="9"
          fontFamily="var(--font-dm-mono), monospace"
          fontWeight="500"
          letterSpacing="0.1em"
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
              {/* Lane separator */}
              {i > 0 && (
                <line
                  x1={START_X}
                  y1={y - LANE_H / 2 + 10}
                  x2={FINISH_X + 10}
                  y2={y - LANE_H / 2 + 10}
                  stroke="var(--border)"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
              )}

              {/* Starting block */}
              <line
                x1={START_X}
                y1={y - 16}
                x2={START_X}
                y2={y + 20}
                stroke={color}
                strokeWidth="3"
                opacity="0.4"
              />

              {/* Lane label */}
              <text
                x={LABEL_X}
                y={y + 4}
                textAnchor="end"
                fill={color}
                fontSize="11"
                fontWeight="500"
                fontFamily="var(--font-dm-mono), monospace"
                letterSpacing="0.05em"
                style={{ textTransform: "uppercase" } as React.CSSProperties}
              >
                {name}
              </text>

              {/* Runner */}
              <motion.g
                initial={{ x: START_X, y: 0 }}
                animate={{ x: targetX }}
                transition={transition}
              >
                <g transform={`translate(0, ${y})`}>
                  <RunnerFigure color={color} initial={initial} state={state} />
                </g>
              </motion.g>

              {/* Time badge */}
              {(isConfirmed || isError) && (
                <g>
                  <rect
                    x={FINISH_X + 24}
                    y={y - 10}
                    width="70"
                    height="22"
                    rx="2"
                    fill={isConfirmed ? "var(--success)" : "var(--destructive)"}
                    opacity="0.1"
                    stroke={
                      isConfirmed ? "var(--success)" : "var(--destructive)"
                    }
                    strokeWidth="1"
                    strokeOpacity="0.3"
                  />
                  <text
                    x={FINISH_X + 59}
                    y={y + 5}
                    textAnchor="middle"
                    fill={isConfirmed ? "var(--success)" : "var(--destructive)"}
                    fontSize="11"
                    fontWeight="600"
                    fontFamily="var(--font-dm-mono), monospace"
                  >
                    {isConfirmed
                      ? `${(cs.elapsedMs! / 1000).toFixed(2)}s`
                      : "ERR"}
                  </text>
                </g>
              )}

              {/* Confirmed flash */}
              {isConfirmed && (
                <motion.circle
                  cx={FINISH_X}
                  cy={y}
                  r="16"
                  fill="none"
                  stroke="var(--success)"
                  strokeWidth="1.5"
                  initial={{ opacity: 0.6, scale: 1 }}
                  animate={{ opacity: 0, scale: 2.5 }}
                  transition={{ duration: 1 }}
                />
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
