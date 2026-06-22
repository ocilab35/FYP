import { z } from "zod";

const phoneRegex = /^(\+92|0)?3\d{9}$/;
const cnicRegex = /^\d{5}-\d{7}-\d{1}$/;

export const passwordSchema = z
  .string()
  .min(8, "At least 8 characters")
  .regex(/[A-Z]/, "Include an uppercase letter")
  .regex(/[a-z]/, "Include a lowercase letter")
  .regex(/[0-9]/, "Include a number");

function fullNameSchema() {
  return z
    .string()
    .min(3, "Enter your full name")
    .refine((v) => v.trim().split(/\s+/).length >= 2, "Include first and last name");
}

export function splitFullName(fullName: string) {
  const parts = fullName.trim().split(/\s+/);
  return {
    first_name: parts[0],
    last_name: parts.slice(1).join(" ") || parts[0],
  };
}

export const loginSchema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Password is required"),
  remember: z.boolean().optional(),
});

export const patientRegisterSchema = z
  .object({
    full_name: fullNameSchema(),
    email: z.string().email("Enter a valid email address"),
    phone: z.string().regex(phoneRegex, "Use format 03XXXXXXXXX"),
    cnic: z.string().regex(cnicRegex, "Use format XXXXX-XXXXXXX-X"),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export const doctorRegisterSchema = z
  .object({
    full_name: fullNameSchema(),
    email: z.string().email("Enter a valid email address"),
    phone: z.string().regex(phoneRegex, "Use format 03XXXXXXXXX"),
    cnic: z.string().regex(cnicRegex, "Use format XXXXX-XXXXXXX-X"),
    specialization: z.string().min(2, "Specialization is required"),
    qualifications: z.string().min(2, "Qualification is required"),
    experience_years: z.coerce.number().min(0, "Min 0 years").max(60, "Max 60 years"),
    license_number: z.string().min(5, "License number is required"),
    consultation_fee: z.coerce.number().min(0, "Fee must be 0 or more"),
    password: passwordSchema,
    confirm_password: z.string(),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: "Passwords do not match",
    path: ["confirm_password"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type PatientRegisterValues = z.infer<typeof patientRegisterSchema>;
export type DoctorRegisterValues = z.infer<typeof doctorRegisterSchema>;

export type AuthRole = "patient" | "doctor";

export function detectRoleFromEmail(email: string): AuthRole | "admin" | null {
  const normalized = email.trim().toLowerCase();
  if (normalized.includes("admin")) return "admin";
  if (normalized.includes("doctor")) return "doctor";
  if (normalized.includes("patient")) return "patient";
  return null;
}

export function getPasswordStrength(password: string): {
  score: number;
  label: string;
  color: string;
} {
  if (!password) return { score: 0, label: "Enter a password", color: "bg-muted" };

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return { score: 25, label: "Weak", color: "bg-red-400" };
  if (score <= 4) return { score: 55, label: "Fair", color: "bg-amber-400" };
  if (score <= 5) return { score: 80, label: "Strong", color: "bg-[oklch(0.55_0.1_195)]" };
  return { score: 100, label: "Excellent", color: "bg-[oklch(0.72_0.12_155)]" };
}
