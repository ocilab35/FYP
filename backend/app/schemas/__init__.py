import re
from datetime import date, datetime
from typing import Generic, TypeVar
from uuid import UUID

from pydantic import BaseModel, ConfigDict, EmailStr, Field, field_validator

T = TypeVar("T")


class APIResponse(BaseModel, Generic[T]):
    success: bool = True
    message: str = "OK"
    data: T | None = None


class PaginatedResponse(BaseModel, Generic[T]):
    items: list[T]
    total: int
    page: int
    page_size: int
    total_pages: int


class ErrorDetail(BaseModel):
    field: str | None = None
    message: str


class ErrorResponse(BaseModel):
    success: bool = False
    message: str
    errors: list[ErrorDetail] | None = None


CNIC_PATTERN = re.compile(r"^\d{5}-\d{7}-\d{1}$")
PHONE_PATTERN = re.compile(r"^(\+92|0)?3\d{9}$")


def validate_cnic(v: str) -> str:
    if not CNIC_PATTERN.match(v):
        raise ValueError("CNIC must be in format XXXXX-XXXXXXX-X")
    return v


def validate_phone(v: str) -> str:
    cleaned = v.replace(" ", "").replace("-", "")
    if not PHONE_PATTERN.match(cleaned):
        raise ValueError("Invalid Pakistani phone number")
    return cleaned


class UserBase(BaseModel):
    email: EmailStr
    phone: str
    cnic: str
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)

    _validate_cnic = field_validator("cnic")(validate_cnic)
    _validate_phone = field_validator("phone")(validate_phone)


class PatientRegister(UserBase):
    password: str = Field(min_length=8, max_length=128)
    date_of_birth: datetime | None = None
    gender: str | None = None
    blood_group: str | None = None


class DoctorRegister(UserBase):
    password: str = Field(min_length=8, max_length=128)
    license_number: str = Field(min_length=5, max_length=50)
    specialization: str = Field(min_length=2, max_length=150)
    qualifications: str | None = None
    experience_years: int = Field(ge=0, le=60)
    bio: str | None = None
    consultation_fee: float = Field(ge=0)
    hospital_affiliation: str | None = None
    expertise_tags: list[str] = Field(default_factory=list)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class RefreshRequest(BaseModel):
    refresh_token: str


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    email: str
    phone: str
    cnic: str
    first_name: str
    last_name: str
    role: str
    is_active: bool
    is_verified: bool
    avatar_url: str | None = None
    created_at: datetime

    @field_validator("role", mode="before")
    @classmethod
    def normalize_role(cls, v: object) -> str:
        return v.value if hasattr(v, "value") else str(v)


class PatientProfileUpdate(BaseModel):
    date_of_birth: datetime | None = None
    gender: str | None = None
    blood_group: str | None = None
    address: str | None = None
    emergency_contact: str | None = None
    allergies: str | None = None
    chronic_conditions: str | None = None


class DoctorProfileUpdate(BaseModel):
    specialization: str | None = None
    qualifications: str | None = None
    experience_years: int | None = Field(default=None, ge=0, le=60)
    bio: str | None = None
    consultation_fee: float | None = Field(default=None, ge=0)
    hospital_affiliation: str | None = None


class AppointmentCreate(BaseModel):
    doctor_id: UUID
    scheduled_at: datetime
    duration_minutes: int = Field(default=30, ge=15, le=120)
    reason: str | None = None


class AppointmentUpdate(BaseModel):
    status: str | None = None
    notes: str | None = None
    consultation_notes: str | None = None


class AppointmentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    doctor_id: UUID
    slot_id: UUID | None = None
    appointment_date: date | None = None
    scheduled_at: datetime
    duration_minutes: int
    status: str
    reason: str | None
    notes: str | None
    consultation_notes: str | None
    meeting_link: str | None
    rescheduled_from_id: UUID | None = None
    created_at: datetime

    @field_validator("status", mode="before")
    @classmethod
    def normalize_status(cls, v: object) -> str:
        return v.value if hasattr(v, "value") else str(v)


class PrescriptionCreate(BaseModel):
    appointment_id: UUID
    diagnosis: str
    medications: list[dict]
    instructions: str | None = None
    recommendations: str | None = None
    valid_until: datetime | None = None


class PrescriptionResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    appointment_id: UUID
    doctor_id: UUID
    patient_id: UUID
    diagnosis: str
    medications: list
    instructions: str | None
    recommendations: str | None = None
    pdf_url: str | None = None
    valid_until: datetime | None
    blockchain_tx_hash: str | None = None
    blockchain_hash: str | None = None
    verification_status: str | None = None
    blockchain_verified_at: datetime | None = None
    created_at: datetime


class MedicalRecordCreate(BaseModel):
    title: str
    record_type: str
    description: str | None = None
    file_url: str | None = None
    recorded_at: datetime
    metadata_json: dict | None = None


class MedicalRecordResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    title: str
    record_type: str
    description: str | None
    file_url: str | None
    file_name: str | None = None
    file_size: int | None = None
    mime_type: str | None = None
    recorded_at: datetime
    metadata_json: dict | None = None
    blockchain_tx_hash: str | None = None
    blockchain_hash: str | None = None
    verification_status: str | None = None
    blockchain_verified_at: datetime | None = None
    created_at: datetime


