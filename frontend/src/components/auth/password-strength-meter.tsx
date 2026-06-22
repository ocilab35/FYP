"use client";

import { motion } from "framer-motion";
import { getPasswordStrength } from "@/lib/auth-schemas";
import { cn } from "@/lib/utils";

interface PasswordStrengthMeterProps {
  password: string;
  className?: string;
}

export function PasswordStrengthMeter({ password, className }: PasswordStrengthMeterProps) {
  const { score, label, color } = getPasswordStrength(password);

  if (!password) return null;

  return (
    <div className={cn("space-y-1.5 pt-1", className)} aria-live="polite">
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-muted-foreground">Password strength</span>
        <span className="font-medium text-foreground">{label}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div
          className={cn("h-full rounded-full", color)}
          initial={{ width: 0 }}
          animate={{ width: `${score}%` }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}
