import { cn } from "@/lib/utils";

const appointmentStatusStyles: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 ring-amber-600/15",
  confirmed: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  completed: "bg-sky-50 text-sky-700 ring-sky-600/15",
  cancelled: "bg-red-50 text-red-700 ring-red-600/15",
  rescheduled: "bg-violet-50 text-violet-700 ring-violet-600/15",
  no_show: "bg-slate-100 text-slate-600 ring-slate-500/10",
};

const riskStyles: Record<string, string> = {
  low: "bg-emerald-50 text-emerald-700 ring-emerald-600/15",
  moderate: "bg-amber-50 text-amber-700 ring-amber-600/15",
  high: "bg-orange-50 text-orange-700 ring-orange-600/15",
  critical: "bg-red-50 text-red-700 ring-red-600/15",
};

interface StatusBadgeProps {
  status: string;
  type?: "appointment" | "risk" | "generic";
  className?: string;
}

export function StatusBadge({ status, type = "appointment", className }: StatusBadgeProps) {
  const normalized = status.toLowerCase();
  const styles =
    type === "risk"
      ? riskStyles[normalized] ?? "bg-muted text-muted-foreground ring-border/50"
      : appointmentStatusStyles[normalized] ?? "bg-muted text-muted-foreground ring-border/50";

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium capitalize ring-1 ring-inset",
        styles,
        className
      )}
    >
      {status.replace(/_/g, " ")}
    </span>
  );
}

export function getAppointmentStatusClass(status: string) {
  return appointmentStatusStyles[status.toLowerCase()] ?? "bg-muted text-muted-foreground";
}
