"use client";

import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface AuthSubmitButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: "primary" | "secondary";
}

export function AuthSubmitButton({
  children,
  loading,
  loadingText,
  variant = "primary",
  className,
  disabled,
  ...props
}: AuthSubmitButtonProps) {
  return (
    <motion.div whileHover={disabled || loading ? undefined : { scale: 1.01 }} whileTap={disabled || loading ? undefined : { scale: 0.99 }}>
      <button
        type="submit"
        disabled={disabled || loading}
        className={cn(
          "inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-60",
          variant === "primary" &&
            "bg-[oklch(0.35_0.12_250)] text-white shadow-[0_8px_24px_rgba(15,40,80,0.2)] hover:bg-[oklch(0.32_0.12_250)] hover:shadow-[0_12px_32px_rgba(15,40,80,0.24)]",
          variant === "secondary" &&
            "border border-border/80 bg-white/80 text-foreground hover:bg-white",
          className
        )}
        {...props}
      >
        {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
        {loading ? loadingText ?? "Please wait..." : children}
      </button>
    </motion.div>
  );
}
