import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "/api/v1";

/** Resolve API base URL for HTTP requests (supports same-origin proxy in dev). */
export function getApiBase(): string {
  if (API_URL.startsWith("http")) return API_URL;
  if (typeof window !== "undefined") return `${window.location.origin}${API_URL}`;
  return `http://localhost:8000${API_URL}`;
}

/** Backend origin for WebSockets and static file URLs (always the FastAPI server). */
export function getBackendOrigin(): string {
  const direct = process.env.NEXT_PUBLIC_BACKEND_URL;
  if (direct) return direct.replace(/\/$/, "");
  if (API_URL.startsWith("http")) return API_URL.replace(/\/api\/v1\/?$/, "");
  return "http://localhost:8000";
}

export const api = axios.create({
  baseURL: getApiBase(),
});

export type ApiRequestConfig = InternalAxiosRequestConfig & {
  /** Call FastAPI directly (long-running uploads/OCR) instead of the Next.js proxy. */
  useBackendDirect?: boolean;
};

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const cfg = config as ApiRequestConfig;
  config.baseURL = cfg.useBackendDirect
    ? `${getBackendOrigin()}/api/v1`
    : getApiBase();

  if (typeof window !== "undefined") {
    const token = localStorage.getItem("access_token");
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }

  if (config.data instanceof FormData && config.headers) {
    delete config.headers["Content-Type"];
  } else if (config.headers && !config.headers["Content-Type"]) {
    config.headers["Content-Type"] = "application/json";
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as ApiRequestConfig & { _retry?: boolean };
    if (error.response?.status === 401 && !original._retry && typeof window !== "undefined") {
      original._retry = true;
      const refreshToken = localStorage.getItem("refresh_token");
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${getBackendOrigin()}/api/v1/auth/refresh`, {
            refresh_token: refreshToken,
          });
          const tokens = data.data;
          localStorage.setItem("access_token", tokens.access_token);
          localStorage.setItem("refresh_token", tokens.refresh_token);
          if (original.headers) {
            original.headers.Authorization = `Bearer ${tokens.access_token}`;
          }
          return api(original);
        } catch {
          localStorage.removeItem("access_token");
          localStorage.removeItem("refresh_token");
          window.location.href = "/login";
        }
      } else {
        localStorage.removeItem("access_token");
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export interface APIResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export interface User {
  id: string;
  email: string;
  phone: string;
  cnic: string;
  first_name: string;
  last_name: string;
  role: "patient" | "doctor" | "admin";
  is_active: boolean;
  is_verified: boolean;
  avatar_url?: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface DoctorSearch {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  specialization: string;
  experience_years: number;
  consultation_fee: number;
  rating: number;
  total_reviews: number;
  hospital_affiliation?: string;
  expertise_tags: string[];
}

export interface Appointment {
  id: string;
  patient_id: string;
  doctor_id: string;
  slot_id?: string;
  appointment_date?: string;
  scheduled_at: string;
  duration_minutes: number;
  status: string;
  reason?: string;
  notes?: string;
  consultation_notes?: string;
  meeting_link?: string;
  rescheduled_from_id?: string;
  created_at: string;
  patient_name?: string;
  patient_mrn?: string;
}

export interface MedicalRecord {
  id: string;
  patient_id: string;
  title: string;
  record_type: string;
  description?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  recorded_at: string;
  metadata_json?: Record<string, unknown>;
  blockchain_tx_hash?: string | null;
  blockchain_hash?: string | null;
  verification_status?: string | null;
  blockchain_verified_at?: string | null;
  created_at: string;
}

export interface Medication {
  id: string;
  patient_id: string;
  medicine_name: string;
  dosage?: string;
  frequency?: string;
  duration?: string;
  notes?: string;
  is_active: boolean;
  created_at: string;
}

export interface ExtractedMedication {
  medicine_name: string;
  dosage?: string | null;
  frequency?: string | null;
  duration?: string | null;
  notes?: string | null;
  confidence: number;
}

export interface PrescriptionExtractionResult {
  medications: ExtractedMedication[];
  raw_text?: string | null;
  overall_confidence: number;
  ocr_engine: string;
  warnings: string[];
}

export interface PatientProfile {
  id: string;
  mrn?: string;
  date_of_birth?: string;
  age?: number;
  gender?: string;
  blood_group?: string;
  address?: string;
  emergency_contact?: string;
  allergies?: string;
  chronic_conditions?: string;
}

export interface ConsultationNote {
  symptoms?: string;
  diagnosis?: string;
  treatment_plan?: string;
  follow_up_notes?: string;
}

export interface AppointmentContext {
  appointment: Appointment & { status: string };
  patient: {
    id: string;
    mrn?: string;
    full_name: string;
    first_name: string;
    last_name: string;
    age?: number;
    gender?: string;
    blood_group?: string;
    allergies?: string;
    chronic_conditions?: string;
    emergency_contact?: string;
  };
  consultation_note?: ConsultationNote | null;
  medical_records: MedicalRecord[];
  medications: Medication[];
  prescriptions: {
    id: string;
    diagnosis: string;
    medications: unknown[];
    instructions?: string;
    created_at: string;
  }[];
  prior_appointments: { id: string; scheduled_at: string; status: string; reason?: string }[];
}

export const RECORD_TYPES = [
  { value: "xray", label: "X-Ray" },
  { value: "mri", label: "MRI" },
  { value: "ct_scan", label: "CT Scan" },
  { value: "blood_report", label: "Blood Report" },
  { value: "prescription", label: "Prescription" },
  { value: "lab_report", label: "Lab Report" },
  { value: "other", label: "Other" },
] as const;

export function resolveFileUrl(fileUrl: string): string {
  if (fileUrl.startsWith("http")) return fileUrl;
  return `${getBackendOrigin()}${fileUrl}`;
}

export async function fetchAuthenticatedBlob(fileUrl: string): Promise<string> {
  const token = typeof window !== "undefined" ? localStorage.getItem("access_token") : null;
  const res = await fetch(resolveFileUrl(fileUrl), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Failed to load file");
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}

export interface AvailableSlot {
  start_time: string;
  end_time: string;
  duration_minutes: number;
  label: string;
}

export interface DoctorAvailability {
  id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  slot_duration_minutes: number;
  break_times: { start_time: string; end_time: string }[];
  is_available: boolean;
}

export interface AppNotification {
  id: string;
  title: string;
  message: string;
  notification_type: string;
  is_read: boolean;
  link?: string;
  metadata_json?: Record<string, string>;
  created_at: string;
}

export interface AIChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AIChatAssessment {
  predicted_conditions: { name: string; probability: number }[];
  recommendations: string[];
  recommended_specialists: string[];
  risk_level: string;
  summary: string;
  health_risk_score?: number;
}

export interface AIChatResponse {
  session_id: string;
  reply: string;
  follow_up_questions: string[];
  is_complete: boolean;
  is_emergency: boolean;
  disclaimer: string;
  assessment?: AIChatAssessment | null;
  conversation: AIChatMessage[];
}

export interface AIConsultation {
  id: string;
  symptoms: string[];
  predicted_conditions: { name: string; probability: number }[];
  recommendations: string[];
  recommended_specialists: string[];
  risk_level: string;
  summary: string;
  conversation?: AIChatMessage[];
  created_at: string;
}

export interface HealthRisk {
  risk_score: number;
  risk_category: string;
  explanation: string;
  recommendations: string[];
  factors: string[];
  disclaimer: string;
}

export interface DrugInteractionAlert {
  type: string;
  medicines: string[];
  risk_level: string;
  explanation: string;
  suggested_action: string;
}

export interface DrugInteractionResult {
  overall_risk: string;
  alerts: DrugInteractionAlert[];
  disclaimer: string;
}

export interface MedicalReportSummary {
  patient_summary: string;
  key_findings: string[];
  possible_concerns: string[];
  follow_up_recommendations: string[];
  disclaimer: string;
}

export interface AIInsights {
  health_risk: HealthRisk;
  medication_alerts: DrugInteractionResult;
  recommendations: string[];
  chronic_monitoring: string[];
}

export interface ConsultationAISummary {
  chief_complaint?: string;
  symptoms?: string;
  discussion_summary?: string;
  diagnosis?: string;
  follow_up_plan?: string;
  disclaimer?: string;
}

export async function sendAIDoctorMessage(message: string, sessionId?: string): Promise<AIChatResponse> {
  const { data } = await api.post<APIResponse<AIChatResponse>>("/ai-doctor/chat", {
    message,
    session_id: sessionId || undefined,
  });
  return data.data;
}

export async function getHealthRisk(): Promise<HealthRisk> {
  const { data } = await api.get<APIResponse<HealthRisk>>("/ai-doctor/health-risk");
  return data.data;
}

export async function getMedicationAlerts(): Promise<DrugInteractionResult> {
  const { data } = await api.get<APIResponse<DrugInteractionResult>>("/ai-doctor/medication-alerts");
  return data.data;
}

export async function getAIInsights(): Promise<AIInsights> {
  const { data } = await api.get<APIResponse<AIInsights>>("/ai-doctor/insights");
  return data.data;
}

export async function summarizeMedicalRecord(recordId: string): Promise<MedicalReportSummary> {
  const { data } = await api.post<APIResponse<MedicalReportSummary>>(
    `/patients/medical-records/${recordId}/summarize`
  );
  return data.data;
}

export async function checkMedicationInteractions(): Promise<DrugInteractionResult> {
  const { data } = await api.get<APIResponse<DrugInteractionResult>>("/patients/medications/interactions");
  return data.data;
}

export interface AdminStats {
  total_users: number;
  total_patients: number;
  total_doctors: number;
  pending_doctor_approvals: number;
  total_appointments: number;
  appointments_today: number;
  ai_consultations_today: number;
  active_users_today: number;
  total_revenue?: number;
  subscription_revenue?: number;
  appointment_revenue?: number;
  active_subscribers?: number;
  expired_subscribers?: number;
}

export interface SubscriptionStatus {
  is_active: boolean;
  plan_name: string;
  amount: number;
  status: string;
  start_date?: string;
  expiry_date?: string;
  days_remaining: number;
  message?: string | null;
}

export interface CheckoutSession {
  payment_id: string;
  checkout_id?: string | null;
  checkout_url?: string | null;
  amount: number;
  currency: string;
  doctor_name?: string | null;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  payment_type: string;
  payment_status: string;
  transaction_id?: string | null;
  payment_provider: string;
  appointment_id?: string | null;
  created_at: string;
}

export async function getSubscriptionStatus(): Promise<SubscriptionStatus> {
  const { data } = await api.get<APIResponse<SubscriptionStatus>>("/payments/subscription/status");
  return data.data;
}

export async function createSubscriptionCheckout(): Promise<CheckoutSession> {
  const { data } = await api.post<APIResponse<CheckoutSession>>("/payments/checkout/subscription");
  return data.data;
}

export async function createAppointmentCheckout(payload: {
  doctor_id: string;
  appointment_date: string;
  start_time: string;
  reason?: string;
}): Promise<CheckoutSession> {
  const { data } = await api.post<APIResponse<CheckoutSession>>("/payments/checkout/appointment", payload);
  return data.data;
}

export async function verifyCheckout(checkoutId: string): Promise<{
  payment_id: string;
  payment_type: string;
  payment_status: string;
  appointment_id?: string | null;
}> {
  const { data } = await api.get<APIResponse<{
    payment_id: string;
    payment_type: string;
    payment_status: string;
    appointment_id?: string | null;
  }>>(`/payments/verify/${checkoutId}`);
  return data.data;
}

export async function getPaymentHistory(): Promise<PaymentRecord[]> {
  const { data } = await api.get<APIResponse<PaymentRecord[]>>("/payments/history");
  return data.data;
}

export async function extractPrescriptionMedications(file: File): Promise<PrescriptionExtractionResult> {
  const formData = new FormData();
  formData.append("file", file);
  const { data } = await api.post<APIResponse<PrescriptionExtractionResult>>(
    "/patients/medications/extract-from-prescription",
    formData,
    {
      useBackendDirect: true,
      timeout: 180_000,
    } as ApiRequestConfig
  );
  return data.data;
}

export function getErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    if (error.response?.status === 401) {
      return "Session expired. Please log in again as a patient.";
    }
    if (error.response?.status === 402) {
      const detail = error.response?.data as { detail?: string | { message?: string; code?: string } };
      if (typeof detail?.detail === "object" && detail.detail?.message) {
        return detail.detail.message;
      }
      return "Subscription or payment required to continue.";
    }
    if (error.code === "ECONNABORTED") {
      return "Prescription analysis timed out. Try a clearer, well-lit photo or a smaller image.";
    }
    if (error.code === "ERR_NETWORK" || !error.response) {
      return "Cannot reach the API server. Make sure the backend is running (uvicorn app.main:app --reload --port 8000) and restart the frontend after env changes.";
    }
    const data = error.response?.data as { detail?: string | { msg?: string }[]; message?: string };
    if (typeof data?.detail === "string") return data.detail;
    if (typeof data?.message === "string") return data.message;
    if (Array.isArray(data?.detail)) return data.detail[0]?.msg || error.message;
    return error.message;
  }
  return "An unexpected error occurred";
}
