"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, Pill, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  PageHeader,
} from "@/components/dashboard";
import { PrescriptionIntakePanel, PrescriptionReviewDialog } from "@/components/medications";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  api,
  extractPrescriptionMedications,
  getErrorMessage,
  Medication,
  PrescriptionExtractionResult,
} from "@/lib/api";

export default function MedicationsPage() {
  const router = useRouter();
  const [meds, setMeds] = useState<Medication[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [showAiSection, setShowAiSection] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [extraction, setExtraction] = useState<PrescriptionExtractionResult | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [form, setForm] = useState({
    medicine_name: "",
    dosage: "",
    frequency: "",
    duration: "",
    notes: "",
  });

  const load = () =>
    api.get("/patients/medications").then((res) => setMeds(res.data.data || [])).catch(() => {});

  useEffect(() => {
    load();
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrl?.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const addMed = async () => {
    if (!form.medicine_name.trim()) {
      toast.error("Medicine name is required");
      return;
    }
    try {
      await api.post("/patients/medications", form);
      toast.success("Medication added");
      setForm({ medicine_name: "", dosage: "", frequency: "", duration: "", notes: "" });
      setShowForm(false);
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleExtract = async (file: File, url: string) => {
    const token = localStorage.getItem("access_token");
    if (!token) {
      toast.error("Please log in as a patient to scan prescriptions.");
      router.push("/login");
      return;
    }

    setProcessing(true);
    setPreviewUrl(url);
    try {
      const data = await extractPrescriptionMedications(file);
      setExtraction(data);
      setReviewOpen(true);

      if (!data.medications.length) {
        toast.warning("No medications detected — review and add manually if needed.");
      } else {
        toast.success(`Detected ${data.medications.length} medication(s)`);
      }
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setProcessing(false);
    }
  };

  const toggleActive = async (med: Medication) => {
    try {
      await api.patch(`/patients/medications/${med.id}`, { is_active: !med.is_active });
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const remove = async (id: string) => {
    try {
      await api.delete(`/patients/medications/${id}`);
      toast.success("Medication removed");
      load();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <PageHeader
        role="patient"
        title="Current Medications"
        description="Track medicines you are currently taking."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              onClick={() => setShowAiSection(!showAiSection)}
              className="rounded-xl border-primary/30"
            >
              <Sparkles className="mr-2 h-4 w-4 text-primary" />
              Scan Prescription
            </Button>
            <Button
              onClick={() => setShowForm(!showForm)}
              className="rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]"
            >
              <Plus className="mr-2 h-4 w-4" /> Add Medication
            </Button>
          </div>
        }
      />

      {showAiSection && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
          <DashboardCard padding="none">
            <DashboardCardHeader
              title="AI Prescription Scanner"
              description="Upload or photograph a doctor's prescription. We extract medication details locally — no external AI keys required."
            />
            <DashboardCardBody className="space-y-4">
              {processing && (
                <div className="flex items-center gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm">
                  <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  <div>
                    <p className="font-medium">Analyzing prescription...</p>
                    <p className="text-muted-foreground">Running OCR and parsing medication fields</p>
                  </div>
                </div>
              )}
              <PrescriptionIntakePanel onImageReady={handleExtract} disabled={processing} />
            </DashboardCardBody>
          </DashboardCard>
        </motion.div>
      )}

      {showForm && (
        <DashboardCard padding="none">
          <DashboardCardHeader title="New Medication" />
          <DashboardCardBody className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Medicine Name *</Label>
                <Input value={form.medicine_name} onChange={(e) => setForm({ ...form, medicine_name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Dosage</Label>
                <Input value={form.dosage} onChange={(e) => setForm({ ...form, dosage: e.target.value })} placeholder="e.g. 500mg" />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Input value={form.frequency} onChange={(e) => setForm({ ...form, frequency: e.target.value })} placeholder="e.g. Twice daily" />
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Input value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 14 days" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} />
            </div>
            <Button onClick={addMed} className="rounded-xl">Save Medication</Button>
          </DashboardCardBody>
        </DashboardCard>
      )}

      <div className="space-y-3">
        {meds.map((m) => (
          <DashboardCard key={m.id} padding="md" hover className={!m.is_active ? "opacity-60" : ""}>
            <div className="flex items-start justify-between gap-4">
              <div className="flex gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Pill className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{m.medicine_name}</p>
                    <Badge variant={m.is_active ? "default" : "outline"}>{m.is_active ? "Active" : "Inactive"}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ") || "No dosage info"}
                  </p>
                  {m.notes && <p className="text-sm mt-2">{m.notes}</p>}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button size="sm" variant="outline" onClick={() => toggleActive(m)}>
                  {m.is_active ? "Mark inactive" : "Reactivate"}
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => remove(m.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DashboardCard>
        ))}
        {meds.length === 0 && (
          <DashboardCard padding="md"><p className="py-8 text-center text-muted-foreground">No medications recorded</p></DashboardCard>
        )}
      </div>

      <PrescriptionReviewDialog
        open={reviewOpen}
        onOpenChange={setReviewOpen}
        extraction={extraction}
        previewUrl={previewUrl}
        onSaved={load}
      />
    </div>
  );
}
