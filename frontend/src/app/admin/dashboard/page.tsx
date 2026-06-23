"use client";

import { useEffect, useState } from "react";
import { LinkButton } from "@/components/shared/link-button";
import { Users, Stethoscope, Calendar, Bot, UserCheck, Clock, Shield, Activity, CreditCard, DollarSign } from "lucide-react";
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  PageHeader,
} from "@/components/dashboard";
import { StatCard } from "@/components/shared/stat-card";
import { api, AdminStats } from "@/lib/api";

export default function AdminDashboard() {
  const [stats, setStats] = useState<AdminStats | null>(null);

  useEffect(() => {
    api.get("/admin/dashboard").then((res) => setStats(res.data.data)).catch(() => {});
  }, []);

  const quickActions = [
    { href: "/admin/doctors", label: "Doctor Approvals", desc: `${stats?.pending_doctor_approvals || 0} pending`, icon: Stethoscope, urgent: !!stats?.pending_doctor_approvals },
    { href: "/admin/users", label: "Manage Users", desc: `${stats?.total_users || 0} total users`, icon: Users },
    { href: "/admin/blockchain", label: "Blockchain Activity", desc: "Verification events", icon: Shield },
    { href: "/admin/ai-activity", label: "AI Activity Monitor", desc: `${stats?.ai_consultations_today || 0} today`, icon: Bot },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        role="admin"
        title="Operations Center"
        description="Real-time platform health, user metrics, and system activity."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-emerald-700 ring-1 ring-emerald-600/15">
            <Activity className="h-3 w-3" />
            System Online
          </span>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard role="admin" index={0} title="Total Users" value={stats?.total_users ?? "—"} icon={Users} />
        <StatCard role="admin" index={1} title="Patients" value={stats?.total_patients ?? "—"} icon={UserCheck} />
        <StatCard role="admin" index={2} title="Doctors" value={stats?.total_doctors ?? "—"} icon={Stethoscope} />
        <StatCard role="admin" index={3} title="Pending Approvals" value={stats?.pending_doctor_approvals ?? "—"} icon={Clock} trend={stats?.pending_doctor_approvals ? "Action required" : undefined} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard role="admin" index={8} title="Total Revenue" value={stats?.total_revenue != null ? `PKR ${stats.total_revenue.toLocaleString()}` : "—"} icon={DollarSign} />
        <StatCard role="admin" index={9} title="Subscription Revenue" value={stats?.subscription_revenue != null ? `PKR ${stats.subscription_revenue.toLocaleString()}` : "—"} icon={CreditCard} />
        <StatCard role="admin" index={10} title="Appointment Revenue" value={stats?.appointment_revenue != null ? `PKR ${stats.appointment_revenue.toLocaleString()}` : "—"} icon={Calendar} />
        <StatCard role="admin" index={11} title="Active Subscribers" value={stats?.active_subscribers ?? "—"} icon={Bot} description={`${stats?.expired_subscribers ?? 0} expired`} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard role="admin" index={4} title="Appointments" value={stats?.total_appointments ?? "—"} icon={Calendar} />
        <StatCard role="admin" index={5} title="Today" value={stats?.appointments_today ?? "—"} icon={Calendar} description="Appointments today" />
        <StatCard role="admin" index={6} title="AI Consultations" value={stats?.ai_consultations_today ?? "—"} icon={Bot} description="Today" />
        <StatCard role="admin" index={7} title="Active Users" value={stats?.active_users_today ?? "—"} icon={Users} description="Today" />
      </div>

      <DashboardCard variant="elevated">
        <DashboardCardHeader title="Quick Actions" description="Platform management shortcuts" />
        <DashboardCardBody>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {quickActions.map((item) => (
              <DashboardCard key={item.href} hover padding="md" className="border-border/50">
                <div className="flex items-start gap-3">
                  <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.urgent ? "bg-amber-50 text-amber-700" : "bg-[oklch(0.72_0.12_155/0.12)] text-[oklch(0.45_0.1_155)]"}`}>
                    <item.icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-sm text-foreground">{item.label}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{item.desc}</p>
                    <LinkButton variant="link" size="sm" href={item.href} className="mt-2 h-auto p-0 text-xs">
                      Open →
                    </LinkButton>
                  </div>
                </div>
              </DashboardCard>
            ))}
          </div>
        </DashboardCardBody>
      </DashboardCard>
    </div>
  );
}
