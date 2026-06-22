"use client";

import { motion } from "framer-motion";
import { format } from "date-fns";
import {
  ClipboardList,
  FileText,
  MessageSquare,
  Pill,
  StickyNote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppointmentContext } from "@/lib/api";
import { RECORD_TYPES } from "@/lib/api";
import { cn } from "@/lib/utils";
import { ConsultationChatPanel, type ChatMessage } from "./consultation-chat-panel";

interface ClinicalWorkspacePanelProps {
  context: AppointmentContext;
  messages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (v: string) => void;
  onSendChat: () => void;
  userId: string;
  connected: boolean;
  onPreviewRecord: (fileUrl: string) => void;
  className?: string;
}

export function ClinicalWorkspacePanel({
  context,
  messages,
  chatInput,
  onChatInputChange,
  onSendChat,
  userId,
  connected,
  onPreviewRecord,
  className,
}: ClinicalWorkspacePanelProps) {
  const { medical_records, medications, prescriptions, consultation_note } = context;
  const typeLabel = (t: string) => RECORD_TYPES.find((r) => r.value === t)?.label || t;

  return (
    <motion.aside
      initial={{ opacity: 0, x: 12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/85 shadow-[0_8px_32px_rgba(15,40,80,0.08)] backdrop-blur-xl",
        className
      )}
    >
      <Tabs defaultValue="records" className="flex h-full flex-col">
        <div className="border-b border-border/50 px-3 pt-3">
          <p className="mb-2 px-1 text-sm font-semibold text-foreground">Clinical Workspace</p>
          <TabsList className="grid h-auto w-full grid-cols-5 gap-0.5 bg-muted/50 p-1">
            <TabsTrigger value="records" className="gap-1 px-1.5 py-1.5 text-[10px]">
              <FileText className="h-3 w-3 shrink-0" />
              <span className="hidden xl:inline">Records</span>
            </TabsTrigger>
            <TabsTrigger value="prescriptions" className="gap-1 px-1.5 py-1.5 text-[10px]">
              <ClipboardList className="h-3 w-3 shrink-0" />
              <span className="hidden xl:inline">Rx</span>
            </TabsTrigger>
            <TabsTrigger value="medications" className="gap-1 px-1.5 py-1.5 text-[10px]">
              <Pill className="h-3 w-3 shrink-0" />
              <span className="hidden xl:inline">Meds</span>
            </TabsTrigger>
            <TabsTrigger value="notes" className="gap-1 px-1.5 py-1.5 text-[10px]">
              <StickyNote className="h-3 w-3 shrink-0" />
              <span className="hidden xl:inline">Notes</span>
            </TabsTrigger>
            <TabsTrigger value="chat" className="gap-1 px-1.5 py-1.5 text-[10px]">
              <MessageSquare className="h-3 w-3 shrink-0" />
              <span className="hidden xl:inline">Chat</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="records" className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          <ScrollArea className="h-full max-h-[calc(100vh-16rem)] p-3">
            {medical_records.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No medical records</p>
            ) : (
              <div className="space-y-2">
                {medical_records.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 p-3 transition-colors hover:bg-muted/40"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">{r.title}</p>
                      <p className="text-[10px] text-muted-foreground">
                        {typeLabel(r.record_type)} · {format(new Date(r.recorded_at), "PP")}
                      </p>
                    </div>
                    {r.file_url && (
                      <Button size="sm" variant="outline" className="h-8 shrink-0 rounded-lg text-xs" onClick={() => onPreviewRecord(r.file_url!)}>
                        View
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="prescriptions" className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          <ScrollArea className="h-full max-h-[calc(100vh-16rem)] p-3">
            {prescriptions.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No prescriptions</p>
            ) : (
              <div className="space-y-2">
                {prescriptions.map((p) => (
                  <div key={p.id} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                    <p className="text-sm font-medium">{p.diagnosis}</p>
                    <p className="text-[10px] text-muted-foreground">{format(new Date(p.created_at), "PPP")}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="medications" className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          <ScrollArea className="h-full max-h-[calc(100vh-16rem)] p-3">
            {medications.filter((m) => m.is_active).length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">No active medications</p>
            ) : (
              <div className="space-y-2">
                {medications.filter((m) => m.is_active).map((m) => (
                  <div key={m.id} className="rounded-xl border border-border/50 bg-muted/20 p-3 text-sm">
                    <p className="font-medium">{m.medicine_name}</p>
                    <p className="text-xs text-muted-foreground">{[m.dosage, m.frequency, m.duration].filter(Boolean).join(" · ")}</p>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="notes" className="mt-0 flex-1 overflow-hidden data-[state=inactive]:hidden">
          <ScrollArea className="h-full max-h-[calc(100vh-16rem)] p-3">
            {consultation_note ? (
              <div className="space-y-3 text-sm">
                {[
                  { label: "Symptoms", value: consultation_note.symptoms },
                  { label: "Diagnosis", value: consultation_note.diagnosis },
                  { label: "Treatment Plan", value: consultation_note.treatment_plan },
                  { label: "Follow-up", value: consultation_note.follow_up_notes },
                ].map(({ label, value }) =>
                  value ? (
                    <div key={label} className="rounded-xl border border-border/50 bg-muted/20 p-3">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                      <p className="mt-1 whitespace-pre-wrap">{value}</p>
                    </div>
                  ) : null
                )}
              </div>
            ) : (
              <p className="py-8 text-center text-xs text-muted-foreground">No consultation notes yet</p>
            )}
          </ScrollArea>
        </TabsContent>

        <TabsContent value="chat" className="mt-0 flex flex-1 flex-col overflow-hidden data-[state=inactive]:hidden">
          <ConsultationChatPanel
            messages={messages}
            input={chatInput}
            onInputChange={onChatInputChange}
            onSend={onSendChat}
            userId={userId}
            connected={connected}
            compact
            className="h-full min-h-0 rounded-none border-0 shadow-none"
          />
        </TabsContent>
      </Tabs>
    </motion.aside>
  );
}
