"use client";

import { AuthGuard } from "@/components/shared/auth-guard";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";

export default function DoctorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["doctor"]}>
      <DashboardLayout role="doctor">{children}</DashboardLayout>
    </AuthGuard>
  );
}
