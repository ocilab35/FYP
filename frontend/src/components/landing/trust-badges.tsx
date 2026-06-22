"use client";

import { motion } from "framer-motion";
import { Database, Link2, Lock, Shield } from "lucide-react";
import { cn } from "@/lib/utils";

const BADGES = [
  { icon: Lock, label: "HIPAA-Inspired Security" },
  { icon: Link2, label: "Blockchain Verified Records" },
  { icon: Database, label: "Secure Medical Storage" },
  { icon: Shield, label: "Trusted Healthcare Platform" },
] as const;

export function TrustBadges({ className }: { className?: string }) {
  return (
    <motion.ul
      initial="hidden"
      animate="visible"
      variants={{
        hidden: {},
        visible: { transition: { staggerChildren: 0.08, delayChildren: 0.85 } },
      }}
      className={cn("flex flex-wrap gap-2 sm:gap-2.5", className)}
      aria-label="Trust and security indicators"
    >
      {BADGES.map(({ icon: Icon, label }) => (
        <motion.li
          key={label}
          variants={{
            hidden: { opacity: 0, y: 10 },
            visible: { opacity: 1, y: 0, transition: { duration: 0.4 } },
          }}
          whileHover={{ y: -2, transition: { duration: 0.2 } }}
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-white/70 px-3 py-1.5 text-[11px] font-medium text-muted-foreground shadow-sm backdrop-blur-sm sm:text-xs">
            <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
            {label}
          </span>
        </motion.li>
      ))}
    </motion.ul>
  );
}
