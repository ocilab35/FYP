"use client";

import { motion } from "framer-motion";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DashboardRole } from "@/components/dashboard/role-themes";

interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon: LucideIcon;
  trend?: string;
  className?: string;
  role?: DashboardRole;
  index?: number;
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  trend,
  className,
  role = "patient",
  index = 0,
}: StatCardProps) {
  const iconStyles = {
    patient: "bg-[oklch(0.55_0.1_195/0.12)] text-[oklch(0.35_0.12_250)]",
    doctor: "bg-[oklch(0.35_0.12_250/0.15)] text-[oklch(0.55_0.1_195)]",
    admin: "bg-[oklch(0.72_0.12_155/0.15)] text-[oklch(0.45_0.1_155)]",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -2 }}
      className={cn(
        "rounded-2xl border border-border/60 bg-card p-5 shadow-[0_1px_3px_rgba(15,40,80,0.05),0_6px_20px_rgba(15,40,80,0.04)] transition-shadow hover:shadow-[0_8px_28px_rgba(15,40,80,0.08)]",
        role === "admin" && "bg-white/90",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
          <p className="text-2xl font-bold tracking-tight text-foreground md:text-3xl">{value}</p>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
          {trend && (
            <p className="text-xs font-semibold text-[oklch(0.55_0.1_195)]">{trend}</p>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-xl",
            iconStyles[role]
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
      </div>
    </motion.div>
  );
}
