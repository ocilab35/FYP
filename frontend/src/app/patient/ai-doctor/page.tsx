"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  Bot,
  CheckCircle,
  MessageSquarePlus,
  Send,
  Stethoscope,
} from "lucide-react";
import Link from "next/link";
import { LinkButton } from "@/components/shared/link-button";
import {
  ChatMessageBubble,
  MedicalContextCard,
  TypingIndicator,
} from "@/components/ai";
import {
  DashboardCard,
  DashboardCardBody,
  DashboardCardHeader,
  PageHeader,
  StatusBadge,
} from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  AIChatAssessment,
  AIChatMessage,
  AIConsultation,
  PatientProfile,
  api,
  getErrorMessage,
  getSubscriptionStatus,
  sendAIDoctorMessage,
  SubscriptionStatus,
} from "@/lib/api";
import { toast } from "sonner";

const STARTER_PROMPTS = [
  "I have a headache",
  "I've been feeling tired lately",
  "I have a persistent cough",
  "My stomach has been hurting",
];

const MEDICAL_DISCLAIMER =
  "AI-generated guidance is for informational purposes only and does not replace professional medical advice.";

export default function AIDoctorPage() {
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [thinking, setThinking] = useState(false);
  const [followUps, setFollowUps] = useState<string[]>([]);
  const [assessment, setAssessment] = useState<AIChatAssessment | null>(null);
  const [isEmergency, setIsEmergency] = useState(false);
  const [disclaimer, setDisclaimer] = useState(MEDICAL_DISCLAIMER);
  const [history, setHistory] = useState<AIConsultation[]>([]);
  const [profile, setProfile] = useState<PatientProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [subscription, setSubscription] = useState<SubscriptionStatus | null>(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const loadHistory = useCallback(() => {
    api.get("/ai-doctor/history").then((res) => setHistory(res.data.data || [])).catch(() => {});
  }, []);

  useEffect(() => {
    loadHistory();
    getSubscriptionStatus()
      .then(setSubscription)
      .catch(() => {})
      .finally(() => setSubscriptionLoading(false));
    api.get("/patients/profile")
      .then((res) => setProfile(res.data.data))
      .catch(() => {})
      .finally(() => setProfileLoading(false));
  }, [loadHistory]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, thinking]);

  const startNewChat = () => {
    setMessages([]);
    setSessionId(undefined);
    setFollowUps([]);
    setAssessment(null);
    setIsEmergency(false);
    setDisclaimer(MEDICAL_DISCLAIMER);
    inputRef.current?.focus();
  };

  const loadSession = async (id: string) => {
    try {
      const { data } = await api.get(`/ai-doctor/sessions/${id}`);
      const session = data.data as AIConsultation;
      setSessionId(session.id);
      setMessages(session.conversation || []);
      setAssessment({
        predicted_conditions: session.predicted_conditions,
        recommendations: session.recommendations,
        recommended_specialists: session.recommended_specialists,
        risk_level: session.risk_level,
        summary: session.summary,
      });
      setFollowUps([]);
      setIsEmergency(session.risk_level === "critical");
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;

    setInput("");
    setFollowUps([]);
    setThinking(true);

    const optimistic: AIChatMessage = { role: "user", content: trimmed };
    setMessages((prev) => [...prev, optimistic]);

    try {
      const response = await sendAIDoctorMessage(trimmed, sessionId);
      setSessionId(response.session_id);
      setMessages(response.conversation);
      setFollowUps(response.follow_up_questions || []);
      setIsEmergency(response.is_emergency);
      setDisclaimer(response.disclaimer || MEDICAL_DISCLAIMER);
      if (response.assessment) setAssessment(response.assessment);
      loadHistory();
    } catch (e) {
      setMessages((prev) => prev.slice(0, -1));
      toast.error(getErrorMessage(e));
    } finally {
      setThinking(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  if (!subscriptionLoading && subscription && !subscription.is_active) {
    return (
      <div className="mx-auto max-w-lg space-y-6 py-12">
        <PageHeader
          role="patient"
          title="AI Health Assistant"
          description="Subscription required for AI-powered healthcare services."
        />
        <DashboardCard padding="none" variant="elevated">
          <DashboardCardBody className="space-y-4 py-10 text-center">
            <Bot className="mx-auto h-12 w-12 text-[oklch(0.35_0.12_250)]" />
            <p className="text-muted-foreground">
              Your AI Doctor subscription has expired. Renew your subscription to continue using
              AI-powered healthcare services.
            </p>
            <div className="flex justify-center gap-3">
              <LinkButton href="/patient/billing/plans" className="rounded-xl">
                Renew Subscription
              </LinkButton>
              <LinkButton href="/patient/billing/plans" variant="outline" className="rounded-xl">
                View Plans
              </LinkButton>
            </div>
          </DashboardCardBody>
        </DashboardCard>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        role="patient"
        title="AI Health Assistant"
        description="Conversational symptom guidance with clinical questioning — powered by Qwen AI."
        badge={
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[oklch(0.55_0.1_195/0.1)] px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-[oklch(0.35_0.12_250)]">
            <Bot className="h-3 w-3" />
            Qwen AI
          </span>
        }
        action={
          <Button variant="outline" size="sm" className="rounded-xl" onClick={startNewChat}>
            <MessageSquarePlus className="mr-2 h-4 w-4" />
            New chat
          </Button>
        }
      />

      <div className="rounded-xl border border-amber-200/60 bg-amber-50/40 px-4 py-3 text-xs text-amber-900">
        {disclaimer}
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="flex flex-col lg:col-span-3 lg:min-h-[640px]">
          <DashboardCard padding="none" variant="elevated" className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-border/50 px-4 py-3">
              <div>
                <p className="text-sm font-semibold">Health Conversation</p>
                <p className="text-[10px] text-muted-foreground">
                  {thinking ? "AI is thinking..." : "Ask about symptoms — I'll ask follow-up questions first"}
                </p>
              </div>
              {assessment && (
                <StatusBadge status={assessment.risk_level} type="risk" />
              )}
            </div>

            <ScrollArea className="flex-1 px-4 py-4" style={{ maxHeight: "calc(640px - 180px)" }}>
              <div className="space-y-4">
                {messages.length === 0 && !thinking && (
                  <div className="py-8 text-center">
                    <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[oklch(0.35_0.12_250)]/10">
                      <Bot className="h-7 w-7 text-[oklch(0.35_0.12_250)]" />
                    </div>
                    <p className="mb-1 font-medium">How can I help you today?</p>
                    <p className="mb-6 text-sm text-muted-foreground">
                      Describe how you feel. I&apos;ll ask clarifying questions before any assessment.
                    </p>
                    <div className="flex flex-wrap justify-center gap-2">
                      {STARTER_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          onClick={() => sendMessage(prompt)}
                          className="rounded-full border border-border/60 bg-white px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:border-[oklch(0.55_0.1_195/0.4)] hover:text-foreground"
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {messages.map((m, i) => (
                  <ChatMessageBubble key={i} message={m} index={i} />
                ))}

                {thinking && (
                  <div className="flex gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-[oklch(0.35_0.12_250)]">
                      <Bot className="h-4 w-4" />
                    </div>
                    <TypingIndicator />
                  </div>
                )}
                <div ref={scrollRef} />
              </div>
            </ScrollArea>

            {isEmergency && (
              <div className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-red-50 p-3 text-sm text-red-800">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Seek emergency medical care immediately. Do not wait for AI guidance.
              </div>
            )}

            {followUps.length > 0 && !thinking && (
              <div className="border-t border-border/50 px-4 py-3">
                <p className="mb-2 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Suggested follow-ups
                </p>
                <div className="flex flex-wrap gap-2">
                  {followUps.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => sendMessage(q)}
                      className="rounded-full border border-[oklch(0.35_0.12_250)]/20 bg-[oklch(0.35_0.12_250)]/5 px-3 py-1 text-xs text-[oklch(0.35_0.12_250)] hover:bg-[oklch(0.35_0.12_250)]/10"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="border-t border-border/50 p-4">
              <div className="flex gap-2">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Describe your symptoms..."
                  rows={1}
                  disabled={thinking}
                  className="min-h-[44px] max-h-32 flex-1 resize-none rounded-xl border border-border/60 bg-white px-4 py-3 text-sm outline-none ring-[oklch(0.35_0.12_250)]/20 focus:ring-2 disabled:opacity-60"
                />
                <Button
                  onClick={() => sendMessage(input)}
                  disabled={thinking || !input.trim()}
                  className="h-11 w-11 shrink-0 rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]"
                  size="icon"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </DashboardCard>

          <AnimatePresence>
            {assessment && assessment.summary && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mt-4"
              >
                <DashboardCard padding="none" variant="elevated">
                  <DashboardCardHeader
                    title="Assessment"
                    action={
                      assessment.health_risk_score != null ? (
                        <Badge variant="outline" className="rounded-full">
                          Risk Score: {assessment.health_risk_score}%
                        </Badge>
                      ) : undefined
                    }
                  />
                  <DashboardCardBody className="space-y-4">
                    <p className="text-sm leading-relaxed text-muted-foreground">{assessment.summary}</p>

                    {assessment.predicted_conditions.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Possible Conditions</h4>
                        <div className="space-y-2">
                          {assessment.predicted_conditions.map((c) => (
                            <div
                              key={c.name}
                              className="flex items-center justify-between rounded-xl bg-muted/25 px-3 py-2 text-sm"
                            >
                              <span>{c.name}</span>
                              <span className="font-semibold text-primary">
                                {Math.round(c.probability * 100)}%
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {assessment.recommendations.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Recommendations</h4>
                        <ul className="space-y-1.5 text-sm text-muted-foreground">
                          {assessment.recommendations.map((r, i) => (
                            <li key={i} className="flex gap-2">
                              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                              {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {assessment.recommended_specialists.length > 0 && (
                      <div>
                        <h4 className="mb-2 text-sm font-medium">Recommended Specialists</h4>
                        <div className="flex flex-wrap gap-2">
                          {assessment.recommended_specialists.map((s) => (
                            <Link key={s} href={`/patient/doctors?specialization=${encodeURIComponent(s)}`}>
                              <Badge
                                variant="outline"
                                className="cursor-pointer rounded-full hover:bg-[oklch(0.35_0.12_250)]/10"
                              >
                                <Stethoscope className="mr-1 h-3 w-3" />
                                {s}
                              </Badge>
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </DashboardCardBody>
                </DashboardCard>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-4 lg:col-span-2">
          <MedicalContextCard profile={profile} loading={profileLoading} />

          <DashboardCard padding="none">
            <DashboardCardHeader title="Conversation History" description="Previous AI sessions" />
            <DashboardCardBody>
              {history.length === 0 ? (
                <p className="py-6 text-center text-sm text-muted-foreground">No previous conversations</p>
              ) : (
                <div className="max-h-[320px] space-y-2 overflow-y-auto">
                  {history.map((h) => (
                    <button
                      key={h.id}
                      type="button"
                      onClick={() => loadSession(h.id)}
                      className={`w-full rounded-xl border p-3 text-left text-sm transition-colors hover:bg-muted/40 ${
                        sessionId === h.id ? "border-[oklch(0.35_0.12_250)]/40 bg-[oklch(0.35_0.12_250)]/5" : "border-border/50"
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <StatusBadge status={h.risk_level} type="risk" />
                        <span className="text-xs text-muted-foreground">
                          {new Date(h.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <p className="line-clamp-2 text-muted-foreground">{h.summary}</p>
                    </button>
                  ))}
                </div>
              )}
            </DashboardCardBody>
          </DashboardCard>
        </div>
      </div>
    </div>
  );
}
