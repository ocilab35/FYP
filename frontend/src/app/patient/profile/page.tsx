"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { PageHeader, DashboardCard, DashboardCardBody, DashboardCardHeader } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export default function PatientProfilePage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { register, handleSubmit, reset } = useForm();

  const [mrn, setMrn] = useState<string>("");

  useEffect(() => {
    api.get("/patients/profile")
      .then((res) => {
        const p = res.data.data?.patient;
        if (p) {
          reset(p);
          setMrn(p.mrn || "");
        }
      })
      .finally(() => setLoading(false));
  }, [reset]);

  const onSubmit = async (data: Record<string, string>) => {
    setSaving(true);
    try {
      await api.patch("/patients/profile", data);
      toast.success("Profile updated");
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <Skeleton className="h-96 w-full" />;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        role="patient"
        title="Health Profile"
        description="Manage allergies, chronic conditions, and emergency contacts."
        badge={mrn ? <span className="font-mono text-xs text-primary">MRN: {mrn}</span> : undefined}
      />

      <DashboardCard padding="none">
        <DashboardCardHeader title="Account Information" />
        <DashboardCardBody className="grid gap-4 sm:grid-cols-2 text-sm">
          <div><span className="text-muted-foreground">Name</span><p className="font-medium">{user?.first_name} {user?.last_name}</p></div>
          <div><span className="text-muted-foreground">Email</span><p className="font-medium">{user?.email}</p></div>
          <div><span className="text-muted-foreground">Phone</span><p className="font-medium">{user?.phone}</p></div>
          <div><span className="text-muted-foreground">CNIC</span><p className="font-medium">{user?.cnic}</p></div>
        </DashboardCardBody>
      </DashboardCard>

      <DashboardCard padding="none">
        <DashboardCardHeader title="Medical Profile" />
        <DashboardCardBody>
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Gender</Label><Input {...register("gender")} /></div>
              <div className="space-y-2"><Label>Blood Group</Label><Input {...register("blood_group")} /></div>
            </div>
            <div className="space-y-2"><Label>Address</Label><Input {...register("address")} /></div>
            <div className="space-y-2"><Label>Emergency Contact</Label><Input {...register("emergency_contact")} /></div>
            <div className="space-y-2"><Label>Allergies</Label><Textarea {...register("allergies")} /></div>
            <div className="space-y-2"><Label>Chronic Conditions</Label><Textarea {...register("chronic_conditions")} /></div>
            <Button type="submit" disabled={saving} className="rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]">
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </form>
        </DashboardCardBody>
      </DashboardCard>
    </div>
  );
}
