from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import NotificationType
from app.models import Appointment, Notification
from app.core.formatting import format_slot_datetime


async def create_notification(
    db: AsyncSession,
    user_id: UUID,
    title: str,
    message: str,
    notification_type: NotificationType,
    link: str | None = None,
    metadata: dict | None = None,
) -> Notification:
    notification = Notification(
        user_id=user_id,
        title=title,
        message=message,
        notification_type=notification_type,
        link=link,
        metadata_json=metadata,
    )
    db.add(notification)
    await db.flush()
    return notification


async def notify_appointment_approval_request(
    db: AsyncSession,
    doctor_user_id: UUID,
    patient_name: str,
    appointment_date,
    start_time,
    appointment_id: UUID,
) -> None:
    formatted = format_slot_datetime(appointment_date, start_time)
    await create_notification(
        db,
        user_id=doctor_user_id,
        title="Appointment Approval Required",
        message=f"{patient_name} requested an appointment on {formatted}.",
        notification_type=NotificationType.APPOINTMENT_APPROVAL_REQUEST,
        link="/doctor/appointments",
        metadata={
            "appointment_id": str(appointment_id),
            "patient_name": patient_name,
            "appointment_date": str(appointment_date),
            "appointment_time": start_time.isoformat() if hasattr(start_time, "isoformat") else str(start_time),
            "actions": ["approve", "reject"],
        },
    )


async def notify_patient_appointment_approved(db: AsyncSession, appointment: Appointment) -> None:
    if not appointment.patient or not appointment.patient.user:
        return
    from app.core.timezone_utils import to_hospital_local

    local = to_hospital_local(appointment.scheduled_at)
    formatted = format_slot_datetime(
        appointment.appointment_date or local.date(),
        local.time(),
    )
    await create_notification(
        db,
        user_id=appointment.patient.user_id,
        title="Appointment Approved",
        message=f"Your appointment on {formatted} has been approved by the doctor.",
        notification_type=NotificationType.APPOINTMENT_APPROVED,
        link="/patient/appointments",
        metadata={"appointment_id": str(appointment.id)},
    )


async def notify_patient_appointment_rejected(
    db: AsyncSession, appointment: Appointment, reason: str | None = None
) -> None:
    if not appointment.patient or not appointment.patient.user:
        return
    msg = "Your appointment request was declined."
    if reason:
        msg += f" Reason: {reason}"
    await create_notification(
        db,
        user_id=appointment.patient.user_id,
        title="Appointment Declined",
        message=msg,
        notification_type=NotificationType.APPOINTMENT_REJECTED,
        link="/patient/doctors",
        metadata={"appointment_id": str(appointment.id)},
    )


async def notify_appointment_booked(
    db: AsyncSession,
    doctor_user_id: UUID,
    patient_name: str,
    appointment_date,
    start_time,
    appointment_id: UUID,
) -> None:
    await notify_appointment_approval_request(
        db, doctor_user_id, patient_name, appointment_date, start_time, appointment_id
    )


async def notify_appointment_cancelled(
    db: AsyncSession,
    doctor_user_id: UUID,
    patient_name: str,
    appointment_id: UUID,
) -> None:
    await create_notification(
        db,
        user_id=doctor_user_id,
        title="Appointment Cancelled",
        message=f"Appointment cancelled by {patient_name}.",
        notification_type=NotificationType.APPOINTMENT_CANCELLED,
        link="/doctor/appointments",
        metadata={"appointment_id": str(appointment_id), "event": "cancelled"},
    )


async def notify_appointment_rescheduled(
    db: AsyncSession,
    doctor_user_id: UUID,
    patient_name: str,
    appointment_date,
    start_time,
    appointment_id: UUID,
) -> None:
    formatted = format_slot_datetime(appointment_date, start_time)
    await create_notification(
        db,
        user_id=doctor_user_id,
        title="Appointment Rescheduled",
        message=f"{patient_name} rescheduled their appointment to {formatted}.",
        notification_type=NotificationType.APPOINTMENT_RESCHEDULED,
        link="/doctor/appointments",
        metadata={"appointment_id": str(appointment_id), "event": "rescheduled"},
    )


async def notify_patient_reschedule_confirmed(
    db: AsyncSession,
    patient_user_id: UUID,
    formatted_datetime: str,
) -> None:
    await create_notification(
        db,
        user_id=patient_user_id,
        title="Appointment Rescheduled",
        message=f"Your appointment has been rescheduled to {formatted_datetime}.",
        notification_type=NotificationType.APPOINTMENT_RESCHEDULED,
        link="/patient/appointments",
    )


async def notify_consultation_started(
    db: AsyncSession, appointment: Appointment, session_id: UUID
) -> None:
    from sqlalchemy import select
    from sqlalchemy.orm import selectinload

    from app.models import Doctor

    if appointment.patient and appointment.patient.user:
        await create_notification(
            db,
            user_id=appointment.patient.user_id,
            title="Consultation Started",
            message="Your consultation room is now open. Join to speak with your doctor.",
            notification_type=NotificationType.CONSULTATION_STARTED,
            link=f"/patient/consultations/{appointment.id}",
            metadata={"session_id": str(session_id), "appointment_id": str(appointment.id)},
        )
    doc_result = await db.execute(
        select(Doctor).options(selectinload(Doctor.user)).where(Doctor.id == appointment.doctor_id)
    )
    doctor = doc_result.scalar_one_or_none()
    if doctor and doctor.user:
        await create_notification(
            db,
            user_id=doctor.user_id,
            title="Consultation Started",
            message="Patient consultation room is active.",
            notification_type=NotificationType.CONSULTATION_STARTED,
            link=f"/doctor/consultations/{appointment.id}/room",
            metadata={"session_id": str(session_id), "appointment_id": str(appointment.id)},
        )


async def notify_consultation_completed(
    db: AsyncSession, appointment: Appointment, session_id: UUID
) -> None:
    if appointment.patient and appointment.patient.user:
        await create_notification(
            db,
            user_id=appointment.patient.user_id,
            title="Consultation Completed",
            message="Your consultation has ended. Review your prescription and summary in My Consultations.",
            notification_type=NotificationType.CONSULTATION_COMPLETED,
            link=f"/patient/consultations/{appointment.id}/summary",
            metadata={"session_id": str(session_id), "appointment_id": str(appointment.id)},
        )
