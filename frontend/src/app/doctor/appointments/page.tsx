"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatDateTimeFull12h } from "@/lib/format";
import {
  canJoinConsultationRoom,
  getConsultationRoomMessage,
} from "@/lib/consultation-window";
import { useHospitalClock } from "@/hooks/use-hospital-clock";
import { Stethoscope, Video } from "lucide-react";
import { toast } from "sonner";
import { DashboardCard, PageHeader, StatusBadge } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { api, Appointment, getErrorMessage } from "@/lib/api";

export default function DoctorAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const now = useHospitalClock();

  const load = () => api.get("/doctors/appointments").then((res) => setAppointments(res.data.data || [])).catch(() => {});
  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    try {
      await api.post(`/doctors/appointments/${id}/approve`);
      toast.success("Appointment approved");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const reject = async (id: string) => {
    try {
      await api.post(`/doctors/appointments/${id}/reject`);
      toast.success("Appointment declined");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const complete = async (id: string) => {
    try {
      await api.patch(`/doctors/appointments/${id}`, { status: "completed" });
      toast.success("Marked completed");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader role="doctor" title="Appointments" description="Approve requests, then open EMR workspace or live consultation room." />

      <div className="space-y-4">
        {appointments.map((a) => {
          const canJoin = canJoinConsultationRoom(a, now);
          const roomMessage = getConsultationRoomMessage(a, now);
          const isApproved = ["approved", "confirmed", "active"].includes(a.status);

          return (
          <DashboardCard key={a.id} padding="md">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <p className="font-semibold">
                    {a.patient_name || "Patient"} · {formatDateTimeFull12h(a.scheduled_at)}
                  </p>
                  {a.patient_mrn && <p className="text-xs font-mono text-primary mt-0.5">{a.patient_mrn}</p>}
                  <p className="text-sm text-muted-foreground">{a.reason || "General consultation"}</p>
                  {roomMessage && (
                    <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{roomMessage}</p>
                  )}
                </div>
                <StatusBadge status={a.status} />
              </div>

              <div className="flex flex-wrap gap-2">
                {a.status === "pending" && (
                  <>
                    <Button size="sm" className="gradient-medical border-0 text-white" onClick={() => approve(a.id)}>Approve</Button>
                    <Button size="sm" variant="outline" onClick={() => reject(a.id)}>Reject</Button>
                  </>
                )}
                {isApproved && canJoin && (
                  <>
                    <Link href={`/doctor/consultations/${a.id}/room`}>
                      <Button size="sm" variant="secondary">
                        <Video className="h-4 w-4 mr-2" /> Live Room
                      </Button>
                    </Link>
                    <Link href={`/doctor/consultations/${a.id}`}>
                      <Button size="sm" className="gradient-medical border-0 text-white">
                        <Stethoscope className="h-4 w-4 mr-2" /> EMR Workspace
                      </Button>
                    </Link>
                  </>
                )}
                {(a.status === "approved" || a.status === "active") && (
                  <Button size="sm" variant="outline" onClick={() => complete(a.id)}>Mark Completed</Button>
                )}
              </div>
          </DashboardCard>
          );
        })}
        {appointments.length === 0 && <p className="text-center py-12 text-muted-foreground">No appointments</p>}
      </div>
    </div>
  );
}
