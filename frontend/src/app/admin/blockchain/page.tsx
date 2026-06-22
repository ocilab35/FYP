"use client";

import { useEffect, useState } from "react";
import { Shield, ShieldCheck, ShieldAlert, Link2 } from "lucide-react";
import { PageHeader, DashboardCard, DashboardCardBody, DashboardCardHeader } from "@/components/dashboard";
import { Badge } from "@/components/ui/badge";
import { StatCard } from "@/components/shared/stat-card";
import { api } from "@/lib/api";
import { formatTimestamp12h } from "@/lib/format";

interface DashboardStats {
  blockchain_enabled: boolean;
  simulated_mode: boolean;
  verified_medical_records: number;
  verified_prescriptions: number;
  anchored_audit_events: number;
  tampered_items: number;
}

interface AuditItem {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  user_role: string | null;
  blockchain_tx_hash: string | null;
  blockchain_hash: string | null;
  created_at: string;
}

export default function AdminBlockchainPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [audit, setAudit] = useState<AuditItem[]>([]);

  useEffect(() => {
    api.get("/verification/admin/dashboard").then((r) => setStats(r.data.data));
    api.get("/verification/admin/audit-trail").then((r) => setAudit(r.data.data || []));
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader
        role="admin"
        title="Blockchain Verification"
        description="Immutable hash registry for medical reports, prescriptions, and audit events."
        badge={stats?.simulated_mode ? <Badge variant="outline">Simulated chain mode</Badge> : undefined}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard role="admin" index={0} title="Verified Reports" value={stats?.verified_medical_records ?? "—"} icon={ShieldCheck} />
        <StatCard role="admin" index={1} title="Verified Prescriptions" value={stats?.verified_prescriptions ?? "—"} icon={Shield} />
        <StatCard role="admin" index={2} title="Audit Events On-Chain" value={stats?.anchored_audit_events ?? "—"} icon={Link2} />
        <StatCard role="admin" index={3} title="Tampered Items" value={stats?.tampered_items ?? "—"} icon={ShieldAlert} />
      </div>

      <DashboardCard padding="none" variant="elevated">
        <DashboardCardHeader title="Audit Trail Explorer" />
        <DashboardCardBody>
          {audit.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No anchored audit events yet</p>
          ) : (
            <div className="space-y-3 max-h-[480px] overflow-y-auto">
              {audit.map((a) => (
                <div key={a.id} className="p-3 rounded-lg bg-muted/30 text-sm space-y-1">
                  <div className="flex justify-between gap-2">
                    <span className="font-medium capitalize">{a.action.replace(/_/g, " ")}</span>
                    <span className="text-xs text-muted-foreground">{formatTimestamp12h(a.created_at)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {a.resource_type} · {a.resource_id || "—"} · role: {a.user_role || "system"}
                  </p>
                  {a.blockchain_tx_hash && (
                    <p className="text-[10px] font-mono text-muted-foreground truncate" title={a.blockchain_tx_hash}>
                      tx: {a.blockchain_tx_hash}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </DashboardCardBody>
      </DashboardCard>
    </div>
  );
}
