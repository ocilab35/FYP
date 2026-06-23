"use client";

import { CreditCard } from "lucide-react";
import { DashboardCard, DashboardCardBody, DashboardCardHeader } from "@/components/dashboard";
import { StatusBadge } from "@/components/dashboard/status-badge";
import { LinkButton } from "@/components/shared/link-button";
import { Skeleton } from "@/components/ui/skeleton";
import type { SubscriptionStatus } from "@/lib/api";

interface SubscriptionWidgetProps {
  subscription: SubscriptionStatus | null;
  loading?: boolean;
}

export function SubscriptionWidget({ subscription, loading }: SubscriptionWidgetProps) {
  if (loading) {
    return (
      <DashboardCard padding="none">
        <DashboardCardHeader title="AI Doctor Subscription" />
        <DashboardCardBody>
          <Skeleton className="h-20 w-full rounded-xl" />
        </DashboardCardBody>
      </DashboardCard>
    );
  }

  const active = subscription?.is_active;

  return (
    <DashboardCard padding="none" hover>
      <DashboardCardHeader
        title="AI Doctor Subscription"
        action={
          active ? (
            <StatusBadge status="active" type="generic" />
          ) : (
            <StatusBadge status="expired" type="generic" />
          )
        }
      />
      <DashboardCardBody className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[oklch(0.35_0.12_250)]/10">
            <CreditCard className="h-6 w-6 text-[oklch(0.35_0.12_250)]" />
          </div>
          <div>
            <p className="font-semibold">{subscription?.plan_name || "AI Doctor Plan"}</p>
            <p className="text-sm text-muted-foreground">
              PKR {subscription?.amount?.toLocaleString() || "2,000"} / month
            </p>
          </div>
        </div>

        {active ? (
          <div className="rounded-xl bg-emerald-50/60 px-4 py-3 text-sm">
            <p className="font-medium text-emerald-800">Active</p>
            <p className="text-emerald-700">
              Expires in <span className="font-bold">{subscription?.days_remaining} days</span>
              {subscription?.expiry_date && (
                <span className="text-emerald-600/80"> · {new Date(subscription.expiry_date).toLocaleDateString()}</span>
              )}
            </p>
          </div>
        ) : (
          <div className="rounded-xl bg-amber-50/60 px-4 py-3 text-sm text-amber-900">
            {subscription?.message || "Subscribe to unlock AI Doctor and health insights."}
          </div>
        )}

        <div className="flex gap-2">
          <LinkButton href="/patient/billing/plans" variant={active ? "outline" : "default"} className="rounded-xl flex-1">
            {active ? "Renew" : "View Plans"}
          </LinkButton>
          <LinkButton href="/patient/billing/history" variant="outline" className="rounded-xl">
            History
          </LinkButton>
        </div>
      </DashboardCardBody>
    </DashboardCard>
  );
}
