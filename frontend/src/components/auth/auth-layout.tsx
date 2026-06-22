"use client";

import { BrandLogo } from "@/components/landing/brand-logo";
import { AuthBrandPanel } from "@/components/auth/auth-brand-panel";
import { AuthTrustBadgesLight } from "@/components/auth/auth-trust-badges";
import { cn } from "@/lib/utils";

interface AuthLayoutProps {
  children: React.ReactNode;
  brandHeadline?: string;
  brandSubheadline?: string;
  className?: string;
}

export function AuthLayout({
  children,
  brandHeadline,
  brandSubheadline,
  className,
}: AuthLayoutProps) {
  return (
    <div className={cn("min-h-screen bg-[oklch(0.98_0.005_240)]", className)}>
      <div className="grid min-h-screen lg:grid-cols-2">
        <AuthBrandPanel headline={brandHeadline} subheadline={brandSubheadline} />

        <div className="relative flex flex-col">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,oklch(0.55_0.08_195/0.08),transparent_70%)] lg:hidden" />

          <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10 sm:px-6 lg:px-10">
            <div className="mb-8 w-full max-w-[440px] lg:hidden">
              <BrandLogo size="md" />
            </div>
            {children}
            <AuthTrustBadgesLight className="mt-8 max-w-[440px] justify-center lg:hidden" />
          </div>
        </div>
      </div>
    </div>
  );
}
