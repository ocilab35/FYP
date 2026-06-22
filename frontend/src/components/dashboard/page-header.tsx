"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { DashboardRole } from "./role-themes";

interface PageHeaderProps {
  title: string;
  description?: string;
  role?: DashboardRole;
  action?: React.ReactNode;
  badge?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, description, role, action, badge, className }: PageHeaderProps) {
  return (
    <motion.header
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className={cn("flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between", className)}
    >
      <div className="space-y-1.5 min-w-0">
        {badge}
        <h1
          className={cn(
            "text-2xl font-semibold tracking-tight text-foreground md:text-3xl",
            role === "doctor" && "font-bold",
            role === "admin" && "uppercase tracking-wide text-[1.65rem] md:text-[1.85rem]"
          )}
        >
          {title}
        </h1>
        {description && (
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground md:text-base">{description}</p>
        )}
      </div>
      {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </motion.header>
  );
}
