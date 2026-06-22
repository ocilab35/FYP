"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PromoPanelProps {
  icon: LucideIcon;
  title: string;
  description: string;
  href: string;
  cta: string;
  variant?: "patient" | "doctor" | "admin";
  className?: string;
}

export function PromoPanel({ icon: Icon, title, description, href, cta, variant = "patient", className }: PromoPanelProps) {
  return (
    <motion.div
      whileHover={{ y: -3 }}
      transition={{ duration: 0.25 }}
      className={cn(
        "relative overflow-hidden rounded-2xl p-6 text-white shadow-[0_16px_48px_rgba(15,40,80,0.18)]",
        variant === "patient" && "bg-gradient-to-br from-[oklch(0.35_0.12_250)] via-[oklch(0.45_0.11_230)] to-[oklch(0.55_0.1_195)]",
        variant === "doctor" && "bg-gradient-to-br from-[oklch(0.28_0.06_250)] to-[oklch(0.38_0.1_230)]",
        variant === "admin" && "bg-gradient-to-br from-[oklch(0.22_0.04_260)] to-[oklch(0.35_0.08_250)]",
        className
      )}
    >
      <div className="absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10 blur-2xl" />
      <Icon className="relative h-10 w-10 opacity-90" aria-hidden="true" />
      <h3 className="relative mt-4 text-xl font-semibold">{title}</h3>
      <p className="relative mt-2 text-sm leading-relaxed text-white/80">{description}</p>
      <Link
        href={href}
        className="relative mt-6 inline-flex h-10 w-full items-center justify-center gap-2 rounded-xl bg-white/15 text-sm font-semibold backdrop-blur-sm transition-colors hover:bg-white/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
      >
        {cta}
        <ArrowRight className="h-4 w-4" />
      </Link>
    </motion.div>
  );
}
