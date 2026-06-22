"use client";

import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface VerificationBadgeProps {
  status?: string | null;
  className?: string;
  showTimestamp?: string | null;
}

export function VerificationBadge({ status, className, showTimestamp }: VerificationBadgeProps) {
  if (!status || status === "pending") {
    return (
      <Badge variant="outline" className={cn("text-xs gap-1", className)}>
        <ShieldQuestion className="h-3 w-3" />
        Pending verification
      </Badge>
    );
  }

  if (status === "verified") {
    return (
      <div className={cn("flex flex-col gap-0.5", className)}>
        <Badge className="text-xs gap-1 bg-emerald-600 hover:bg-emerald-600 text-white border-0">
          <ShieldCheck className="h-3 w-3" />
          Blockchain Verified
        </Badge>
        {showTimestamp && (
          <span className="text-[10px] text-muted-foreground">Anchored {showTimestamp}</span>
        )}
      </div>
    );
  }

  return (
    <Badge variant="destructive" className={cn("text-xs gap-1", className)}>
      <ShieldAlert className="h-3 w-3" />
      Tampered / Unverified
    </Badge>
  );
}
