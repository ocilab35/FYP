"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDateTimeLong12h } from "@/lib/format";
import {
  canJoinConsultationRoom,
  getConsultationRoomMessage,
} from "@/lib/consultation-window";
import { useHospitalClock } from "@/hooks/use-hospital-clock";
import { Calendar, RefreshCw, Video, XCircle } from "lucide-react";
import {
  DashboardCard,
  DashboardCardBody,
  EmptyState,
  PageHeader,
  StatusBadge,
} from "@/components/dashboard";
import { SlotPicker } from "@/components/scheduling/slot-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api, Appointment, AvailableSlot, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";

const cancellable = ["pending", "confirmed"];

export default function PatientAppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const now = useHospitalClock();
  const [rescheduleAppt, setRescheduleAppt] = useState<Appointment | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleSlot, setRescheduleSlot] = useState<AvailableSlot | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const load = () => {
    setLoading(true);
    api.get("/patients/appointments")
      .then((res) => setAppointments(res.data.data || []))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const grouped = useMemo(() => ({
    upcoming: appointments.filter((a) => ["pending", "confirmed", "approved", "active", "rescheduled"].includes(a.status)),
    completed: appointments.filter((a) => a.status === "completed"),
    cancelled: appointments.filter((a) => ["cancelled", "no_show", "rejected"].includes(a.status)),
  }), [appointments]);

  const cancel = async (id: string) => {
    setActionLoading(true);
    try {
      await api.patch(`/patients/appointments/${id}/cancel`);
      toast.success("Appointment cancelled");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  };

  const reschedule = async () => {
    if (!rescheduleAppt || !rescheduleDate || !rescheduleSlot) return;
    setActionLoading(true);
    try {
      await api.patch(`/patients/appointments/${rescheduleAppt.id}/reschedule`, {
        appointment_date: rescheduleDate,
        start_time: rescheduleSlot.start_time,
      });
      toast.success("Appointment rescheduled");
      setRescheduleAppt(null);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setActionLoading(false);
    }
  };

  const renderList = (items: Appointment[], emptyTitle: string) => {
    if (items.length === 0) {
      return <p className="py-6 text-center text-sm text-muted-foreground">{emptyTitle}</p>;
    }
    return (
      <div className="space-y-3">
        {items.map((appt) => {
          const canJoin = canJoinConsultationRoom(appt, now);
          const roomMessage = getConsultationRoomMessage(appt, now);

          return (
          <div
            key={appt.id}
            className="rounded-xl border border-border/50 bg-muted/15 p-5 transition-all hover:border-border hover:bg-muted/25"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="font-semibold text-foreground">{formatDateTimeLong12h(appt.scheduled_at)}</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {appt.reason || "General consultation"} · {appt.duration_minutes} min
                </p>
                {roomMessage && (
                  <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">{roomMessage}</p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <StatusBadge status={appt.status} />
                {canJoin && (
                  <Link href={`/patient/consultations/${appt.id}`}>
                    <Button size="sm" className="rounded-lg bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]">
                      <Video className="mr-1 h-3.5 w-3.5" />
                      Join Room
                    </Button>
                  </Link>
                )}
              </div>
            </div>
            {cancellable.includes(appt.status) && (
              <div className="mt-4 flex gap-2 border-t border-border/50 pt-4">
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg"
                  disabled={actionLoading}
                  onClick={() => {
                    setRescheduleAppt(appt);
                    setRescheduleDate("");
                    setRescheduleSlot(null);
                  }}
                >
                  <RefreshCw className="mr-1 h-3.5 w-3.5" />
                  Reschedule
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="rounded-lg text-destructive hover:text-destructive"
                  disabled={actionLoading}
                  onClick={() => cancel(appt.id)}
                >
                  <XCircle className="mr-1 h-3.5 w-3.5" />
                  Cancel
                </Button>
              </div>
            )}
          </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-8">
      <PageHeader
        role="patient"
        title="My Appointments"
        description="Track, cancel, or reschedule your consultations on a unified timeline."
      />

      {loading ? (
        <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 w-full rounded-2xl" />)}</div>
      ) : appointments.length === 0 ? (
        <DashboardCard padding="none">
          <EmptyState icon={Calendar} title="No appointments scheduled" description="Book a consultation with a verified specialist." />
        </DashboardCard>
      ) : (
        <div className="space-y-6">
          {[
            { key: "upcoming", title: "Upcoming", items: grouped.upcoming, empty: "No upcoming appointments" },
            { key: "completed", title: "Completed", items: grouped.completed, empty: "No completed visits yet" },
            { key: "cancelled", title: "Cancelled", items: grouped.cancelled, empty: "No cancelled appointments" },
          ].map((section) => (
            <DashboardCard key={section.key} padding="none">
              <div className="border-b border-border/50 px-5 py-4 md:px-6">
                <h2 className="text-base font-semibold">{section.title}</h2>
                <p className="text-xs text-muted-foreground">{section.items.length} appointment{section.items.length !== 1 ? "s" : ""}</p>
              </div>
              <DashboardCardBody>{renderList(section.items, section.empty)}</DashboardCardBody>
            </DashboardCard>
          ))}
        </div>
      )}

      <Dialog open={!!rescheduleAppt} onOpenChange={(o) => !o && setRescheduleAppt(null)}>
        <DialogContent className="max-w-lg rounded-2xl">
          <DialogHeader>
            <DialogTitle>Reschedule Appointment</DialogTitle>
          </DialogHeader>
          {rescheduleAppt && (
            <div className="space-y-4 pt-2">
              <SlotPicker
                doctorId={rescheduleAppt.doctor_id}
                selectedDate={rescheduleDate}
                onDateChange={setRescheduleDate}
                selectedSlot={rescheduleSlot}
                onSlotSelect={setRescheduleSlot}
              />
              <Button
                className="h-11 w-full rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]"
                disabled={actionLoading || !rescheduleSlot}
                onClick={reschedule}
              >
                {actionLoading ? "Rescheduling..." : "Confirm Reschedule"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
