"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { format } from "date-fns";
import { formatDateTime12h } from "@/lib/format";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  Droplets,
  FileText,
  Heart,
  Pill,
  Save,
  User,
} from "lucide-react";
import { toast } from "sonner";
import { FadeIn } from "@/components/shared/page-transition";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  api,
  AppointmentContext,
  fetchAuthenticatedBlob,
  getErrorMessage,
  RECORD_TYPES,
} from "@/lib/api";

export default function ConsultationWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const appointmentId = params.id as string;

  const [ctx, setCtx] = useState<AppointmentContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [recordFilter, setRecordFilter] = useState("all");
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const [notes, setNotes] = useState({
    symptoms: "",
    diagnosis: "",
    treatment_plan: "",
    follow_up_notes: "",
  });

  const load = useCallback(() => {
    setLoading(true);
    api.get(`/doctors/appointments/${appointmentId}/context`)
      .then((res) => {
        const data = res.data.data as AppointmentContext;
        setCtx(data);
        if (data.consultation_note) {
          setNotes({
            symptoms: data.consultation_note.symptoms || "",
            diagnosis: data.consultation_note.diagnosis || "",
            treatment_plan: data.consultation_note.treatment_plan || "",
            follow_up_notes: data.consultation_note.follow_up_notes || "",
          });
        }
      })
      .catch((e) => toast.error(getErrorMessage(e)))
      .finally(() => setLoading(false));
  }, [appointmentId]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const timer = setInterval(() => {
      api.post(`/doctors/appointments/${appointmentId}/notes/draft`, notes).catch(() => {});
    }, 10000);
    return () => clearInterval(timer);
  }, [appointmentId, notes]);

  const [rxMeds, setRxMeds] = useState([{ medicine_name: "", dosage: "", frequency: "", duration: "" }]);
  const [rxDiagnosis, setRxDiagnosis] = useState("");
  const [rxInstructions, setRxInstructions] = useState("");

  const issuePrescription = async () => {
    if (!rxDiagnosis.trim()) {
      toast.error("Diagnosis required for prescription");
      return;
    }
    try {
      await api.post("/doctors/prescriptions", {
        appointment_id: appointmentId,
        diagnosis: rxDiagnosis,
        medications: rxMeds.filter((m) => m.medicine_name.trim()),
        instructions: rxInstructions || undefined,
      });
      toast.success("Prescription issued");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const saveNotes = async () => {
    setSaving(true);
    try {
      await api.post(`/doctors/appointments/${appointmentId}/notes`, notes);
      toast.success("Consultation notes saved");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const previewRecord = async (fileUrl: string) => {
    try {
      const url = await fetchAuthenticatedBlob(fileUrl);
      setPreviewUrl(url);
    } catch {
      toast.error("Could not load file");
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid lg:grid-cols-12 gap-4">
          <Skeleton className="h-96 lg:col-span-3" />
          <Skeleton className="h-96 lg:col-span-5" />
          <Skeleton className="h-96 lg:col-span-4" />
        </div>
      </div>
    );
  }

  if (!ctx) {
    return <p className="text-center py-12 text-muted-foreground">Appointment not found</p>;
  }

  const { patient, appointment, medical_records, medications, prescriptions } = ctx;
  const filteredRecords =
    recordFilter === "all"
      ? medical_records
      : medical_records.filter((r) => r.record_type === recordFilter);

  const typeLabel = (t: string) => RECORD_TYPES.find((r) => r.value === t)?.label || t;

  return (
    <div className="space-y-4">
      <FadeIn className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.push("/doctor/appointments")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-xl md:text-2xl font-bold">Consultation Workspace</h1>
            <p className="text-sm text-muted-foreground">
              {patient.full_name} · MRN {patient.mrn || "—"} · {formatDateTime12h(appointment.scheduled_at)}
            </p>
          </div>
        </div>
        <Badge className="capitalize self-start">{appointment.status}</Badge>
      </FadeIn>

      <div className="grid lg:grid-cols-12 gap-4 min-h-[calc(100vh-12rem)]">
        {/* LEFT — Patient chart */}
        <Card className="lg:col-span-3 border-0 shadow-md flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Patient Chart
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 text-sm flex-1">
            <div>
              <p className="font-semibold text-lg">{patient.full_name}</p>
              <p className="text-muted-foreground">
                {patient.age != null ? `${patient.age} yrs` : "Age N/A"} · {patient.gender || "—"}
              </p>
              {patient.mrn && <p className="text-xs font-mono mt-1 text-primary">{patient.mrn}</p>}
            </div>

            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900">
              <Droplets className="h-4 w-4 text-red-600 shrink-0" />
              <div>
                <p className="text-xs font-medium text-red-700 dark:text-red-400">Blood Group</p>
                <p className="font-semibold">{patient.blood_group || "Not recorded"}</p>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <p className="text-xs font-medium text-amber-700 dark:text-amber-400">Allergies</p>
              </div>
              <p className={patient.allergies ? "font-medium text-amber-900 dark:text-amber-200" : "text-muted-foreground"}>
                {patient.allergies || "None reported"}
              </p>
            </div>

            <div className="p-3 rounded-lg bg-muted/40">
              <div className="flex items-center gap-2 mb-1">
                <Heart className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium">Chronic Conditions</p>
              </div>
              <p>{patient.chronic_conditions || "None reported"}</p>
            </div>

            <div>
              <div className="flex items-center gap-2 mb-2">
                <Pill className="h-4 w-4 text-primary" />
                <p className="text-xs font-medium">Current Medications</p>
              </div>
              {medications.filter((m) => m.is_active).length === 0 ? (
                <p className="text-muted-foreground text-xs">None active</p>
              ) : (
                <ul className="space-y-2">
                  {medications.filter((m) => m.is_active).map((m) => (
                    <li key={m.id} className="text-xs p-2 rounded bg-background border">
                      <span className="font-medium">{m.medicine_name}</span>
                      {m.dosage && <span className="text-muted-foreground"> · {m.dosage}</span>}
                      {m.frequency && <p className="text-muted-foreground">{m.frequency}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {patient.emergency_contact && (
              <p className="text-xs text-muted-foreground pt-2 border-t">
                Emergency: {patient.emergency_contact}
              </p>
            )}

            {appointment.reason && (
              <p className="text-xs pt-2 border-t">
                <span className="font-medium">Visit reason:</span> {appointment.reason}
              </p>
            )}
          </CardContent>
        </Card>

        {/* CENTER — Records + AI placeholder */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <Card className="border-0 shadow-md border-dashed">
            <CardContent className="py-8 text-center">
              <Bot className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium text-muted-foreground">AI Clinical Assistant</p>
              <p className="text-xs text-muted-foreground mt-1">Coming soon — differential diagnosis & coding support</p>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-md flex-1 flex flex-col min-h-0">
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4" /> Medical Records
              </CardTitle>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col min-h-0 pt-0">
              <Tabs value={recordFilter} onValueChange={setRecordFilter} className="flex-1 flex flex-col min-h-0">
                <TabsList className="flex-wrap h-auto gap-1">
                  <TabsTrigger value="all" className="text-xs">All</TabsTrigger>
                  {RECORD_TYPES.map((t) => (
                    <TabsTrigger key={t.value} value={t.value} className="text-xs">{t.label}</TabsTrigger>
                  ))}
                </TabsList>
                <TabsContent value={recordFilter} className="flex-1 mt-3 min-h-0">
                  <ScrollArea className="h-[280px] pr-3">
                    {filteredRecords.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">No records</p>
                    ) : (
                      <div className="space-y-2">
                        {filteredRecords.map((r) => (
                          <div key={r.id} className="p-3 rounded-lg border bg-muted/20 flex justify-between gap-2">
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{r.title}</p>
                              <p className="text-xs text-muted-foreground">
                                {typeLabel(r.record_type)} · {format(new Date(r.recorded_at), "PP")}
                              </p>
                            </div>
                            {r.file_url && (
                              <Button size="sm" variant="outline" onClick={() => previewRecord(r.file_url!)}>
                                View
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              </Tabs>

              {prescriptions.length > 0 && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-medium mb-2">Previous Prescriptions</p>
                  <ScrollArea className="h-24">
                    {prescriptions.map((p) => (
                      <p key={p.id} className="text-xs text-muted-foreground mb-1">
                        {format(new Date(p.created_at), "PP")}: {p.diagnosis}
                      </p>
                    ))}
                  </ScrollArea>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* RIGHT — Clinical documentation */}
        <Card className="lg:col-span-4 border-0 shadow-md flex flex-col">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Clinical Documentation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 flex-1 flex flex-col">
            <div className="space-y-2 flex-1">
              <Label>Symptoms</Label>
              <Textarea
                value={notes.symptoms}
                onChange={(e) => setNotes({ ...notes, symptoms: e.target.value })}
                placeholder="Chief complaint and symptom history..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Diagnosis</Label>
              <Textarea
                value={notes.diagnosis}
                onChange={(e) => setNotes({ ...notes, diagnosis: e.target.value })}
                placeholder="Primary and secondary diagnoses..."
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label>Treatment Plan</Label>
              <Textarea
                value={notes.treatment_plan}
                onChange={(e) => setNotes({ ...notes, treatment_plan: e.target.value })}
                placeholder="Medications, procedures, referrals..."
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>Follow-up Notes</Label>
              <Textarea
                value={notes.follow_up_notes}
                onChange={(e) => setNotes({ ...notes, follow_up_notes: e.target.value })}
                placeholder="Follow-up date, warnings, patient instructions..."
                rows={2}
              />
            </div>
            <Button onClick={saveNotes} disabled={saving} className="w-full gradient-medical border-0 text-white">
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Consultation Notes"}
            </Button>
            <div className="pt-4 border-t space-y-3">
              <Label className="font-medium">Issue Prescription</Label>
              <Textarea placeholder="Diagnosis for prescription" value={rxDiagnosis} onChange={(e) => setRxDiagnosis(e.target.value)} rows={2} />
              {rxMeds.map((m, i) => (
                <div key={i} className="grid grid-cols-2 gap-2">
                  <input className="border rounded px-2 py-1 text-sm" placeholder="Medicine" value={m.medicine_name} onChange={(e) => { const c = [...rxMeds]; c[i].medicine_name = e.target.value; setRxMeds(c); }} />
                  <input className="border rounded px-2 py-1 text-sm" placeholder="Dosage" value={m.dosage} onChange={(e) => { const c = [...rxMeds]; c[i].dosage = e.target.value; setRxMeds(c); }} />
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setRxMeds([...rxMeds, { medicine_name: "", dosage: "", frequency: "", duration: "" }])}>+ Add medicine</Button>
              <Textarea placeholder="Patient instructions" value={rxInstructions} onChange={(e) => setRxInstructions(e.target.value)} rows={2} />
              <Button type="button" variant="secondary" className="w-full" onClick={issuePrescription}>Generate Prescription PDF</Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {previewUrl && (
        <div className="fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4" onClick={() => setPreviewUrl(null)}>
          <div className="max-w-4xl max-h-[90vh] w-full bg-background rounded-xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <iframe src={previewUrl} className="w-full h-[80vh]" title="Record preview" />
          </div>
        </div>
      )}
    </div>
  );
}
