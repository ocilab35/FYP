"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { ClipboardList } from "lucide-react";
import { DashboardCard, DashboardCardBody, DashboardCardHeader, EmptyState, PageHeader } from "@/components/dashboard";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";
import { VerificationBadge } from "@/components/blockchain/verification-badge";

interface Prescription {
  id: string;
  diagnosis: string;
  medications: { name?: string; medicine_name?: string; dosage: string; frequency: string }[];
  instructions?: string;
  valid_until?: string;
  verification_status?: string | null;
  blockchain_verified_at?: string | null;
  created_at: string;
}

export default function PrescriptionsPage() {
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/patients/prescriptions")
      .then((res) => setPrescriptions(res.data.data || []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader role="patient" title="Prescriptions" description="View prescriptions issued by your doctors with blockchain verification." />

      {loading ? (
        <div className="space-y-4">{[1, 2].map((i) => <Skeleton key={i} className="h-40 w-full rounded-2xl" />)}</div>
      ) : prescriptions.length === 0 ? (
        <DashboardCard padding="none"><EmptyState icon={ClipboardList} title="No prescriptions yet" /></DashboardCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {prescriptions.map((rx) => (
            <DashboardCard key={rx.id} padding="none" hover>
              <DashboardCardHeader
                title={rx.diagnosis}
                description={format(new Date(rx.created_at), "PPP")}
                action={<VerificationBadge status={rx.verification_status} />}
              />
              <DashboardCardBody className="space-y-3">
                {Array.isArray(rx.medications) && rx.medications.map((med, i) => (
                  <div key={i} className="p-3 rounded-lg bg-muted/30 text-sm">
                    <p className="font-medium">{med.medicine_name || med.name || JSON.stringify(med)}</p>
                    {med.dosage && <p className="text-muted-foreground">{med.dosage} · {med.frequency}</p>}
                  </div>
                ))}
                {rx.instructions && <p className="text-sm text-muted-foreground">{rx.instructions}</p>}
              </DashboardCardBody>
            </DashboardCard>
          ))}
        </div>
      )}
    </div>
  );
}
