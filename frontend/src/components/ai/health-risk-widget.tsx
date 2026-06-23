"use client";

import { DashboardCard, DashboardCardBody, DashboardCardHeader } from "@/components/dashboard";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { HealthRisk } from "@/lib/api";
import { cn } from "@/lib/utils";
import { RiskScoreChart } from "./risk-score-chart";

interface HealthRiskWidgetProps {
  risk: HealthRisk | null;
  loading?: boolean;
  compact?: boolean;
}

function riskBarColor(score: number) {
  if (score >= 70) return "bg-red-500";
  if (score >= 40) return "bg-amber-500";
  return "bg-emerald-500";
}

export function HealthRiskWidget({ risk, loading, compact }: HealthRiskWidgetProps) {
  if (loading) {
    return (
      <DashboardCard padding="none">
        <DashboardCardHeader title="Health Risk Overview" />
        <DashboardCardBody>
          <div className="flex items-center gap-4">
            <Skeleton className="h-28 w-28 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          </div>
        </DashboardCardBody>
      </DashboardCard>
    );
  }

  if (!risk) return null;

  return (
    <DashboardCard padding="none" hover={!compact}>
      <DashboardCardHeader
        title="Health Risk Overview"
        action={<StatusBadge status={risk.risk_category} type="risk" />}
      />
      <DashboardCardBody className="space-y-4">
        <div className="flex items-start gap-5">
          <RiskScoreChart score={risk.risk_score} size={compact ? 96 : 120} />
          <div className="min-w-0 flex-1 space-y-2 pt-1">
            <div className="h-2 overflow-hidden rounded-full bg-muted">
              <div
                className={cn("h-full rounded-full transition-all duration-700", riskBarColor(risk.risk_score))}
                style={{ width: `${risk.risk_score}%` }}
              />
            </div>
            <p
              className={cn(
                "text-sm leading-relaxed text-muted-foreground",
                compact && "line-clamp-4"
              )}
            >
              {risk.explanation}
            </p>
          </div>
        </div>

        {!compact && risk.recommendations.length > 0 && (
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {risk.recommendations.slice(0, 3).map((r, i) => (
              <li key={i} className="flex gap-2">
                <span className="text-[oklch(0.35_0.12_250)]">•</span>
                {r}
              </li>
            ))}
          </ul>
        )}

        <p className="text-[10px] text-muted-foreground/80">{risk.disclaimer}</p>
      </DashboardCardBody>
    </DashboardCard>
  );
}
