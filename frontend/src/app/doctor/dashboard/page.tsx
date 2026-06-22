"use client";

import { useEffect, useState } from "react";
import { format } from "date-fns";
import { formatAppointmentTime12h } from "@/lib/format";
import { Calendar, Users, Clock, CheckCircle, DollarSign } from "lucide-react";
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  EmptyState,
  PageHeader,
  PromoPanel,
  StatusBadge,
} from "@/components/dashboard";
import { StatCard } from "@/components/shared/stat-card";
import { LinkButton } from "@/components/shared/link-button";
import { api, Appointment } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

interface ScheduleAppointment extends Appointment {
  patient_name?: string;
}

export default function DoctorDashboard() {
  const { user } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [todaySchedule, setTodaySchedule] = useState<ScheduleAppointment[]>([]);
  const today = format(new Date(), "yyyy-MM-dd");

  useEffect(() => {
    api.get("/doctors/appointments").then((res) => setAppointments(res.data.data || [])).catch(() => {});
    api.get("/doctors/schedule", { params: { date: today } })
      .then((res) => setTodaySchedule(res.data.data?.appointments || []))
      .catch(() => {});
  }, [today]);

  const pending = appointments.filter((a) => a.status === "pending");
  const completed = appointments.filter((a) => a.status === "completed").length;

  return (
    <div className="space-y-8">
      <PageHeader
        role="doctor"
        title={`Dr. ${user?.last_name}'s Workspace`}
        description={format(new Date(), "EEEE, MMMM d, yyyy")}
        badge={
          <span className="inline-flex items-center rounded-full bg-[oklch(0.55_0.1_195/0.12)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[oklch(0.35_0.12_250)]">
            Clinical Dashboard
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard role="doctor" index={0} title="Today's Schedule" value={todaySchedule.length} icon={Calendar} />
        <StatCard role="doctor" index={1} title="Pending Requests" value={pending.length} icon={Clock} trend={pending.length ? "Needs review" : undefined} />
        <StatCard role="doctor" index={2} title="Total Patients" value={appointments.length} icon={Users} />
        <StatCard role="doctor" index={3} title="Completed" value={completed} icon={CheckCircle} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardCard className="lg:col-span-2" variant="elevated">
          <DashboardCardHeader
            title="Today's Schedule"
            description="Appointments for the current day"
            action={
              <LinkButton variant="outline" size="sm" href="/doctor/appointments" className="rounded-lg">
                View all
              </LinkButton>
            }
          />
          <DashboardCardBody>
            {todaySchedule.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="Clear schedule"
                description="No appointments scheduled for today."
                action={<LinkButton href="/doctor/availability">Manage availability</LinkButton>}
              />
            ) : (
              <div className="relative space-y-0">
                <div className="absolute left-[19px] top-3 bottom-3 w-px bg-border/80" aria-hidden="true" />
                {todaySchedule.map((a) => (
                  <div key={a.id} className="relative flex gap-4 pb-4 last:pb-0">
                    <div className="relative z-10 mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full border-2 border-[oklch(0.55_0.1_195)] bg-card" />
                    <div className="flex flex-1 items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 p-4">
                      <div>
                        <p className="font-semibold text-foreground">{formatAppointmentTime12h(a.scheduled_at)}</p>
                        <p className="text-sm text-muted-foreground">{a.patient_name || "Patient"} · {a.reason || "Consultation"}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </DashboardCardBody>
        </DashboardCard>

        <div className="space-y-4">
          <PromoPanel
            variant="doctor"
            icon={Calendar}
            title="Manage Availability"
            description="Update working hours, break times, and slot duration for patient bookings."
            href="/doctor/availability"
            cta="Edit schedule"
          />
          <DashboardCard padding="md" variant="ghost">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[oklch(0.35_0.12_250/0.1)]">
                <DollarSign className="h-5 w-5 text-[oklch(0.35_0.12_250)]" />
              </div>
              <div>
                <p className="text-sm font-semibold">Revenue Overview</p>
                <p className="text-xs text-muted-foreground">{completed} completed consultations</p>
              </div>
            </div>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