class VerificationResult(BaseModel):
    verified: bool
    status: str
    record_id: str | None = None
    prescription_id: str | None = None
    blockchain_hash: str | None = None
    current_hash: str | None = None
    blockchain_tx_hash: str | None = None
    on_chain_verified: bool | None = None
    verified_at: str | None = None
    message: str | None = None


class MedicationCreate(BaseModel):
    medicine_name: str = Field(min_length=1, max_length=200)
    dosage: str | None = None
    frequency: str | None = None
    duration: str | None = None
    notes: str | None = None
    is_active: bool = True


class MedicationUpdate(BaseModel):
    medicine_name: str | None = Field(default=None, min_length=1, max_length=200)
    dosage: str | None = None
    frequency: str | None = None
    duration: str | None = None
    notes: str | None = None
    is_active: bool | None = None


class MedicationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    medicine_name: str
    dosage: str | None
    frequency: str | None
    duration: str | None
    notes: str | None
    is_active: bool
    created_at: datetime


class ExtractedMedicationItem(BaseModel):
    medicine_name: str
    dosage: str | None = None
    frequency: str | None = None
    duration: str | None = None
    notes: str | None = None
    confidence: float = Field(ge=0, le=1)


class PrescriptionExtractionResponse(BaseModel):
    medications: list[ExtractedMedicationItem]
    raw_text: str | None = None
    overall_confidence: float = Field(ge=0, le=1)
    ocr_engine: str
    warnings: list[str] = Field(default_factory=list)


class MedicationBulkCreate(BaseModel):
    medications: list[MedicationCreate] = Field(min_length=1, max_length=30)


class ConsultationNoteSave(BaseModel):
    symptoms: str | None = None
    diagnosis: str | None = None
    treatment_plan: str | None = None
    follow_up_notes: str | None = None


class ConsultationNoteResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    appointment_id: UUID
    symptoms: str | None
    diagnosis: str | None
    treatment_plan: str | None
    follow_up_notes: str | None
    created_at: datetime
    updated_at: datetime


class PatientProfileResponse(BaseModel):
    id: UUID
    mrn: str | None
    first_name: str
    last_name: str
    email: str
    phone: str
    date_of_birth: date | None
    age: int | None = None
    gender: str | None
    blood_group: str | None
    address: str | None
    emergency_contact: str | None
    allergies: str | None
    chronic_conditions: str | None


class AppointmentContextResponse(BaseModel):
    appointment: dict
    patient: dict
    consultation_note: dict | None
    medical_records: list
    medications: list
    prescriptions: list
    prior_appointments: list


class AIConsultationRequest(BaseModel):
    symptoms: list[str] = Field(min_length=1)
    additional_info: str | None = None


class AIConsultationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    symptoms: list
    predicted_conditions: list
    recommendations: list
    recommended_specialists: list
    risk_level: str
    summary: str
    created_at: datetime


class BreakTime(BaseModel):
    start_time: str = Field(description="HH:MM format")
    end_time: str = Field(description="HH:MM format")


class DoctorAvailabilityCreate(BaseModel):
    day_of_week: int = Field(ge=0, le=6)
    start_time: str
    end_time: str
    slot_duration_minutes: int = Field(default=30, ge=15, le=120)
    break_times: list[BreakTime] = Field(default_factory=list)
    is_available: bool = True


class DoctorAvailabilityUpdate(BaseModel):
    start_time: str | None = None
    end_time: str | None = None
    slot_duration_minutes: int | None = Field(default=None, ge=15, le=120)
    break_times: list[BreakTime] | None = None
    is_available: bool | None = None


class DoctorAvailabilityResponse(BaseModel):
    id: UUID
    day_of_week: int
    start_time: str
    end_time: str
    slot_duration_minutes: int
    break_times: list
    is_available: bool


class AvailableSlotResponse(BaseModel):
    start_time: str
    end_time: str
    duration_minutes: int
    label: str


class SlotBookingRequest(BaseModel):
    doctor_id: UUID
    appointment_date: date
    start_time: str = Field(description="HH:MM or HH:MM:SS")
    reason: str | None = None


class AppointmentRescheduleRequest(BaseModel):
    appointment_date: date
    start_time: str
    reason: str | None = None


class DoctorSearchResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    user_id: UUID
    first_name: str
    last_name: str
    specialization: str
    experience_years: int
    consultation_fee: float
    rating: float
    total_reviews: int
    hospital_affiliation: str | None
    expertise_tags: list[str] = []


class NotificationResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    title: str
    message: str
    notification_type: str
    is_read: bool
    link: str | None
    metadata_json: dict | None = None
    created_at: datetime

    @field_validator("notification_type", mode="before")
    @classmethod
    def normalize_type(cls, v: object) -> str:
        return v.value if hasattr(v, "value") else str(v)


class AdminStatsResponse(BaseModel):
    total_users: int
    total_patients: int
    total_doctors: int
    pending_doctor_approvals: int
    total_appointments: int
    appointments_today: int
    ai_consultations_today: int
    active_users_today: int
