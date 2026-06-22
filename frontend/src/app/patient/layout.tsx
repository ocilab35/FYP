"use client";

import { AuthGuard } from "@/components/shared/auth-guard";
import { DashboardLayout } from "@/components/layouts/dashboard-layout";

export default function PatientLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={["patient"]}>
      <DashboardLayout role="patient">{children}</DashboardLayout>
    </AuthGuard>
  );
}
