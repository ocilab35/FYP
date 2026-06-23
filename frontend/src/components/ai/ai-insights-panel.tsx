"use client";

import { Bot, Lightbulb } from "lucide-react";
import { DashboardCard, DashboardCardBody, DashboardCardHeader } from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { AIInsights } from "@/lib/api";
import { HealthRiskWidget } from "./health-risk-widget";
import { MedicationAlertsWidget } from "./medication-alerts-widget";

interface AIInsightsPanelProps {
  insights: AIInsights | null;
  loading?: boolean;
}

export function AIInsightsPanel({ insights, loading }: AIInsightsPanelProps) {
  if (loading) {
    return (
      <div className="grid gap-4 lg:grid-cols-2">
        <Skeleton className="h-48 w-full rounded-2xl" />
        <Skeleton className="h-48 w-full rounded-2xl" />
      </div>
    );
  }

  if (!insights) return null;

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <HealthRiskWidget risk={insights.health_risk} compact />
        <MedicationAlertsWidget alerts={insights.medication_alerts} compact />
      </div>

      {(insights.recommendations.length > 0 || insights.chronic_monitoring.length > 0) && (
        <DashboardCard padding="none">
          <DashboardCardHeader
            title="AI Health Insights"
            description="Personalized recommendations based on your health data"
            action={<Bot className="h-4 w-4 text-[oklch(0.35_0.12_250)]" />}
          />
          <DashboardCardBody className="space-y-4">
            {insights.chronic_monitoring.length > 0 && (
              <div>
                <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Chronic Disease Monitoring
                </p>
                <ul className="space-y-1.5 text-sm">
                  {insights.chronic_monitoring.map((item, i) => (
                    <li key={i} className="flex gap-2 text-muted-foreground">
                      <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {insights.recommendations.length > 0 && (
              <ul className="space-y-1.5 text-sm text-muted-foreground">
                {insights.recommendations.map((r, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-[oklch(0.35_0.12_250)]">•</span>
                    {r}
                  </li>
                ))}
              </ul>
            )}
          </DashboardCardBody>
        </DashboardCard>
      )}
    </div>
  );
}
