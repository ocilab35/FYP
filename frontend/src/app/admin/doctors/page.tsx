"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardCard, EmptyState, PageHeader } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Stethoscope } from "lucide-react";
import { api, getErrorMessage } from "@/lib/api";

interface PendingDoctor {
  id: string;
  name: string;
  email: string;
  specialization: string;
  license_number: string;
  experience_years: number;
  expertise_tags: string[];
}

export default function AdminDoctorsPage() {
  const [doctors, setDoctors] = useState<PendingDoctor[]>([]);

  const load = () => api.get("/admin/doctors/pending").then((res) => setDoctors(res.data.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    try {
      await api.patch(`/admin/doctors/${id}/approve`);
      toast.success("Doctor approved");
      load();
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  const reject = async (id: string) => {
    try {
      await api.patch(`/admin/doctors/${id}/reject`);
      toast.success("Doctor rejected");
      load();
    } catch (e) { toast.error(getErrorMessage(e)); }
  };

  return (
    <div className="space-y-8">
      <PageHeader role="admin" title="Doctor Approvals" description="Review and approve doctor registrations." />

      {doctors.length === 0 ? (
        <DashboardCard padding="none"><EmptyState icon={Stethoscope} title="No pending applications" /></DashboardCard>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {doctors.map((d) => (
            <DashboardCard key={d.id} padding="md" hover>
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">{d.name}</h3>
                    <p className="text-sm text-primary">{d.specialization}</p>
                  </div>
                  <Badge variant="secondary">Pending</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{d.email}</p>
                <p className="text-sm">License: {d.license_number} · {d.experience_years} yrs</p>
                <div className="flex flex-wrap gap-1">{d.expertise_tags.map((t) => <Badge key={t} variant="outline" className="text-xs">{t}</Badge>)}</div>
                <div className="flex gap-2 pt-2">
                  <Button size="sm" className="rounded-lg" onClick={() => approve(d.id)}>Approve</Button>
                  <Button size="sm" variant="outline" className="rounded-lg" onClick={() => reject(d.id)}>Reject</Button>
                </div>
              </div>
            </DashboardCard>
          ))}
        </div>
      )}
    </div>
  );
}
