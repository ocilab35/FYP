"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface RiskScoreChartProps {
  score: number;
  size?: number;
  strokeWidth?: number;
  className?: string;
}

function scoreStroke(score: number) {
  if (score >= 70) return "#dc2626";
  if (score >= 40) return "#d97706";
  return "#059669";
}

function scoreTrack(score: number) {
  if (score >= 70) return "#fecaca";
  if (score >= 40) return "#fde68a";
  return "#a7f3d0";
}

export function RiskScoreChart({
  score,
  size = 112,
  strokeWidth = 10,
  className,
}: RiskScoreChartProps) {
  const clamped = Math.min(100, Math.max(0, score));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (clamped / 100) * circumference;
  const center = size / 2;

  return (
    <div className={cn("relative shrink-0", className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={scoreTrack(clamped)}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={scoreStroke(clamped)}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-2xl font-bold tabular-nums"
          style={{ color: scoreStroke(clamped) }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          {clamped}%
        </motion.span>
        <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          Risk
        </span>
      </div>
    </div>
  );
}
