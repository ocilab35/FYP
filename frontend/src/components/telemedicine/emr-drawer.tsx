"use client";

import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { ExternalLink, FileText, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { AppointmentContext } from "@/lib/api";

interface EmrDrawerProps {
  open: boolean;
  onClose: () => void;
  context: AppointmentContext;
  appointmentId: string;
  onPreviewRecord: (fileUrl: string) => void;
}

export function EmrDrawer({ open, onClose, context, appointmentId, onPreviewRecord }: EmrDrawerProps) {
  const { patient, medical_records } = context;

  const mriRecords = medical_records.filter((r) => r.record_type === "mri");
  const xrayRecords = medical_records.filter((r) => r.record_type === "xray");
  const labRecords = medical_records.filter((r) => ["lab_report", "blood_report"].includes(r.record_type));

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 320, damping: 32 }}
            className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col border-l border-border/60 bg-white/95 shadow-2xl backdrop-blur-xl"
          >
            <div className="flex items-center justify-between border-b border-border/50 px-5 py-4">
              <div>
                <p className="text-sm font-semibold text-foreground">EMR Quick Access</p>
                <p className="text-xs text-muted-foreground">{patient.full_name} · {patient.mrn || "No MRN"}</p>
              </div>
              <Button variant="ghost" size="icon" onClick={onClose} aria-label="Close EMR drawer">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <Tabs defaultValue="mri" className="flex flex-1 flex-col overflow-hidden">
              <TabsList className="mx-4 mt-3 grid w-auto grid-cols-4">
                <TabsTrigger value="mri" className="text-xs">MRI</TabsTrigger>
                <TabsTrigger value="xray" className="text-xs">X-Ray</TabsTrigger>
                <TabsTrigger value="lab" className="text-xs">Lab</TabsTrigger>
                <TabsTrigger value="profile" className="text-xs">Profile</TabsTrigger>
              </TabsList>

              {[
                { value: "mri", records: mriRecords },
                { value: "xray", records: xrayRecords },
                { value: "lab", records: labRecords },
              ].map(({ value, records }) => (
                <TabsContent key={value} value={value} className="flex-1 overflow-hidden px-4 data-[state=inactive]:hidden">
                  <ScrollArea className="h-[calc(100vh-12rem)]">
                    {records.length === 0 ? (
                      <p className="py-12 text-center text-sm text-muted-foreground">No records in this category</p>
                    ) : (
                      <div className="space-y-2 pb-4">
                        {records.map((r) => (
                          <div key={r.id} className="flex items-center justify-between gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium">{r.title}</p>
                              <p className="text-[10px] text-muted-foreground">{format(new Date(r.recorded_at), "PP")}</p>
                            </div>
                            {r.file_url && (
                              <Button size="sm" variant="outline" className="rounded-lg text-xs" onClick={() => onPreviewRecord(r.file_url!)}>
                                <FileText className="mr-1 h-3 w-3" />
                                Open
                              </Button>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </ScrollArea>
                </TabsContent>
              ))}

              <TabsContent value="profile" className="flex-1 overflow-hidden px-4 data-[state=inactive]:hidden">
                <ScrollArea className="h-[calc(100vh-12rem)] pb-4">
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Blood Group</p>
                      <p className="mt-1 font-medium">{patient.blood_group || "—"}</p>
                    </div>
                    <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3">
                      <p className="text-[10px] font-semibold uppercase text-amber-700">Allergies</p>
                      <p className="mt-1">{patient.allergies || "None reported"}</p>
                    </div>
                    <div className="rounded-xl border border-border/50 bg-muted/20 p-3">
                      <p className="text-[10px] font-semibold uppercase text-muted-foreground">Chronic Conditions</p>
                      <p className="mt-1">{patient.chronic_conditions || "None reported"}</p>
                    </div>
                    {patient.emergency_contact && (
                      <div className="rounded-xl border border-orange-200/80 bg-orange-50/60 p-3">
                        <p className="text-[10px] font-semibold uppercase text-orange-700">Emergency</p>
                        <p className="mt-1">{patient.emergency_contact}</p>
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </TabsContent>
            </Tabs>

            <div className="border-t border-border/50 p-4">
              <Link href={`/doctor/consultations/${appointmentId}`}>
                <Button variant="outline" className="w-full rounded-xl">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Open Full EMR Workspace
                </Button>
              </Link>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
