"use client";

import Link from "next/link";
import { Activity, Heart } from "lucide-react";
import { cn } from "@/lib/utils";

interface LogoProps {
  className?: string;
  showText?: boolean;
  variant?: "light" | "dark";
}

export function Logo({ className, showText = true, variant = "dark" }: LogoProps) {
  return (
    <Link href="/" className={cn("flex items-center gap-2.5 group", className)}>
      <div className="relative flex h-9 w-9 items-center justify-center rounded-xl gradient-medical shadow-md group-hover:shadow-lg transition-shadow">
        <Heart className="h-4.5 w-4.5 text-white fill-white/20" aria-hidden="true" />
        <Activity className="absolute h-3 w-3 text-white/80 -bottom-0.5 -right-0.5" aria-hidden="true" />
      </div>
      {showText && (
        <div className="flex flex-col">
          <span className={cn(
            "text-lg font-bold tracking-tight leading-none",
            variant === "light" ? "text-white" : "text-foreground"
          )}>
            MediCore
          </span>
          <span className={cn(
            "text-[10px] font-medium tracking-widest uppercase",
            variant === "light" ? "text-white/70" : "text-muted-foreground"
          )}>
            Virtual Hospital
          </span>
        </div>
      )}
    </Link>
  );
}
