"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bot, Send, AlertTriangle, CheckCircle } from "lucide-react";
import { DashboardCard, DashboardCardBody, DashboardCardHeader, PageHeader, StatusBadge } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { api, AIConsultation, getErrorMessage } from "@/lib/api";
import { toast } from "sonner";

const COMMON_SYMPTOMS = ["Fever", "Headache", "Cough", "Chest Pain", "Fatigue", "Nausea", "Dizziness", "Skin Rash", "Abdominal Pain", "Shortness of Breath"];

const SUGGESTED_PROMPTS = ["I have had a fever for 2 days", "Persistent headache with nausea", "Chest discomfort when exercising"];

export default function AIDoctorPage() {
  const [selected, setSelected] = useState<string[]>([]);
  const [customSymptom, setCustomSymptom] = useState("");
  const [additionalInfo, setAdditionalInfo] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIConsultation | null>(null);
  const [history, setHistory] = useState<AIConsultation[]>([]);

  useEffect(() => {
    api.get("/ai-doctor/history").then((res) => setHistory(res.data.data || [])).catch(() => {});
  }, [result]);

  const toggleSymptom = (s: string) => {
    setSelected((prev) => prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]);
  };

  const addCustom = () => {
    if (customSymptom.trim() && !selected.includes(customSymptom.trim())) {
      setSelected((prev) => [...prev, customSymptom.trim()]);
      setCustomSymptom("");
    }
  };

  const analyze = async () => {
    if (selected.length === 0) { toast.error("Select at least one symptom"); return; }
    setLoading(true);
    try {
      const { data } = await api.post("/ai-doctor/consult", {
        symptoms: selected,
        additional_info: additionalInfo || undefined,
      });
      setResult(data.data);
      toast.success("Analysis complete");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        role="patient"
        title="AI Doctor"
        description="Preliminary symptom analysis — not a substitute for professional medical care."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.55_0.1_195/0.1)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[oklch(0.35_0.12_250)]">
            <Bot className="h-3 w-3" />
            AI Assistant
          </span>
        }
      />

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-4 lg:col-span-3">
          <DashboardCard padding="none" variant="elevated">
            <DashboardCardHeader
              title="Describe your symptoms"
              description="Select symptoms or add your own — then run analysis"
            />
            <DashboardCardBody className="space-y-5">
              <div className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <p className="mb-3 text-xs font-medium uppercase tracking-wide text-muted-foreground">Suggested prompts</p>
                <div className="flex flex-wrap gap-2">
                  {SUGGESTED_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      type="button"
                      onClick={() => setAdditionalInfo(prompt)}
                      className="rounded-full border border-border/60 bg-white px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-[oklch(0.55_0.1_195/0.4)] hover:text-foreground"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {COMMON_SYMPTOMS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => toggleSymptom(s)}
                    className={`rounded-full border px-3 py-1.5 text-sm font-medium transition-all duration-200 ${
                      selected.includes(s)
                        ? "border-transparent bg-[oklch(0.35_0.12_250)] text-white shadow-md"
                        : "border-border/60 bg-white text-foreground hover:bg-muted/50"
                    }`}
                    aria-pressed={selected.includes(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>

              {selected.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl bg-[oklch(0.35_0.12_250)] p-4 text-sm text-white"
                >
                  <p className="mb-1 text-xs font-medium uppercase tracking-wide text-white/70">You selected</p>
                  <p>{selected.join(", ")}</p>
                </motion.div>
              )}

              <div className="flex gap-2">
                <Input
                  placeholder="Add custom symptom..."
                  className="h-11 rounded-xl"
                  value={customSymptom}
                  onChange={(e) => setCustomSymptom(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addCustom()}
                  aria-label="Custom symptom"
                />
                <Button variant="outline" className="rounded-xl" onClick={addCustom}>Add</Button>
              </div>
              <Input
                placeholder="Additional information (optional)..."
                className="h-11 rounded-xl"
                value={additionalInfo}
                onChange={(e) => setAdditionalInfo(e.target.value)}
              />
              <Button
                className="h-11 w-full rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]"
                onClick={analyze}
                disabled={loading || selected.length === 0}
              >
                {loading ? "Analyzing..." : <><Send className="mr-2 h-4 w-4" /> Analyze Symptoms</>}
              </Button>
            </DashboardCardBody>
          </DashboardCard>

          <AnimatePresence>
            {result && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <DashboardCard padding="none" variant="elevated">
                  <DashboardCardHeader
                    title="Analysis Results"
                    action={<StatusBadge status={result.risk_level} type="risk" />}
                  />
                  <DashboardCardBody className="space-y-4">
                    <div className="rounded-2xl bg-muted/30 p-4 text-sm leading-relaxed">{result.summary}</div>
                    {(result.risk_level === "critical" || result.risk_level === "high") && (
                      <div className="flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                        Please consult a healthcare professional immediately.
                      </div>
                    )}
                    <div>
                      <h4 className="mb-2 font-medium">Predicted Conditions</h4>
                      <div className="space-y-2">
                        {result.predicted_conditions.map((c) => (
                          <div key={c.name} className="flex items-center justify-between rounded-xl bg-muted/25 p-3">
                            <span className="text-sm">{c.name}</span>
                            <span className="text-sm font-semibold text-primary">{Math.round(c.probability * 100)}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <h4 className="mb-2 font-medium">Recommendations</h4>
                      <ul className="space-y-2">
                        {result.recommendations.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-sm text-muted-foreground">
                            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-[oklch(0.72_0.12_155)]" />{r}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="mb-2 font-medium">Recommended Specialists</h4>
                      <div className="flex flex-wrap gap-2">
                        {result.recommended_specialists.map((s) => (
                          <Badge key={s} variant="outline" className="rounded-full">{s}</Badge>
                        ))}
                      </div>
                    </div>
                  </DashboardCardBody>
                </DashboardCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <DashboardCard padding="none" className="lg:col-span-2">
          <DashboardCardHeader title="Conversation History" description="Previous AI consultations" />
          <DashboardCardBody>
            {history.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">No previous consultations</p>
            ) : (
              <div className="max-h-[560px] space-y-3 overflow-y-auto">
                {history.map((h) => (
                  <div key={h.id} className="rounded-xl border border-border/50 bg-muted/15 p-3 text-sm">
                    <div className="mb-2 flex items-center justify-between gap-2">
                      <StatusBadge status={h.risk_level} type="risk" />
                      <span className="text-xs text-muted-foreground">{new Date(h.created_at).toLocaleDateString()}</span>
                    </div>
                    <p className="line-clamp-3 text-muted-foreground">{h.summary}</p>
                  </div>
                ))}
              </div>
            )}
          </DashboardCardBody>
        </DashboardCard>
      </div>
    </div>
  );
}
