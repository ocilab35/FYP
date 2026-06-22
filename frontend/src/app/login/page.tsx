"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Bot, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import {
  AuthCard,
  AuthField,
  AuthLayout,
  AuthSubmitButton,
  PasswordField,
} from "@/components/auth";
import { LinkButton } from "@/components/shared/link-button";
import { getErrorMessage } from "@/lib/api";
import { detectRoleFromEmail, loginSchema, type LoginFormValues } from "@/lib/auth-schemas";
import { useAuthStore, getDashboardPath } from "@/store/auth-store";
import { cn } from "@/lib/utils";

const REMEMBER_KEY = "vhms-remember-email";

const ROLE_LABELS: Record<string, string> = {
  patient: "Patient account",
  doctor: "Doctor account",
  admin: "Administrator account",
};

export default function LoginPage() {
  const router = useRouter();
  const { login, isLoading } = useAuthStore();
  const [success, setSuccess] = useState(false);
  const [detectedRole, setDetectedRole] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { remember: false },
  });

  const emailValue = watch("email");

  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      setValue("email", saved);
      setValue("remember", true);
    }
  }, [setValue]);

  useEffect(() => {
    if (!emailValue) {
      setDetectedRole(null);
      return;
    }
    const role = detectRoleFromEmail(emailValue);
    setDetectedRole(role ? ROLE_LABELS[role] : null);
  }, [emailValue]);

  const onSubmit = async (data: LoginFormValues) => {
    try {
      if (data.remember) {
        localStorage.setItem(REMEMBER_KEY, data.email);
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }

      const user = await login(data.email, data.password);
      setSuccess(true);
      toast.success(`Welcome back${user.first_name ? `, ${user.first_name}` : ""}!`);

      setTimeout(() => {
        router.push(getDashboardPath(user.role));
      }, 700);
    } catch (error) {
      toast.error(getErrorMessage(error));
    }
  };

  return (
    <AuthLayout
      brandHeadline="Secure access to intelligent healthcare"
      brandSubheadline="Sign in to manage appointments, consultations, and verified medical records on a platform built for trust."
    >
      <AuthCard title="Welcome back" description="Sign in to your Virtual Hospital account">
        <AnimatePresence mode="wait">
          {success ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center py-8 text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="flex h-16 w-16 items-center justify-center rounded-full bg-[oklch(0.72_0.12_155/0.15)]"
              >
                <CheckCircle2 className="h-8 w-8 text-[oklch(0.45_0.1_155)]" />
              </motion.div>
              <p className="mt-4 font-semibold text-foreground">Authentication successful</p>
              <p className="mt-1 text-sm text-muted-foreground">Redirecting to your dashboard...</p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              onSubmit={handleSubmit(onSubmit)}
              className="space-y-5"
              noValidate
            >
              <AuthField
                label="Email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                error={errors.email?.message}
                {...register("email")}
              />

              <AnimatePresence>
                {detectedRole && (
                  <motion.p
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="-mt-2 text-xs font-medium text-[oklch(0.55_0.1_195)]"
                  >
                    Detected: {detectedRole}
                  </motion.p>
                )}
              </AnimatePresence>

              <PasswordField
                label="Password"
                placeholder="Enter your password"
                autoComplete="current-password"
                error={errors.password?.message}
                {...register("password")}
              />

              <div className="flex items-center justify-between gap-4">
                <label className="flex cursor-pointer items-center gap-2 text-sm text-muted-foreground">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-border text-primary focus-visible:ring-2 focus-visible:ring-primary"
                    {...register("remember")}
                  />
                  Remember me
                </label>
                <Link
                  href="/login"
                  onClick={(e) => {
                    e.preventDefault();
                    toast.info("Contact support@virtualhospital.com to reset your password.");
                  }}
                  className="text-sm font-medium text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded"
                >
                  Forgot password?
                </Link>
              </div>

              <AuthSubmitButton loading={isLoading} loadingText="Signing in...">
                Sign In
              </AuthSubmitButton>

              <LinkButton
                href="/patient/ai-doctor"
                variant="outline"
                className={cn(
                  "h-11 w-full rounded-xl border-border/80 bg-white/60 text-sm font-semibold backdrop-blur-sm hover:bg-white"
                )}
              >
                <Bot className="mr-2 h-4 w-4" />
                Try AI Doctor
              </LinkButton>

              <p className="text-center text-sm text-muted-foreground">
                Don&apos;t have an account?{" "}
                <Link href="/register" className="font-semibold text-primary hover:underline">
                  Create account
                </Link>
              </p>

              <details className="rounded-xl border border-border/60 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
                <summary className="cursor-pointer font-medium text-foreground">Demo accounts</summary>
                <div className="mt-2 space-y-1">
                  <p>Patient: patient@vhms.com / Patient@123</p>
                  <p>Doctor: doctor@vhms.com / Doctor@123</p>
                  <p>Admin: admin@vhms.com / Admin@123</p>
                </div>
              </details>
            </motion.form>
          )}
        </AnimatePresence>
      </AuthCard>

      <p className="mt-6 hidden max-w-[440px] text-center text-xs text-muted-foreground lg:block">
        Protected by enterprise encryption
        <ArrowRight className="mx-1 inline h-3 w-3" aria-hidden="true" />
        HIPAA-inspired security standards
      </p>
    </AuthLayout>
  );
}
