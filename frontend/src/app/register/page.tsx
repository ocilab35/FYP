"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  AuthCard,
  AuthField,
  AuthLayout,
  AuthSubmitButton,
  PasswordField,
  PasswordStrengthMeter,
  RoleSelection,
} from "@/components/auth";
import { api, getErrorMessage } from "@/lib/api";
import {
  doctorRegisterSchema,
  patientRegisterSchema,
  splitFullName,
  type AuthRole,
  type DoctorRegisterValues,
  type PatientRegisterValues,
} from "@/lib/auth-schemas";

function RegisterFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") === "doctor" ? "doctor" : "patient";

  const [role, setRole] = useState<AuthRole>(initialRole);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const patientForm = useForm<PatientRegisterValues>({
    resolver: zodResolver(patientRegisterSchema),
    mode: "onChange",
  });

  const doctorForm = useForm<DoctorRegisterValues>({
    resolver: zodResolver(doctorRegisterSchema),
    mode: "onChange",
    defaultValues: { consultation_fee: 0, experience_years: 0 },
  });

  const activeForm = role === "patient" ? patientForm : doctorForm;
  const passwordWatch = activeForm.watch("password");

  const onPatientSubmit = async (data: PatientRegisterValues) => {
    setLoading(true);
    try {
      const { first_name, last_name } = splitFullName(data.full_name);
      await api.post("/auth/register/patient", {
        first_name,
        last_name,
        email: data.email,
        phone: data.phone,
        cnic: data.cnic,
        password: data.password,
      });
      setSuccess(true);
      toast.success("Account created successfully!");
      setTimeout(() => router.push("/login"), 1200);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const onDoctorSubmit = async (data: DoctorRegisterValues) => {
    setLoading(true);
    try {
      const { first_name, last_name } = splitFullName(data.full_name);
      await api.post("/auth/register/doctor", {
        first_name,
        last_name,
        email: data.email,
        phone: data.phone,
        cnic: data.cnic,
        password: data.password,
        specialization: data.specialization,
        qualifications: data.qualifications,
        experience_years: data.experience_years,
        license_number: data.license_number,
        consultation_fee: data.consultation_fee,
      });
      setSuccess(true);
      toast.success("Registration submitted! Awaiting admin approval.");
      setTimeout(() => router.push("/login"), 1400);
    } catch (e) {
      toast.error(getErrorMessage(e));
    } finally {
      setLoading(false);
    }
  };

  const switchRole = (next: AuthRole) => {
    setRole(next);
    patientForm.clearErrors();
    doctorForm.clearErrors();
  };

  return (
    <AuthLayout
      brandHeadline="Join the future of digital healthcare"
      brandSubheadline="Create your account to access AI-powered care, secure records, and a platform trusted by patients and clinicians."
    >
      <AuthCard
        title="Create your account"
        description="Choose your role and complete registration in minutes"
        className="max-w-[480px]"
      >
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-10 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-[oklch(0.72_0.12_155/0.15)]"
              >
                <CheckCircle2 className="h-8 w-8 text-[oklch(0.45_0.1_155)]" />
              </motion.div>
              <p className="mt-4 font-semibold text-foreground">Registration complete</p>
              <p className="mt-1 text-sm text-muted-foreground">Redirecting to sign in...</p>
            </motion.div>
          ) : (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">
              <RoleSelection value={role} onChange={switchRole} />

              <AnimatePresence mode="wait">
                {role === "patient" ? (
                  <motion.form
                    key="patient"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 12 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={patientForm.handleSubmit(onPatientSubmit)}
                    className="space-y-4"
                    noValidate
                  >
                    <AuthField
                      label="Full Name"
                      placeholder="Ali Khan"
                      autoComplete="name"
                      error={patientForm.formState.errors.full_name?.message}
                      {...patientForm.register("full_name")}
                    />
                    <AuthField
                      label="Email"
                      type="email"
                      placeholder="you@example.com"
                      autoComplete="email"
                      error={patientForm.formState.errors.email?.message}
                      {...patientForm.register("email")}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <AuthField
                        label="Phone Number"
                        placeholder="03XXXXXXXXX"
                        autoComplete="tel"
                        error={patientForm.formState.errors.phone?.message}
                        {...patientForm.register("phone")}
                      />
                      <AuthField
                        label="CNIC"
                        placeholder="XXXXX-XXXXXXX-X"
                        error={patientForm.formState.errors.cnic?.message}
                        {...patientForm.register("cnic")}
                      />
                    </div>
                    <PasswordField
                      label="Password"
                      autoComplete="new-password"
                      error={patientForm.formState.errors.password?.message}
                      strengthSlot={<PasswordStrengthMeter password={passwordWatch ?? ""} />}
                      {...patientForm.register("password")}
                    />
                    <PasswordField
                      label="Confirm Password"
                      autoComplete="new-password"
                      error={patientForm.formState.errors.confirm_password?.message}
                      {...patientForm.register("confirm_password")}
                    />
                    <AuthSubmitButton loading={loading} loadingText="Creating account...">
                      Register as Patient
                    </AuthSubmitButton>
                  </motion.form>
                ) : (
                  <motion.form
                    key="doctor"
                    initial={{ opacity: 0, x: 12 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -12 }}
                    transition={{ duration: 0.3 }}
                    onSubmit={doctorForm.handleSubmit(onDoctorSubmit)}
                    className="space-y-4"
                    noValidate
                  >
                    <AuthField
                      label="Full Name"
                      placeholder="Dr. Sarah Ahmed"
                      autoComplete="name"
                      error={doctorForm.formState.errors.full_name?.message}
                      {...doctorForm.register("full_name")}
                    />
                    <AuthField
                      label="Email"
                      type="email"
                      placeholder="doctor@example.com"
                      autoComplete="email"
                      error={doctorForm.formState.errors.email?.message}
                      {...doctorForm.register("email")}
                    />
                    <div className="grid gap-4 sm:grid-cols-2">
                      <AuthField
                        label="Phone Number"
                        placeholder="03XXXXXXXXX"
                        autoComplete="tel"
                        error={doctorForm.formState.errors.phone?.message}
                        {...doctorForm.register("phone")}
                      />
                      <AuthField
                        label="CNIC"
                        placeholder="XXXXX-XXXXXXX-X"
                        error={doctorForm.formState.errors.cnic?.message}
                        {...doctorForm.register("cnic")}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <AuthField
                        label="Specialization"
                        placeholder="Cardiology"
                        error={doctorForm.formState.errors.specialization?.message}
                        {...doctorForm.register("specialization")}
                      />
                      <AuthField
                        label="Qualification"
                        placeholder="MBBS, FCPS"
                        error={doctorForm.formState.errors.qualifications?.message}
                        {...doctorForm.register("qualifications")}
                      />
                    </div>
                    <div className="grid gap-4 sm:grid-cols-2">
                      <AuthField
                        label="Experience (years)"
                        type="number"
                        min={0}
                        max={60}
                        error={doctorForm.formState.errors.experience_years?.message}
                        {...doctorForm.register("experience_years")}
                      />
                      <AuthField
                        label="License Number"
                        placeholder="PMC-XXXXX"
                        error={doctorForm.formState.errors.license_number?.message}
                        {...doctorForm.register("license_number")}
                      />
                    </div>
                    <AuthField
                      label="Consultation Fee (PKR)"
                      type="number"
                      min={0}
                      hint="Set your standard consultation fee"
                      error={doctorForm.formState.errors.consultation_fee?.message}
                      {...doctorForm.register("consultation_fee")}
                    />
                    <PasswordField
                      label="Password"
                      autoComplete="new-password"
                      error={doctorForm.formState.errors.password?.message}
                      strengthSlot={<PasswordStrengthMeter password={passwordWatch ?? ""} />}
                      {...doctorForm.register("password")}
                    />
                    <PasswordField
                      label="Confirm Password"
                      autoComplete="new-password"
                      error={doctorForm.formState.errors.confirm_password?.message}
                      {...doctorForm.register("confirm_password")}
                    />
                    <AuthSubmitButton loading={loading} loadingText="Submitting application...">
                      Register as Doctor
                    </AuthSubmitButton>
                  </motion.form>
                )}
              </AnimatePresence>

              <p className="text-center text-sm text-muted-foreground">
                Already have an account?{" "}
                <Link href="/login" className="font-semibold text-primary hover:underline">
                  Sign in
                </Link>
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </AuthCard>
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[oklch(0.98_0.005_240)] text-sm text-muted-foreground">
          Loading...
        </div>
      }
    >
      <RegisterFormContent />
    </Suspense>
  );
}
