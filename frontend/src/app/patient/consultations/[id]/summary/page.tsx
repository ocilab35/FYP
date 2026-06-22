"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { formatDateTimeFull12h } from "@/lib/format";
import { Download, FileText } from "lucide-react";
import Link from "next/link";
import { FadeIn } from "@/components/shared/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api, resolveFileUrl } from "@/lib/api";

export default function ConsultationSummaryPage() {
  const params = useParams();
  const appointmentId = params.id as string;
  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/consultations/appointments/${appointmentId}/summary`)
      .then((res) => setData(res.data.data))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  if (loading) return <Skeleton className="h-96 w-full" />;
  if (!data) return <p className="text-center py-12 text-muted-foreground">Summary not found</p>;

  const summary = data.consultation_summary as Record<string, string | null> | undefined;
  const rx = data.prescription as Record<string, unknown> | null;

  return (
    <div className="space-y-6 max-w-3xl">
      <FadeIn>
        <h1 className="text-2xl font-bold">Consultation Summary</h1>
        <p className="text-muted-foreground mt-1">
          {data.scheduled_at ? formatDateTimeFull12h(data.scheduled_at as string) : ""}
        </p>
        <Badge className="mt-2 capitalize">{String(data.status)}</Badge>
      </FadeIn>

      {summary && (
        <Card className="border-0 shadow-md">
          <CardHeader><CardTitle className="text-base">Clinical Summary</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            {summary.symptoms && <div><p className="font-medium">Symptoms</p><p className="text-muted-foreground">{summary.symptoms}</p></div>}
            {summary.diagnosis && <div><p className="font-medium">Diagnosis</p><p className="text-muted-foreground">{summary.diagnosis}</p></div>}
            {summary.treatment_plan && <div><p className="font-medium">Treatment Plan</p><p className="text-muted-foreground">{summary.treatment_plan}</p></div>}
            {summary.follow_up_notes && <div><p className="font-medium">Follow-up</p><p className="text-muted-foreground">{summary.follow_up_notes}</p></div>}
          </CardContent>
        </Card>
      )}

      {rx && (
        <Card className="border-0 shadow-md">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2"><FileText className="h-4 w-4" /> Prescription</CardTitle>
            {rx.pdf_url && (
              <a href={resolveFileUrl(rx.pdf_url as string)} target="_blank" rel="noopener noreferrer">
                <Button size="sm" variant="outline"><Download className="h-4 w-4 mr-2" /> Download PDF</Button>
              </a>
            )}
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p><span className="font-medium">Diagnosis:</span> {String(rx.diagnosis)}</p>
            {Array.isArray(rx.medications) && (rx.medications as { medicine_name?: string; dosage?: string }[]).map((m, i) => (
              <p key={i}>• {m.medicine_name} {m.dosage && `— ${m.dosage}`}</p>
            ))}
            {rx.instructions && <p className="text-muted-foreground">{String(rx.instructions)}</p>}
            {rx.recommendations && <p className="text-muted-foreground"><span className="font-medium text-foreground">Recommendations:</span> {String(rx.recommendations)}</p>}
          </CardContent>
        </Card>
      )}

      <Link href="/patient/consultations"><Button variant="outline">All Consultations</Button></Link>
    </div>
  );
}
