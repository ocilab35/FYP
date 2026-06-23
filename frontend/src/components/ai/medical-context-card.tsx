"use client";

import { Activity, AlertCircle, Heart, Pill } from "lucide-react";
import { DashboardCard, DashboardCardBody, DashboardCardHeader } from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import type { PatientProfile } from "@/lib/api";

interface MedicalContextCardProps {
  profile: PatientProfile | null;
  loading?: boolean;
}

export function MedicalContextCard({ profile, loading }: MedicalContextCardProps) {
  if (loading) {
    return (
      <DashboardCard padding="none">
        <DashboardCardHeader title="Your Health Profile" />
        <DashboardCardBody className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </DashboardCardBody>
      </DashboardCard>
    );
  }

  if (!profile) return null;

  const items = [
    profile.age != null && { icon: Activity, label: "Age", value: `${profile.age} years` },
    profile.gender && { icon: Heart, label: "Gender", value: profile.gender },
    profile.blood_group && { icon: Activity, label: "Blood Group", value: profile.blood_group },
    profile.allergies && { icon: AlertCircle, label: "Allergies", value: profile.allergies },
    profile.chronic_conditions && { icon: Pill, label: "Chronic Conditions", value: profile.chronic_conditions },
  ].filter(Boolean) as { icon: typeof Activity; label: string; value: string }[];

  return (
    <DashboardCard padding="none">
      <DashboardCardHeader
        title="Your Health Profile"
        description="AI uses this context for personalized guidance"
      />
      <DashboardCardBody>
        {items.length === 0 ? (
          <p className="text-xs text-muted-foreground">
            Complete your profile for more personalized AI responses.
          </p>
        ) : (
          <div className="space-y-3">
            {items.map((item) => (
              <div key={item.label} className="flex gap-2 text-sm">
                <item.icon className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.35_0.12_250)]" />
                <div className="min-w-0">
                  <p className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                    {item.label}
                  </p>
                  <p className="text-foreground">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </DashboardCardBody>
    </DashboardCard>
  );
}
