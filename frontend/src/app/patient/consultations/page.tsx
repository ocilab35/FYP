"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDateTimeFull12h } from "@/lib/format";
import {
  canJoinConsultationRoom,
  getConsultationRoomMessage,
  isConsultationListed,
} from "@/lib/consultation-window";
import { useHospitalClock } from "@/hooks/use-hospital-clock";
import { Video } from "lucide-react";
import { DashboardCard, EmptyState, PageHeader, StatusBadge } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { api, Appointment } from "@/lib/api";

export default function PatientConsultationsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const now = useHospitalClock();

  useEffect(() => {
    api.get("/patients/appointments").then((res) => setAppointments(res.data.data || []));
  }, []);

  const consultations = useMemo(
    () =>
      appointments
        .filter(isConsultationListed)
        .sort((a, b) => new Date(b.scheduled_at).getTime() - new Date(a.scheduled_at).getTime()),
    [appointments]
  );

  return (
    <div className="space-y-8">
      <PageHeader
        role="patient"
        title="My Consultations"
        description="Review past visits, join active sessions, and access consultation summaries."
      />

      {consultations.length === 0 ? (
        <DashboardCard padding="none">
          <EmptyState icon={Video} title="No consultations yet" description="Completed and active visits will appear here." />
        </DashboardCard>
      ) : (
        <div className="relative space-y-0">
          <div className="absolute left-[19px] top-4 bottom-4 w-px bg-border/80" aria-hidden="true" />
          {consultations.map((a) => {
            const canJoin = canJoinConsultationRoom(a, now);
            const roomMessage = getConsultationRoomMessage(a, now);

            return (
              <div key={a.id} className="relative flex gap-4 pb-6 last:pb-0">
                <div className="relative z-10 mt-5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[oklch(0.55_0.1_195)] bg-card" />
                <DashboardCard className="flex-1" padding="md" hover>
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-semibold text-foreground">{formatDateTimeFull12h(a.scheduled_at)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{a.reason || "Consultation"}</p>
                      {roomMessage && (
                        <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{roomMessage}</p>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge status={a.status} />
                      {canJoin && (
                        <Link href={`/patient/consultations/${a.id}`}>
                          <Button size="sm" className="rounded-lg bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]">
                            Join Room
                          </Button>
                        </Link>
                      )}
                      {a.status === "completed" && (
                        <Link href={`/patient/consultations/${a.id}/summary`}>
                          <Button size="sm" variant="outline" className="rounded-lg">
                            View Summary
                          </Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </DashboardCard>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
