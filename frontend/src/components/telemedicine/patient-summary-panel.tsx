"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  Droplets,
  Heart,
  Pill,
  ShieldCheck,
  User,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { AppointmentContext } from "@/lib/api";
import { cn } from "@/lib/utils";

interface PatientSummaryPanelProps {
  context: AppointmentContext;
  className?: string;
}

export function PatientSummaryPanel({ context, className }: PatientSummaryPanelProps) {
  const { patient, appointment, medications } = context;
  const activeMeds = medications.filter((m) => m.is_active);

  return (
    <motion.aside
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.35 }}
      className={cn(
        "flex h-full flex-col overflow-hidden rounded-2xl border border-white/60 bg-white/85 shadow-[0_8px_32px_rgba(15,40,80,0.08)] backdrop-blur-xl",
        className
      )}
    >
      <div className="border-b border-border/50 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[oklch(0.35_0.12_250)] text-white">
            <User className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Patient Summary</p>
            <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Live chart</p>
          </div>
        </div>
      </div>

      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4 text-sm">
          <div>
            <p className="text-lg font-semibold text-foreground">{patient.full_name}</p>
            <p className="text-muted-foreground">
              {patient.age != null ? `${patient.age} yrs` : "Age N/A"} · {patient.gender || "—"}
            </p>
            {patient.mrn && (
              <Badge variant="outline" className="mt-2 font-mono text-[10px]">
                MRN {patient.mrn}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <Badge className="bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 hover:bg-emerald-50">
              <ShieldCheck className="mr-1 h-3 w-3" />
              Verified patient
            </Badge>
            {patient.allergies && (
              <Badge className="bg-red-50 text-red-700 ring-1 ring-red-600/15 hover:bg-red-50">
                <AlertTriangle className="mr-1 h-3 w-3" />
                Allergy alert
              </Badge>
            )}
          </div>

          <div className="rounded-xl border border-red-200/80 bg-red-50/80 p-3">
            <div className="flex items-center gap-2">
              <Droplets className="h-4 w-4 text-red-600" />
              <span className="text-xs font-medium text-red-700">Blood Group</span>
            </div>
            <p className="mt-1 font-semibold text-red-900">{patient.blood_group || "Not recorded"}</p>
          </div>

          <div className="rounded-xl border border-amber-200/80 bg-amber-50/80 p-3">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span className="text-xs font-medium text-amber-700">Allergies</span>
            </div>
            <p className={cn("mt-1", patient.allergies ? "font-medium text-amber-900" : "text-muted-foreground")}>
              {patient.allergies || "None reported"}
            </p>
          </div>

          <div className="rounded-xl border border-border/60 bg-muted/30 p-3">
            <div className="flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium">Chronic Conditions</span>
            </div>
            <p className="mt-1 text-foreground">{patient.chronic_conditions || "None reported"}</p>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-2">
              <Pill className="h-4 w-4 text-primary" />
              <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Active Medications
              </span>
            </div>
            {activeMeds.length === 0 ? (
              <p className="text-xs text-muted-foreground">None active</p>
            ) : (
              <ul className="space-y-2">
                {activeMeds.map((m) => (
                  <li key={m.id} className="rounded-lg border border-border/50 bg-white p-2.5 text-xs">
                    <p className="font-semibold text-foreground">{m.medicine_name}</p>
                    {(m.dosage || m.frequency) && (
                      <p className="text-muted-foreground">{[m.dosage, m.frequency].filter(Boolean).join(" · ")}</p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {patient.emergency_contact && (
            <div className="rounded-xl border border-orange-200/80 bg-orange-50/60 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-orange-700">Emergency Contact</p>
              <p className="mt-1 text-sm font-medium text-orange-900">{patient.emergency_contact}</p>
            </div>
          )}

          {appointment.reason && (
            <div className="border-t border-border/50 pt-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Visit reason</p>
              <p className="mt-1 text-sm">{appointment.reason}</p>
            </div>
          )}
        </div>
      </ScrollArea>
    </motion.aside>
  );
}
