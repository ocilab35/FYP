"use client";

import { useEffect, useState } from "react";
import { LinkButton } from "@/components/shared/link-button";
import { Bot, Calendar, ClipboardList, Activity, Pill } from "lucide-react";
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  EmptyState,
  PageHeader,
  PromoPanel,
  StatusBadge,
} from "@/components/dashboard";
import { AIInsightsPanel } from "@/components/ai";
import { SubscriptionWidget } from "@/components/billing";
import { StatCard } from "@/components/shared/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, Appointment, getAIInsights, getSubscriptionStatus, AIInsights, SubscriptionStatus } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import { formatDateTime12h } from "@/lib/format";

export default function PatientDashboard() {
  const { user } = useAuthStore();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [insights, setInsights] = useState<AIInsights | null>(null);
  const [insightsLoading, setInsightsLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);

  useEffect(() => {
    api.get("/patients/appointments")
      .then((res) => setAppointments(res.data.data?.slice(0, 5) || []))
      .catch(() => {})
      .finally(() => setLoading(false));

    getSubscriptionStatus()
      .then(setSubscription)
      .catch(() => {})
      .finally(() => setSubscriptionLoading(false));

    getAIInsights()
      .then(setInsights)
      .catch(() => {})
      .finally(() => setInsightsLoading(false));
  }, []);

  const upcoming = appointments.filter((a) => ["pending", "confirmed"].includes(a.status));
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 17 ? "Good afternoon" : "Good evening";
  const riskScore = insights?.health_risk.risk_score;
  const alertCount = insights?.medication_alerts.alerts.length ?? 0;

  return (
    <div className="space-y-8">
      <PageHeader
        role="patient"
        title={`${greeting}, ${user?.first_name}`}
        description="Your personal health overview — appointments, care plans, and AI insights in one place."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard role="patient" index={0} title="Upcoming" value={upcoming.length} icon={Calendar} description="Appointments scheduled" />
        <StatCard
          role="patient"
          index={1}
          title="Health Risk"
          value={insightsLoading ? "..." : riskScore != null ? `${riskScore}%` : "—"}
          icon={Activity}
          description={insights?.health_risk.risk_category || "AI risk assessment"}
        />
        <StatCard
          role="patient"
          index={2}
          title="Med Alerts"
          value={insightsLoading ? "..." : alertCount}
          icon={Pill}
          description="Interaction warnings"
        />
        <StatCard role="patient" index={3} title="AI Doctor" value="Ask" icon={Bot} description="Conversational health assistant" />
      </div>

      <AIInsightsPanel insights={insights} loading={insightsLoading && subscription?.is_active} />

      <SubscriptionWidget subscription={subscription} loading={subscriptionLoading} />

      <div className="grid gap-6 lg:grid-cols-3">
        <DashboardCard className="lg:col-span-2" hover>
          <DashboardCardHeader
            title="Upcoming Appointments"
            description="Your next scheduled visits"
            action={
              <LinkButton variant="outline" size="sm" href="/patient/appointments" className="rounded-lg">
                View all
              </LinkButton>
            }
          />
          <DashboardCardBody>
            {loading ? (
              <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-[72px] w-full rounded-xl" />)}</div>
            ) : appointments.length === 0 ? (
              <EmptyState
                icon={Calendar}
                title="No appointments yet"
                description="Book your first consultation with a verified specialist."
                action={<LinkButton href="/patient/doctors">Find a doctor</LinkButton>}
              />
            ) : (
              <div className="space-y-3">
                {appointments.map((appt) => (
                  <div
                    key={appt.id}
                    className="flex items-center justify-between gap-4 rounded-xl border border-border/50 bg-muted/20 p-4 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="font-medium text-foreground">{formatDateTime12h(appt.scheduled_at)}</p>
                      <p className="truncate text-sm text-muted-foreground">{appt.reason || "General consultation"}</p>
                    </div>
                    <StatusBadge status={appt.status} />
                  </div>
                ))}
              </div>
            )}
          </DashboardCardBody>
        </DashboardCard>

        <PromoPanel
          variant="patient"
          icon={Bot}
          title="AI Health Assistant"
          description="Chat with our AI assistant — it asks clinical questions first, then provides personalized guidance using your health profile."
          href="/patient/ai-doctor"
          cta="Start conversation"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { href: "/patient/medical-records", icon: Activity, label: "Medical Records", desc: "Upload & view documents" },
          { href: "/patient/medications", icon: Pill, label: "Medications", desc: "Track active medicines" },
          { href: "/patient/prescriptions", icon: ClipboardList, label: "Prescriptions", desc: "Download verified PDFs" },
          { href: "/patient/consultations", icon: Calendar, label: "Consultations", desc: "Visit history & notes" },
        ].map((item) => (
          <LinkButton
            key={item.href}
            href={item.href}
            variant="outline"
            className="h-auto flex-col items-start gap-2 rounded-2xl border-border/60 bg-card p-5 text-left shadow-sm hover:shadow-md hover:bg-card"
          >
            <item.icon className="h-5 w-5 text-[oklch(0.35_0.12_250)]" />
            <span className="font-semibold text-foreground">{item.label}</span>
            <span className="text-xs font-normal text-muted-foreground">{item.desc}</span>
          </LinkButton>
        ))}
      </div>
    </div>
  );
}
