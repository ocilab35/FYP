"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DashboardCard, DashboardCardBody, DashboardCardHeader, PageHeader } from "@/components/dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { api, getErrorMessage } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

export default function DoctorProfilePage() {
  const { user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<Record<string, unknown>>({});

  useEffect(() => {
    api.get("/doctors/profile").then((res) => setProfile(res.data.data?.doctor || {})).finally(() => setLoading(false));
  }, []);

  const save = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    try {
      await api.patch("/doctors/profile", Object.fromEntries(fd));
      toast.success("Profile updated");
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  if (loading) return <Skeleton className="h-96 w-full rounded-2xl" />;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader role="doctor" title="Doctor Profile" description={`Dr. ${user?.first_name} ${user?.last_name}`} />
      <DashboardCard padding="none">
        <DashboardCardHeader title="Professional Information" />
        <DashboardCardBody>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-2"><Label>Specialization</Label><Input name="specialization" defaultValue={profile.specialization as string} className="rounded-xl" /></div>
            <div className="space-y-2"><Label>Qualifications</Label><Input name="qualifications" defaultValue={profile.qualifications as string} className="rounded-xl" /></div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2"><Label>Experience (years)</Label><Input name="experience_years" type="number" defaultValue={profile.experience_years as number} className="rounded-xl" /></div>
              <div className="space-y-2"><Label>Fee (PKR)</Label><Input name="consultation_fee" type="number" defaultValue={profile.consultation_fee as number} className="rounded-xl" /></div>
            </div>
            <div className="space-y-2"><Label>Hospital</Label><Input name="hospital_affiliation" defaultValue={profile.hospital_affiliation as string} className="rounded-xl" /></div>
            <div className="space-y-2"><Label>Bio</Label><Textarea name="bio" defaultValue={profile.bio as string} className="rounded-xl" /></div>
            <Button type="submit" className="rounded-xl bg-[oklch(0.35_0.12_250)] text-white hover:bg-[oklch(0.32_0.12_250)]">Save Changes</Button>
          </form>
        </DashboardCardBody>
      </DashboardCard>
    </div>
  );
}
