"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Circle } from "lucide-react";
import { toast } from "sonner";
import { ConsultationRoom } from "@/components/telemedicine/consultation-room";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, AppointmentContext, getErrorMessage } from "@/lib/api";
import { formatDateTime12h } from "@/lib/format";
import { useAuthStore } from "@/store/auth-store";

export default function DoctorConsultationRoomPage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.id as string;
  const { user } = useAuthStore();
  const [session, setSession] = useState<{ session_id: string; ws_url: string; status: string } | null>(null);
  const [context, setContext] = useState<AppointmentContext | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get(`/consultations/appointments/${appointmentId}/session`),
      api.get(`/doctors/appointments/${appointmentId}/context`),
    ])
      .then(([sessionRes, ctxRes]) => {
        setSession(sessionRes.data.data);
        setContext(ctxRes.data.data);
      })
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-12 w-full max-w-xl rounded-xl" />
        <Skeleton className="h-[calc(100vh-7rem)] w-full rounded-2xl" />
      </div>
    );
  }

  if (!session) return <p className="py-12 text-center text-muted-foreground">Session unavailable</p>;

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col gap-3 -m-4 md:-m-6 lg:-m-8 p-4 md:p-6 lg:p-8 bg-[oklch(0.97_0.006_240)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/80 px-4 py-3 shadow-sm backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="rounded-xl" onClick={() => router.push("/doctor/appointments")} aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-semibold text-foreground">Live Consultation</h1>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-medium text-emerald-700">
                <Circle className="h-2 w-2 fill-emerald-500 text-emerald-500" />
                In session
              </span>
            </div>
            {context && (
              <p className="text-xs text-muted-foreground">
                {context.patient.full_name} · {formatDateTime12h(context.appointment.scheduled_at)}
              </p>
            )}
          </div>
        </div>
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Telemedicine Workspace</p>
      </header>

      <ConsultationRoom
        sessionId={session.session_id}
        wsPath={session.ws_url}
        userId={user?.id || ""}
        userRole="doctor"
        context={context}
        appointmentId={appointmentId}
      />
    </div>
  );
}
