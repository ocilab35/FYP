"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface DashboardCardProps {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  padding?: "none" | "sm" | "md" | "lg";
  variant?: "default" | "elevated" | "ghost" | "accent";
}

const paddingMap = {
  none: "",
  sm: "p-4",
  md: "p-5 md:p-6",
  lg: "p-6 md:p-8",
};

export function DashboardCard({
  children,
  className,
  hover = false,
  padding = "none",
  variant = "default",
}: DashboardCardProps) {
  return (
    <motion.div
      whileHover={hover ? { y: -2 } : undefined}
      transition={{ duration: 0.2 }}
      className={cn(
        "rounded-2xl border transition-shadow duration-300",
        variant === "default" && "border-border/60 bg-card shadow-[0_1px_3px_rgba(15,40,80,0.06),0_8px_24px_rgba(15,40,80,0.04)]",
        variant === "elevated" && "border-border/50 bg-white shadow-[0_4px_20px_rgba(15,40,80,0.08)]",
        variant === "ghost" && "border-transparent bg-muted/30 shadow-none",
        variant === "accent" && "border-[oklch(0.35_0.12_250/0.2)] bg-[oklch(0.35_0.12_250)] text-white shadow-[0_12px_40px_rgba(15,40,80,0.2)]",
        hover && "hover:shadow-[0_8px_32px_rgba(15,40,80,0.1)]",
        paddingMap[padding],
        className
      )}
    >
      {children}
    </motion.div>
  );
}

interface DashboardCardHeaderProps {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function DashboardCardHeader({ title, description, action, className }: DashboardCardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 border-b border-border/50 px-5 py-4 md:px-6", className)}>
      <div>
        <h2 className="text-base font-semibold tracking-tight text-foreground md:text-lg">{title}</h2>
        {description && <p className="mt-0.5 text-xs text-muted-foreground md:text-sm">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function DashboardCardBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("p-5 md:p-6", className)}>{children}</div>;
}
