import type { LucideIcon } from "lucide-react";

export type DashboardRole = "patient" | "doctor" | "admin";

export interface RoleTheme {
  id: DashboardRole;
  label: string;
  sidebar: string;
  sidebarBorder: string;
  sidebarForeground: string;
  sidebarMuted: string;
  sidebarActive: string;
  sidebarActiveFg: string;
  sidebarHover: string;
  accent: string;
  accentSoft: string;
  pageBg: string;
  headerBg: string;
  statVariant: "soft" | "clinical" | "ops";
}

export const roleThemes: Record<DashboardRole, RoleTheme> = {
  patient: {
    id: "patient",
    label: "Patient Portal",
    sidebar: "bg-white border-slate-200/80",
    sidebarBorder: "border-slate-200/80",
    sidebarForeground: "text-slate-700",
    sidebarMuted: "text-slate-500",
    sidebarActive: "bg-[oklch(0.55_0.1_195/0.12)] text-[oklch(0.35_0.12_250)]",
    sidebarActiveFg: "text-[oklch(0.35_0.12_250)]",
    sidebarHover: "hover:bg-slate-50 hover:text-slate-900",
    accent: "oklch(0.55 0.1 195)",
    accentSoft: "oklch(0.55 0.1 195 / 0.1)",
    pageBg: "bg-[oklch(0.985_0.004_220)]",
    headerBg: "bg-white/85 backdrop-blur-xl border-slate-200/70",
    statVariant: "soft",
  },
  doctor: {
    id: "doctor",
    label: "Clinical Workspace",
    sidebar: "bg-[oklch(0.22_0.04_250)] border-[oklch(0.32_0.05_250)]",
    sidebarBorder: "border-[oklch(0.32_0.05_250)]",
    sidebarForeground: "text-slate-200",
    sidebarMuted: "text-slate-400",
    sidebarActive: "bg-[oklch(0.55_0.1_195/0.2)] text-white",
    sidebarActiveFg: "text-white",
    sidebarHover: "hover:bg-white/5 hover:text-white",
    accent: "oklch(0.55 0.1 195)",
    accentSoft: "oklch(0.55 0.1 195 / 0.15)",
    pageBg: "bg-[oklch(0.97_0.006_240)]",
    headerBg: "bg-[oklch(0.99_0.002_240)]/90 backdrop-blur-xl border-slate-200/60",
    statVariant: "clinical",
  },
  admin: {
    id: "admin",
    label: "Operations Center",
    sidebar: "bg-[oklch(0.18_0.03_260)] border-[oklch(0.28_0.04_260)]",
    sidebarBorder: "border-[oklch(0.28_0.04_260)]",
    sidebarForeground: "text-slate-300",
    sidebarMuted: "text-slate-500",
    sidebarActive: "bg-[oklch(0.72_0.12_155/0.15)] text-[oklch(0.85_0.08_155)]",
    sidebarActiveFg: "text-[oklch(0.85_0.08_155)]",
    sidebarHover: "hover:bg-white/5 hover:text-slate-100",
    accent: "oklch(0.72 0.12 155)",
    accentSoft: "oklch(0.72 0.12 155 / 0.12)",
    pageBg: "bg-[oklch(0.965_0.005_250)]",
    headerBg: "bg-[oklch(0.99_0.002_250)]/90 backdrop-blur-xl border-slate-200/50",
    statVariant: "ops",
  },
};

export const roleNavMeta: Record<DashboardRole, { portalTitle: string; portalSubtitle: string }> = {
  patient: { portalTitle: "Health Portal", portalSubtitle: "Your personal care hub" },
  doctor: { portalTitle: "Clinical Hub", portalSubtitle: "Practice management" },
  admin: { portalTitle: "Command Center", portalSubtitle: "Platform operations" },
};
