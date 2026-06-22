"use client";

import { useEffect, useState } from "react";
import { formatDateTime12h } from "@/lib/format";
import { DashboardCard, PageHeader, StatusBadge } from "@/components/dashboard";
import { api, Appointment } from "@/lib/api";

export default function AdminAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  useEffect(() => {
    api.get("/admin/appointments").then((res) => setAppointments(res.data.data || [])).catch(() => {});
  }, []);

  return (
    <div className="space-y-8">
      <PageHeader role="admin" title="All Appointments" description="Monitor platform-wide appointments and statuses." />

      <div className="space-y-3">
        {appointments.map((a) => (
          <DashboardCard key={a.id} padding="md" hover>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">{formatDateTime12h(a.scheduled_at)}</p>
                <p className="text-sm text-muted-foreground">{a.reason || "General consultation"}</p>
              </div>
              <StatusBadge status={a.status} />
            </div>
          </DashboardCard>
        ))}
        {appointments.length === 0 && <p className="py-12 text-center text-muted-foreground">No appointments</p>}
      </div>
    </div>
  );
}
