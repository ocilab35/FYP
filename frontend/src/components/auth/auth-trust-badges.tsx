"use client";

import { motion } from "framer-motion";
import { Database, Link2, Lock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const BADGES = [
  { icon: Lock, label: "Secure Authentication" },
  { icon: Shield, label: "Encrypted Data" },
  { icon: Link2, label: "Blockchain Verified" },
  { icon: Database, label: "Privacy Protected" },
] as const;

export function AuthTrustBadges({ className, compact = false }: { className?: string; compact?: boolean }) {
  return (
    <ul
      className={cn("flex flex-wrap gap-2", className)}
      aria-label="Security and privacy indicators"
    >
      {BADGES.map(({ icon: Icon, label }) => (
        <li key={label}>
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 text-white/90 backdrop-blur-sm",
              compact ? "px-2.5 py-1 text-[10px]" : "px-3 py-1.5 text-xs"
            )}
          >
            <Icon className={cn("shrink-0", compact ? "h-3 w-3" : "h-3.5 w-3.5")} aria-hidden="true" />
            {label}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function AuthTrustBadgesLight({ className }: { className?: string }) {
  return (
    <motion.ul
      initial="hidden"
      animate="visible"
      variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.06 } } }}
      className={cn("flex flex-wrap gap-2", className)}
      aria-label="Security indicators"
    >
      {BADGES.map(({ icon: Icon, label }) => (
        <motion.li
          key={label}
          variants={{ hidden: { opacity: 0, y: 6 }, visible: { opacity: 1, y: 0 } }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-white/80 px-2.5 py-1 text-[10px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm sm:text-xs">
            <Icon className="h-3 w-3 text-primary" aria-hidden="true" />
            {label}
          </span>
        </motion.li>
      ))}
    </motion.ul>
  );
}
