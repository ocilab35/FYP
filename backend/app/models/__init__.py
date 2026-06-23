import uuid
from datetime import date, datetime, time

from app.db.types import pg_enum
from sqlalchemy import (
    Boolean,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.database import Base, SoftDeleteMixin, TimestampMixin, UUIDPrimaryKeyMixin
from app.core.enums import (
    AppointmentStatus,
    ConsultationSessionStatus,
    DoctorApprovalStatus,
    NotificationType,
    PaymentStatus,
    PaymentType,
    RiskLevel,
    SlotStatus,
    SubscriptionStatus,
    UserRole,
    VideoCallStatus,
)


class User(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "users"
    __table_args__ = (
        Index("ix_users_email_active", "email", unique=True, postgresql_where="deleted_at IS NULL"),
        Index("ix_users_phone_active", "phone", unique=True, postgresql_where="deleted_at IS NULL"),
        Index("ix_users_cnic_active", "cnic", unique=True, postgresql_where="deleted_at IS NULL"),
    )

    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(20), nullable=False)
    cnic: Mapped[str] = mapped_column(String(15), nullable=False)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)
    role: Mapped[UserRole] = mapped_column(pg_enum(UserRole, name="userrole"), nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    patient: Mapped["Patient | None"] = relationship(back_populates="user", uselist=False)
    doctor: Mapped["Doctor | None"] = relationship(back_populates="user", uselist=False)
    refresh_tokens: Mapped[list["RefreshToken"]] = relationship(back_populates="user")
    notifications: Mapped[list["Notification"]] = relationship(back_populates="user")
    audit_logs: Mapped[list["AuditLog"]] = relationship(back_populates="user")


class RefreshToken(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "refresh_tokens"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    revoked: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    user: Mapped["User"] = relationship(back_populates="refresh_tokens")


class Patient(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "patients"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    date_of_birth: Mapped[date | None] = mapped_column(Date, nullable=True)
    gender: Mapped[str | None] = mapped_column(String(20), nullable=True)
    blood_group: Mapped[str | None] = mapped_column(String(10), nullable=True)
    address: Mapped[str | None] = mapped_column(Text, nullable=True)
    emergency_contact: Mapped[str | None] = mapped_column(String(20), nullable=True)
    allergies: Mapped[str | None] = mapped_column(Text, nullable=True)
    chronic_conditions: Mapped[str | None] = mapped_column(Text, nullable=True)
    mrn: Mapped[str | None] = mapped_column(String(20), unique=True, nullable=True, index=True)

    user: Mapped["User"] = relationship(back_populates="patient")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="patient")
    appointment_slots: Mapped[list["AppointmentSlot"]] = relationship(back_populates="patient")
    medical_records: Mapped[list["MedicalRecord"]] = relationship(back_populates="patient")
    medications: Mapped[list["Medication"]] = relationship(back_populates="patient")
    ai_consultations: Mapped[list["AIConsultation"]] = relationship(back_populates="patient")


class Doctor(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "doctors"

    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    license_number: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    specialization: Mapped[str] = mapped_column(String(150), nullable=False)
    qualifications: Mapped[str | None] = mapped_column(Text, nullable=True)
    experience_years: Mapped[int] = mapped_column(default=0, nullable=False)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    consultation_fee: Mapped[float] = mapped_column(default=0.0, nullable=False)
    approval_status: Mapped[DoctorApprovalStatus] = mapped_column(
        pg_enum(DoctorApprovalStatus, name="doctorapprovalstatus"),
        default=DoctorApprovalStatus.PENDING,
        nullable=False,
    )
    hospital_affiliation: Mapped[str | None] = mapped_column(String(255), nullable=True)
    rating: Mapped[float] = mapped_column(default=0.0, nullable=False)
    total_reviews: Mapped[int] = mapped_column(default=0, nullable=False)

    user: Mapped["User"] = relationship(back_populates="doctor")
    appointments: Mapped[list["Appointment"]] = relationship(back_populates="doctor")
    availability_slots: Mapped[list["DoctorAvailability"]] = relationship(back_populates="doctor")
    appointment_slots: Mapped[list["AppointmentSlot"]] = relationship(back_populates="doctor")
    prescriptions: Mapped[list["Prescription"]] = relationship(back_populates="doctor")
    expertise_tags: Mapped[list["DoctorExpertise"]] = relationship(back_populates="doctor")


class DoctorExpertise(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "doctor_expertise"
    __table_args__ = (UniqueConstraint("doctor_id", "tag", name="uq_doctor_expertise"),)

    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    tag: Mapped[str] = mapped_column(String(100), nullable=False)

    doctor: Mapped["Doctor"] = relationship(back_populates="expertise_tags")


class DoctorAvailability(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "doctor_availability"
    __table_args__ = (Index("ix_doctor_availability_doctor_day", "doctor_id", "day_of_week"),)

    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    day_of_week: Mapped[int] = mapped_column(nullable=False)  # 0=Monday
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    slot_duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    break_times: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    doctor: Mapped["Doctor"] = relationship(back_populates="availability_slots")


class AppointmentSlot(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    """Reserved time window for a doctor. Linked to Appointment via Appointment.slot_id only."""

    __tablename__ = "appointment_slots"
    __table_args__ = (
        Index(
            "uq_appointment_slot_doctor_date_start",
            "doctor_id",
            "appointment_date",
            "start_time",
            unique=True,
            postgresql_where=text("status = 'booked' AND deleted_at IS NULL"),
        ),
        Index("ix_appointment_slots_doctor_date", "doctor_id", "appointment_date"),
        Index("ix_appointment_slots_patient", "patient_id"),
    )

    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    appointment_date: Mapped[date] = mapped_column(Date, nullable=False)
    start_time: Mapped[time] = mapped_column(Time, nullable=False)
    end_time: Mapped[time] = mapped_column(Time, nullable=False)
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30, nullable=False)
    status: Mapped[SlotStatus] = mapped_column(
        pg_enum(SlotStatus, name="slotstatus"),
        default=SlotStatus.BOOKED,
        nullable=False,
    )

    doctor: Mapped["Doctor"] = relationship(back_populates="appointment_slots")
    patient: Mapped["Patient"] = relationship(back_populates="appointment_slots")
    # Inverse of Appointment.slot_id — no FK on this table (avoids circular reference)
    appointment: Mapped["Appointment | None"] = relationship(
        back_populates="slot",
        primaryjoin="AppointmentSlot.id == foreign(Appointment.slot_id)",
        foreign_keys="Appointment.slot_id",
        uselist=False,
    )


class Appointment(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "appointments"
    __table_args__ = (
        Index("ix_appointments_patient_date", "patient_id", "scheduled_at"),
        Index("ix_appointments_doctor_date", "doctor_id", "scheduled_at"),
        Index("ix_appointments_status", "status"),
        Index("ix_appointments_doctor_appt_date", "doctor_id", "appointment_date"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    slot_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("appointment_slots.id", ondelete="SET NULL"), nullable=True
    )
    rescheduled_from_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    appointment_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    duration_minutes: Mapped[int] = mapped_column(default=30, nullable=False)
    status: Mapped[AppointmentStatus] = mapped_column(
        pg_enum(AppointmentStatus, name="appointmentstatus"),
        default=AppointmentStatus.PENDING,
        nullable=False,
    )
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    consultation_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    meeting_link: Mapped[str | None] = mapped_column(String(500), nullable=True)

    patient: Mapped["Patient"] = relationship(back_populates="appointments")
    doctor: Mapped["Doctor"] = relationship(back_populates="appointments")
    slot: Mapped["AppointmentSlot | None"] = relationship(
        back_populates="appointment",
        foreign_keys=[slot_id],
    )
    prescription: Mapped["Prescription | None"] = relationship(back_populates="appointment", uselist=False)
    consultation_note: Mapped["ConsultationNote | None"] = relationship(
        back_populates="appointment", uselist=False
    )
    consultation_session: Mapped["ConsultationSession | None"] = relationship(
        back_populates="appointment", uselist=False
    )
    rescheduled_from: Mapped["Appointment | None"] = relationship(
        "Appointment",
        remote_side="Appointment.id",
        foreign_keys=[rescheduled_from_id],
        uselist=False,
    )


class Prescription(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "prescriptions"

    appointment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    consultation_session_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("consultation_sessions.id", ondelete="SET NULL"), nullable=True
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    diagnosis: Mapped[str] = mapped_column(Text, nullable=False)
    medications: Mapped[dict] = mapped_column(JSONB, nullable=False, default=list)
    instructions: Mapped[str | None] = mapped_column(Text, nullable=True)
    valid_until: Mapped[date | None] = mapped_column(Date, nullable=True)
    pdf_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    recommendations: Mapped[str | None] = mapped_column(Text, nullable=True)
    blockchain_tx_hash: Mapped[str | None] = mapped_column(String(100), nullable=True)
    blockchain_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verification_status: Mapped[str | None] = mapped_column(String(20), nullable=True, default="pending")
    blockchain_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    appointment: Mapped["Appointment"] = relationship(back_populates="prescription")
    doctor: Mapped["Doctor"] = relationship(back_populates="prescriptions")
    consultation_session: Mapped["ConsultationSession | None"] = relationship(back_populates="prescription")


class MedicalRecord(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "medical_records"
    __table_args__ = (
        Index("ix_medical_records_patient", "patient_id"),
        Index("ix_medical_records_patient_type", "patient_id", "record_type"),
    )

    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    record_type: Mapped[str] = mapped_column(String(50), nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    file_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    mime_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    blockchain_tx_hash: Mapped[str | None] = mapped_column(String(100), nullable=True)
    blockchain_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)
    verification_status: Mapped[str | None] = mapped_column(String(20), nullable=True, default="pending")
    blockchain_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    patient: Mapped["Patient"] = relationship(back_populates="medical_records")


class Medication(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "medications"
    __table_args__ = (Index("ix_medications_patient_active", "patient_id", "deleted_at"),)

    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    medicine_name: Mapped[str] = mapped_column(String(200), nullable=False)
    dosage: Mapped[str | None] = mapped_column(String(100), nullable=True)
    frequency: Mapped[str | None] = mapped_column(String(100), nullable=True)
    duration: Mapped[str | None] = mapped_column(String(100), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

    patient: Mapped["Patient"] = relationship(back_populates="medications")


class ConsultationNote(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "consultation_notes"

    appointment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    symptoms: Mapped[str | None] = mapped_column(Text, nullable=True)
    diagnosis: Mapped[str | None] = mapped_column(Text, nullable=True)
    treatment_plan: Mapped[str | None] = mapped_column(Text, nullable=True)
    follow_up_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    draft_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    appointment: Mapped["Appointment"] = relationship(back_populates="consultation_note")
    doctor: Mapped["Doctor"] = relationship()
    patient: Mapped["Patient"] = relationship()


class ConsultationSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "consultation_sessions"
    __table_args__ = (
        Index("ix_consultation_sessions_appointment", "appointment_id", unique=True),
        Index("ix_consultation_sessions_status", "status"),
    )

    appointment_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    doctor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("doctors.id", ondelete="CASCADE"), nullable=False)
    scheduled_start: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    scheduled_end: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    actual_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    actual_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    status: Mapped[ConsultationSessionStatus] = mapped_column(
        pg_enum(ConsultationSessionStatus, name="consultationsessionstatus"),
        default=ConsultationSessionStatus.WAITING,
        nullable=False,
    )

    appointment: Mapped["Appointment"] = relationship(back_populates="consultation_session")
    patient: Mapped["Patient"] = relationship()
    doctor: Mapped["Doctor"] = relationship()
    messages: Mapped[list["ConsultationMessage"]] = relationship(back_populates="session")
    video_call: Mapped["VideoCallSession | None"] = relationship(back_populates="session", uselist=False)
    prescription: Mapped["Prescription | None"] = relationship(back_populates="consultation_session", uselist=False)


class ConsultationMessage(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "consultation_messages"
    __table_args__ = (Index("ix_consultation_messages_session", "session_id", "created_at"),)

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("consultation_sessions.id", ondelete="CASCADE"), nullable=False
    )
    sender_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    sender_role: Mapped[str] = mapped_column(String(20), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    message_type: Mapped[str] = mapped_column(String(20), default="text", nullable=False)

    session: Mapped["ConsultationSession"] = relationship(back_populates="messages")
    sender: Mapped["User"] = relationship()


class VideoCallSession(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "video_call_sessions"
    __table_args__ = (Index("ix_video_call_sessions_session", "session_id", unique=True),)

    session_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("consultation_sessions.id", ondelete="CASCADE"), unique=True, nullable=False
    )
    status: Mapped[VideoCallStatus] = mapped_column(
        pg_enum(VideoCallStatus, name="videocallstatus"),
        default=VideoCallStatus.IDLE,
        nullable=False,
    )
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    session: Mapped["ConsultationSession"] = relationship(back_populates="video_call")


class AIConsultation(UUIDPrimaryKeyMixin, TimestampMixin, SoftDeleteMixin, Base):
    __tablename__ = "ai_consultations"
    __table_args__ = (Index("ix_ai_consultations_patient", "patient_id"),)

    patient_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("patients.id", ondelete="CASCADE"), nullable=False)
    symptoms: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    predicted_conditions: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    recommendations: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    recommended_specialists: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    risk_level: Mapped[RiskLevel] = mapped_column(
        pg_enum(RiskLevel, name="risklevel"), default=RiskLevel.LOW, nullable=False
    )
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    conversation: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)

    patient: Mapped["Patient"] = relationship(back_populates="ai_consultations")


class Notification(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "notifications"
    __table_args__ = (Index("ix_notifications_user_read", "user_id", "is_read"),)

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    notification_type: Mapped[NotificationType] = mapped_column(
        pg_enum(NotificationType, name="notificationtype"),
        nullable=False,
    )
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    link: Mapped[str | None] = mapped_column(String(500), nullable=True)
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    user: Mapped["User"] = relationship(back_populates="notifications")


class AuditLog(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "audit_logs"
    __table_args__ = (Index("ix_audit_logs_user_action", "user_id", "action"),)

    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    action: Mapped[str] = mapped_column(String(100), nullable=False)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)
    resource_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)
    details: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    user_role: Mapped[str | None] = mapped_column(String(20), nullable=True)
    blockchain_tx_hash: Mapped[str | None] = mapped_column(String(100), nullable=True)
    blockchain_hash: Mapped[str | None] = mapped_column(String(64), nullable=True)

    user: Mapped["User | None"] = relationship(back_populates="audit_logs")


class Role(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "roles"

    name: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    permissions: Mapped[list["Permission"]] = relationship(
        secondary="role_permissions", back_populates="roles"
    )


class Permission(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "permissions"

    code: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)

    roles: Mapped[list["Role"]] = relationship(
        secondary="role_permissions", back_populates="permissions"
    )


class RolePermission(Base):
    __tablename__ = "role_permissions"

    role_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("roles.id", ondelete="CASCADE"), primary_key=True)
    permission_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("permissions.id", ondelete="CASCADE"), primary_key=True
    )


class SystemSetting(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "system_settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, nullable=False)
    value: Mapped[str] = mapped_column(Text, nullable=False)


class Subscription(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        Index("ix_subscriptions_user_status", "user_id", "status"),
        Index("ix_subscriptions_expiry", "expiry_date"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    plan_name: Mapped[str] = mapped_column(String(100), nullable=False, default="AI Doctor Plan")
    amount: Mapped[float] = mapped_column(nullable=False)
    start_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expiry_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    status: Mapped[SubscriptionStatus] = mapped_column(
        pg_enum(SubscriptionStatus, name="subscriptionstatus"),
        default=SubscriptionStatus.PENDING,
        nullable=False,
    )
    payment_reference: Mapped[str | None] = mapped_column(String(255), nullable=True)

    user: Mapped["User"] = relationship()


class Payment(UUIDPrimaryKeyMixin, TimestampMixin, Base):
    __tablename__ = "payments"
    __table_args__ = (
        Index("ix_payments_user", "user_id", "created_at"),
        Index("ix_payments_transaction", "transaction_id"),
        Index("ix_payments_checkout", "polar_checkout_id"),
        UniqueConstraint("transaction_id", name="uq_payments_transaction_id"),
    )

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), nullable=False)
    amount: Mapped[float] = mapped_column(nullable=False)
    currency: Mapped[str] = mapped_column(String(3), default="PKR", nullable=False)
    payment_type: Mapped[PaymentType] = mapped_column(
        pg_enum(PaymentType, name="paymenttype"), nullable=False
    )
    payment_status: Mapped[PaymentStatus] = mapped_column(
        pg_enum(PaymentStatus, name="paymentstatus"),
        default=PaymentStatus.PENDING,
        nullable=False,
    )
    transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    payment_provider: Mapped[str] = mapped_column(String(50), default="polar", nullable=False)
    polar_checkout_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("appointments.id", ondelete="SET NULL"), nullable=True
    )
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)

    user: Mapped["User"] = relationship()
    appointment: Mapped["Appointment | None"] = relationship()
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
