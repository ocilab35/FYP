"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

interface BrandLogoProps {
  className?: string;
  showText?: boolean;
  variant?: "light" | "dark";
  size?: "sm" | "md" | "lg";
}

export function BrandLogo({
  className,
  showText = true,
  variant = "dark",
  size = "md",
}: BrandLogoProps) {
  const iconSize = size === "sm" ? 32 : size === "lg" ? 44 : 38;

  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-3 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 rounded-lg",
        className
      )}
      aria-label="Virtual Hospital — home"
    >
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center rounded-xl bg-[oklch(0.35_0.12_250)] shadow-[0_8px_30px_rgba(15,40,80,0.18)] transition-all duration-300 group-hover:shadow-[0_12px_40px_rgba(15,40,80,0.22)] group-hover:scale-[1.02]",
          size === "sm" && "h-8 w-8",
          size === "md" && "h-10 w-10",
          size === "lg" && "h-11 w-11"
        )}
      >
        <svg
          width={iconSize}
          height={iconSize}
          viewBox="0 0 40 40"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
          className="p-2"
        >
          <path
            d="M20 4L8 9v10c0 7.2 5.1 13.9 12 15 6.9-1.1 12-7.8 12-15V9L20 4z"
            fill="url(#vh-shield)"
            fillOpacity="0.95"
          />
          <rect x="17.5" y="13" width="5" height="14" rx="1.2" fill="white" fillOpacity="0.95" />
          <rect x="13" y="17.5" width="14" height="5" rx="1.2" fill="white" fillOpacity="0.95" />
          <circle cx="28" cy="12" r="2" fill="oklch(0.72 0.12 155)" />
          <circle cx="32" cy="16" r="1.5" fill="oklch(0.55 0.1 195)" fillOpacity="0.9" />
          <circle cx="30" cy="20" r="1.2" fill="white" fillOpacity="0.7" />
          <path d="M28 12l2 4M28 12l4 4" stroke="white" strokeWidth="0.8" strokeOpacity="0.5" />
          <defs>
            <linearGradient id="vh-shield" x1="8" y1="4" x2="32" y2="34" gradientUnits="userSpaceOnUse">
              <stop stopColor="oklch(0.45 0.12 250)" />
              <stop offset="0.5" stopColor="oklch(0.55 0.1 195)" />
              <stop offset="1" stopColor="oklch(0.42 0.1 195)" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      {showText && (
        <div className="flex flex-col leading-none">
          <span
            className={cn(
              "font-semibold tracking-tight",
              size === "sm" && "text-base",
              size === "md" && "text-[1.05rem]",
              size === "lg" && "text-xl",
              variant === "light" ? "text-white" : "text-foreground"
            )}
          >
            Virtual Hospital
          </span>
          <span
            className={cn(
              "mt-0.5 text-[10px] font-medium tracking-[0.18em] uppercase",
              variant === "light" ? "text-white/65" : "text-muted-foreground"
            )}
          >
            AI-Powered Healthcare
          </span>
        </div>
      )}
    </Link>
  );
}
