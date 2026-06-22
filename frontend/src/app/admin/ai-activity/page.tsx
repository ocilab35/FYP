"use client";

import { useEffect, useState } from "react";
import { DashboardCard, PageHeader, StatusBadge } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { formatTimestamp12h } from "@/lib/format";

interface AIActivity {
  id: string;
  symptoms: string[];
  risk_level: string;
  summary: string;
  created_at: string;
}

export default function AdminAIActivityPage() {
  const [activity, setActivity] = useState<AIActivity[]>([]);

  useEffect(() => {
    api.get("/admin/ai-activity").then((res) => setActivity(res.data.data || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader role="admin" title="AI Activity Monitor" description="Track AI doctor consultations across the platform." />

      <div className="space-y-3">
        {activity.map((a) => (
          <DashboardCard key={a.id} padding="md" hover>
            <div className="space-y-2">
              <div className="flex items-start justify-between gap-3">
                <div className="flex flex-wrap gap-1">
                  {a.symptoms.map((s) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
                </div>
                <StatusBadge status={a.risk_level} type="risk" />
              </div>
              <p className="text-sm text-muted-foreground">{a.summary}</p>
              <p className="text-xs text-muted-foreground">{formatTimestamp12h(a.created_at)}</p>
            </div>
          </DashboardCard>
        ))}
        {activity.length === 0 && <p className="py-12 text-center text-muted-foreground">No AI activity yet</p>}
      </div>
    </div>
  );
}
