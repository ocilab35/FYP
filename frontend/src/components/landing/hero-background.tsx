"use client";

import { motion, useReducedMotion } from "framer-motion";

export function HeroBackground() {
  const reduceMotion = useReducedMotion();

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_-10%,oklch(0.55_0.08_195/0.12),transparent_70%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_100%_0%,oklch(0.35_0.12_250/0.08),transparent_55%)]" />

      <div
        className="absolute inset-0 opacity-[0.35]"
        style={{
          backgroundImage: `
            linear-gradient(to right, oklch(0.35 0.12 250 / 0.04) 1px, transparent 1px),
            linear-gradient(to bottom, oklch(0.35 0.12 250 / 0.04) 1px, transparent 1px)
          `,
          backgroundSize: "64px 64px",
          maskImage: "radial-gradient(ellipse 70% 60% at 50% 40%, black, transparent)",
        }}
      />

      <motion.div
        className="absolute -top-24 -right-24 h-[28rem] w-[28rem] rounded-full bg-[oklch(0.55_0.1_195/0.15)] blur-3xl"
        animate={reduceMotion ? undefined : { x: [0, 20, 0], y: [0, -15, 0], scale: [1, 1.05, 1] }}
        transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/3 -left-32 h-80 w-80 rounded-full bg-[oklch(0.35_0.12_250/0.1)] blur-3xl"
        animate={reduceMotion ? undefined : { x: [0, -12, 0], y: [0, 20, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-0 right-1/4 h-64 w-64 rounded-full bg-[oklch(0.72_0.12_155/0.12)] blur-3xl"
        animate={reduceMotion ? undefined : { scale: [1, 1.08, 1], opacity: [0.6, 0.9, 0.6] }}
        transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
      />

      {!reduceMotion &&
        Array.from({ length: 12 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute h-1 w-1 rounded-full bg-[oklch(0.55_0.1_195/0.4)]"
            style={{
              left: `${8 + (i * 7.5) % 85}%`,
              top: `${10 + (i * 11) % 75}%`,
            }}
            animate={{ opacity: [0.2, 0.7, 0.2], y: [0, -8, 0] }}
            transition={{ duration: 4 + (i % 3), repeat: Infinity, delay: i * 0.3 }}
          />
        ))}
    </div>
  );
}
