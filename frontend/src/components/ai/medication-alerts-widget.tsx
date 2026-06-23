"use client";

import { AlertTriangle } from "lucide-react";
import { DashboardCard, DashboardCardBody, DashboardCardHeader } from "@/components/dashboard";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { DrugInteractionResult } from "@/lib/api";

interface MedicationAlertsWidgetProps {
  alerts: DrugInteractionResult | null;
  loading?: boolean;
  compact?: boolean;
}

export function MedicationAlertsWidget({ alerts, loading, compact }: MedicationAlertsWidgetProps) {
  if (loading) {
    return (
      <DashboardCard padding="none">
        <DashboardCardHeader title="Medication Alerts" />
        <DashboardCardBody>
          <Skeleton className="h-16 w-full rounded-xl" />
        </DashboardCardBody>
      </DashboardCard>
    );
  }

  if (!alerts) return null;

  return (
    <DashboardCard padding="none" hover={!compact}>
      <DashboardCardHeader
        title="Medication Alerts"
        action={alerts.alerts.length > 0 ? <StatusBadge status={alerts.overall_risk} type="risk" /> : undefined}
      />
      <DashboardCardBody className="space-y-3">
        {alerts.alerts.length === 0 ? (
          <p className="text-sm text-muted-foreground">No medication conflicts detected.</p>
        ) : (
          alerts.alerts.slice(0, compact ? 2 : 5).map((alert, i) => (
            <div
              key={i}
              className="rounded-xl border border-amber-200/60 bg-amber-50/50 p-3 text-sm"
            >
              <div className="mb-1 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="font-medium capitalize">{alert.type.replace(/_/g, " ")}</span>
                <StatusBadge status={alert.risk_level} type="risk" className="ml-auto" />
              </div>
              {alert.medicines.length > 0 && (
                <p className="text-xs text-muted-foreground">{alert.medicines.join(" + ")}</p>
              )}
              <p className="mt-1 text-muted-foreground">{alert.explanation}</p>
              {!compact && (
                <p className="mt-1 text-xs font-medium text-foreground">{alert.suggested_action}</p>
              )}
            </div>
          ))
        )}
        {!compact && <p className="text-[10px] text-muted-foreground/80">{alerts.disclaimer}</p>}
      </DashboardCardBody>
    </DashboardCard>
  );
}
