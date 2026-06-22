"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, Plus, Sparkles, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { api, ExtractedMedication, getErrorMessage, PrescriptionExtractionResult } from "@/lib/api";
import { cn } from "@/lib/utils";

type ReviewMedication = ExtractedMedication & { id: string };

interface PrescriptionReviewDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  extraction: PrescriptionExtractionResult | null;
  previewUrl?: string | null;
  onSaved: () => void;
}

function confidenceTone(score: number): string {
  if (score >= 0.75) return "bg-emerald-50 text-emerald-700 ring-emerald-600/15";
  if (score >= 0.5) return "bg-amber-50 text-amber-700 ring-amber-600/15";
  return "bg-red-50 text-red-700 ring-red-600/15";
}

function confidenceLabel(score: number): string {
  return `${Math.round(score * 100)}% confidence`;
}

function toReviewItems(meds: ExtractedMedication[]): ReviewMedication[] {
  return meds.map((m, i) => ({ ...m, id: `extracted-${i}-${m.medicine_name}` }));
}

export function PrescriptionReviewDialog({
  open,
  onOpenChange,
  extraction,
  previewUrl,
  onSaved,
}: PrescriptionReviewDialogProps) {
  const [items, setItems] = useState<ReviewMedication[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (extraction) {
      setItems(toReviewItems(extraction.medications));
    }
  }, [extraction]);

  const updateItem = (id: string, field: keyof ReviewMedication, value: string) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)));
  };

  const removeItem = (id: string) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };

  const addBlankItem = () => {
    setItems((prev) => [
      ...prev,
      {
        id: `manual-${Date.now()}`,
        medicine_name: "",
        dosage: "",
        frequency: "",
        duration: "",
        notes: "",
        confidence: 1,
      },
    ]);
  };

  const saveAll = async () => {
    const valid = items.filter((i) => i.medicine_name.trim());
    if (!valid.length) {
      toast.error("Add at least one medication with a name.");
      return;
    }

    setSaving(true);
    try {
      await api.post("/patients/medications/bulk", {
        medications: valid.map(({ medicine_name, dosage, frequency, duration, notes }) => ({
          medicine_name: medicine_name.trim(),
          dosage: dosage?.trim() || null,
          frequency: frequency?.trim() || null,
          duration: duration?.trim() || null,
          notes: notes?.trim() || null,
          is_active: true,
        })),
      });
      toast.success(`${valid.length} medication(s) saved`);
      onOpenChange(false);
      onSaved();
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const overallConfidence = extraction?.overall_confidence ?? 0;
  const warnings = extraction?.warnings ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl" showCloseButton={!saving}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Review Extracted Medications
          </DialogTitle>
          <DialogDescription>
            Edit, remove, or add medications before saving to your profile.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-muted/30 p-3">
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                confidenceTone(overallConfidence)
              )}
            >
              {confidenceLabel(overallConfidence)}
            </span>
            {extraction?.ocr_engine && (
              <span className="text-xs text-muted-foreground">OCR: {extraction.ocr_engine}</span>
            )}
          </div>

          {warnings.length > 0 && (
            <div className="space-y-2 rounded-xl border border-amber-200 bg-amber-50/80 p-3 dark:border-amber-900/40 dark:bg-amber-950/20">
              {warnings.map((w) => (
                <p key={w} className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-100">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  {w}
                </p>
              ))}
            </div>
          )}

          {previewUrl && (
            <div className="overflow-hidden rounded-xl border">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Prescription" className="max-h-36 w-full object-contain bg-muted/20" />
            </div>
          )}

          {items.length === 0 ? (
            <div className="rounded-xl border border-dashed p-8 text-center">
              <p className="text-sm text-muted-foreground">
                No medications were detected. Add them manually below or try a clearer photo.
              </p>
              <Button type="button" variant="outline" className="mt-4 rounded-xl" onClick={addBlankItem}>
                <Plus className="mr-2 h-4 w-4" />
                Add medication manually
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {items.map((item, index) => (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.04 }}
                  className="rounded-xl border p-4 shadow-sm"
                >
                  <div className="mb-3 flex items-start justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">#{index + 1}</span>
                      <span
                        className={cn(
                          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset",
                          confidenceTone(item.confidence)
                        )}
                      >
                        {confidenceLabel(item.confidence)}
                      </span>
                    </div>
                    <Button
                      type="button"
                      size="icon-sm"
                      variant="ghost"
                      className="text-destructive"
                      onClick={() => removeItem(item.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className={cn("space-y-1.5 sm:col-span-2")}>
                      <Label>Medicine Name *</Label>
                      <Input
                        value={item.medicine_name}
                        onChange={(e) => updateItem(item.id, "medicine_name", e.target.value)}
                        placeholder="e.g. Amoxicillin"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Dosage</Label>
                      <Input
                        value={item.dosage || ""}
                        onChange={(e) => updateItem(item.id, "dosage", e.target.value)}
                        placeholder="e.g. 500mg"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Frequency</Label>
                      <Input
                        value={item.frequency || ""}
                        onChange={(e) => updateItem(item.id, "frequency", e.target.value)}
                        placeholder="e.g. Twice daily"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Duration</Label>
                      <Input
                        value={item.duration || ""}
                        onChange={(e) => updateItem(item.id, "duration", e.target.value)}
                        placeholder="e.g. 7 days"
                      />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label>Instructions / Notes</Label>
                      <Textarea
                        value={item.notes || ""}
                        onChange={(e) => updateItem(item.id, "notes", e.target.value)}
                        rows={2}
                        placeholder="Take after meals, etc."
                      />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-row sm:justify-between">
          <Button type="button" variant="outline" className="rounded-xl" onClick={addBlankItem} disabled={saving}>
            <Plus className="mr-2 h-4 w-4" />
            Add medication
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="ghost" className="rounded-xl" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="button"
              className="rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]"
              onClick={saveAll}
              disabled={saving}
            >
              {saving ? "Saving..." : "Confirm & Save"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
