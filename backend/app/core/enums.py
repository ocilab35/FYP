import enum


class UserRole(str, enum.Enum):
    PATIENT = "patient"
    DOCTOR = "doctor"
    ADMIN = "admin"


class AppointmentStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"
    CONFIRMED = "confirmed"  # legacy alias — migrated to approved
    NO_SHOW = "no_show"
    RESCHEDULED = "rescheduled"


class ConsultationSessionStatus(str, enum.Enum):
    WAITING = "waiting"
    ACTIVE = "active"
    COMPLETED = "completed"


class VideoCallStatus(str, enum.Enum):
    IDLE = "idle"
    CONNECTING = "connecting"
    ACTIVE = "active"
    ENDED = "ended"


class SlotStatus(str, enum.Enum):
    BOOKED = "booked"
    CANCELLED = "cancelled"


class DoctorApprovalStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class NotificationType(str, enum.Enum):
    APPOINTMENT = "appointment"
    APPOINTMENT_BOOKED = "appointment_booked"
    APPOINTMENT_APPROVAL_REQUEST = "appointment_approval_request"
    APPOINTMENT_APPROVED = "appointment_approved"
    APPOINTMENT_REJECTED = "appointment_rejected"
    APPOINTMENT_CANCELLED = "appointment_cancelled"
    APPOINTMENT_RESCHEDULED = "appointment_rescheduled"
    CONSULTATION_STARTED = "consultation_started"
    CONSULTATION_COMPLETED = "consultation_completed"
    PRESCRIPTION = "prescription"
    SYSTEM = "system"
    AI = "ai"
    REMINDER = "reminder"
    PAYMENT = "payment"
    SUBSCRIPTION = "subscription"


class RiskLevel(str, enum.Enum):
    LOW = "low"
    MODERATE = "moderate"
    HIGH = "high"
    CRITICAL = "critical"


class PaymentStatus(str, enum.Enum):
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    REFUNDED = "refunded"


class PaymentType(str, enum.Enum):
    SUBSCRIPTION = "subscription"
    APPOINTMENT = "appointment"


class SubscriptionStatus(str, enum.Enum):
    ACTIVE = "active"
    EXPIRED = "expired"
    CANCELLED = "cancelled"
    PENDING = "pending"


class MedicalRecordType(str, enum.Enum):
    XRAY = "xray"
    MRI = "mri"
    CT_SCAN = "ct_scan"
    BLOOD_REPORT = "blood_report"
    PRESCRIPTION = "prescription"
    LAB_REPORT = "lab_report"
    OTHER = "other"
