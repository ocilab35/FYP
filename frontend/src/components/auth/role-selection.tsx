"use client";

import { motion } from "framer-motion";
import { HeartPulse, Stethoscope } from "lucide-react";
import { cn } from "@/lib/utils";
import type { AuthRole } from "@/lib/auth-schemas";

const ROLES = [
  {
    id: "patient" as const,
    title: "Patient",
    description: "Book appointments, access AI Doctor, and manage your health records securely.",
    icon: HeartPulse,
  },
  {
    id: "doctor" as const,
    title: "Doctor",
    description: "Offer consultations, manage schedules, and deliver care through telemedicine.",
    icon: Stethoscope,
  },
];

interface RoleSelectionProps {
  value: AuthRole;
  onChange: (role: AuthRole) => void;
  className?: string;
}

export function RoleSelection({ value, onChange, className }: RoleSelectionProps) {
  return (
    <div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2", className)} role="radiogroup" aria-label="Select account type">
      {ROLES.map((role) => {
        const selected = value === role.id;
        const Icon = role.icon;

        return (
          <motion.button
            key={role.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(role.id)}
            whileHover={{ y: -2 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              "relative rounded-xl border p-4 text-left transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              selected
                ? "border-[oklch(0.55_0.1_195)] bg-[oklch(0.55_0.1_195/0.06)] shadow-[0_8px_24px_rgba(15,40,80,0.08)]"
                : "border-border/70 bg-white/60 hover:border-border hover:bg-white/90"
            )}
          >
            {selected && (
              <motion.span
                layoutId="role-ring"
                className="absolute inset-0 rounded-xl ring-2 ring-[oklch(0.55_0.1_195/0.35)]"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
            <div className="relative flex items-start gap-3">
              <span
                className={cn(
                  "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg transition-colors",
                  selected ? "bg-[oklch(0.35_0.12_250)] text-white" : "bg-muted text-muted-foreground"
                )}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
              </span>
              <div>
                <p className="font-semibold text-foreground">{role.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{role.description}</p>
              </div>
            </div>
          </motion.button>
        );
      })}
    </div>
  );
}
