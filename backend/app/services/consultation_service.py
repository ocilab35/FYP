"""Consultation session lifecycle — time-gated room creation and auto-end."""

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import AppointmentStatus, ConsultationSessionStatus, VideoCallStatus
from app.core.timezone_utils import hospital_now
from app.models import Appointment, ConsultationMessage, ConsultationNote, ConsultationSession, Doctor, Patient, Prescription, User, VideoCallSession
from app.services.notification_service import (
    notify_consultation_completed,
    notify_consultation_started,
    notify_patient_appointment_approved,
    notify_patient_appointment_rejected,
)


APPROVED_STATUSES = (AppointmentStatus.APPROVED, AppointmentStatus.CONFIRMED)


def _now() -> datetime:
    return hospital_now()


def _appointment_end(appointment: Appointment) -> datetime:
    return appointment.scheduled_at + timedelta(minutes=appointment.duration_minutes)


async def get_appointment_for_doctor(
    db: AsyncSession, doctor_id: UUID, appointment_id: UUID
) -> Appointment:
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient).selectinload(Patient.user))
        .where(
            Appointment.id == appointment_id,
            Appointment.doctor_id == doctor_id,
            Appointment.deleted_at.is_(None),
        )
    )
    appt = result.scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    return appt


async def approve_appointment(db: AsyncSession, doctor: Doctor, appointment_id: UUID) -> Appointment:
    appointment = await get_appointment_for_doctor(db, doctor.id, appointment_id)
    if appointment.status != AppointmentStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending appointments can be approved")

    appointment.status = AppointmentStatus.APPROVED
    if appointment.patient and appointment.patient.user:
        await notify_patient_appointment_approved(db, appointment)
    await db.flush()
    return appointment


async def reject_appointment(
    db: AsyncSession, doctor: Doctor, appointment_id: UUID, reason: str | None = None
) -> Appointment:
    appointment = await get_appointment_for_doctor(db, doctor.id, appointment_id)
    if appointment.status != AppointmentStatus.PENDING:
        raise HTTPException(status_code=400, detail="Only pending appointments can be rejected")

    appointment.status = AppointmentStatus.REJECTED
    if reason:
        appointment.notes = reason
    if appointment.patient and appointment.patient.user:
        await notify_patient_appointment_rejected(db, appointment, reason)
    await db.flush()
    return appointment


async def get_or_activate_session(
    db: AsyncSession,
    appointment: Appointment,
    user: User,
) -> ConsultationSession:
    """Create session when current time >= appointment start; only assigned parties may join."""
    now = _now()
    if appointment.status not in (*APPROVED_STATUSES, AppointmentStatus.ACTIVE):
        raise HTTPException(status_code=403, detail="Appointment is not approved for consultation")

    end_time = _appointment_end(appointment)
    if now < appointment.scheduled_at:
        raise HTTPException(
            status_code=403,
            detail="Consultation room opens at the scheduled appointment time",
        )
    if now > end_time and appointment.status != AppointmentStatus.ACTIVE:
        raise HTTPException(status_code=403, detail="Appointment window has ended")

    is_doctor = user.doctor and user.doctor.id == appointment.doctor_id
    is_patient = user.patient and user.patient.id == appointment.patient_id
    if not is_doctor and not is_patient:
        raise HTTPException(status_code=403, detail="Access denied")

    result = await db.execute(
        select(ConsultationSession)
        .options(selectinload(ConsultationSession.video_call))
        .where(ConsultationSession.appointment_id == appointment.id)
    )
    session = result.scalar_one_or_none()

    if not session:
        session = ConsultationSession(
            appointment_id=appointment.id,
            patient_id=appointment.patient_id,
            doctor_id=appointment.doctor_id,
            scheduled_start=appointment.scheduled_at,
            scheduled_end=end_time,
            status=ConsultationSessionStatus.ACTIVE,
            actual_start=now,
        )
        db.add(session)
        await db.flush()
        db.add(VideoCallSession(session_id=session.id, status=VideoCallStatus.IDLE))
        appointment.status = AppointmentStatus.ACTIVE
        await notify_consultation_started(db, appointment, session.id)
        await db.flush()
    elif session.status == ConsultationSessionStatus.WAITING:
        session.status = ConsultationSessionStatus.ACTIVE
        session.actual_start = session.actual_start or now
        appointment.status = AppointmentStatus.ACTIVE
        await db.flush()

    return session


async def complete_session(db: AsyncSession, session: ConsultationSession) -> ConsultationSession:
    now = _now()
    session.status = ConsultationSessionStatus.COMPLETED
    session.actual_end = now

    appt_result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient).selectinload(Patient.user))
        .where(Appointment.id == session.appointment_id)
    )
    appointment = appt_result.scalar_one()
    appointment.status = AppointmentStatus.COMPLETED

    vc_result = await db.execute(
        select(VideoCallSession).where(VideoCallSession.session_id == session.id)
    )
    video = vc_result.scalar_one_or_none()
    if video and video.status != VideoCallStatus.ENDED:
        video.status = VideoCallStatus.ENDED
        video.ended_at = now

    await notify_consultation_completed(db, appointment, session.id)

    try:
        from app.services.consultation_ai_summary_service import generate_consultation_summary
        from app.services.patient_context_service import build_patient_ai_context

        note_result = await db.execute(
            select(ConsultationNote).where(ConsultationNote.appointment_id == appointment.id)
        )
        note = note_result.scalar_one_or_none()
        msg_result = await db.execute(
            select(ConsultationMessage)
            .where(ConsultationMessage.session_id == session.id)
            .order_by(ConsultationMessage.created_at.asc())
        )
        messages = [
            {"role": m.sender_role, "content": m.content}
            for m in msg_result.scalars().all()
        ]
        rx_result = await db.execute(
            select(Prescription).where(
                Prescription.appointment_id == appointment.id,
                Prescription.deleted_at.is_(None),
            )
        )
        prescription = rx_result.scalar_one_or_none()
        patient_context = await build_patient_ai_context(db, appointment.patient)
        ai_summary = await generate_consultation_summary(
            consultation_note={
                "symptoms": note.symptoms if note else None,
                "diagnosis": note.diagnosis if note else None,
                "treatment_plan": note.treatment_plan if note else None,
                "follow_up_notes": note.follow_up_notes if note else None,
            },
            chat_messages=messages,
            prescription={
                "diagnosis": prescription.diagnosis,
                "medications": prescription.medications,
                "instructions": prescription.instructions,
            }
            if prescription
            else None,
            patient_context=patient_context,
        )
        if note:
            draft = dict(note.draft_json or {})
            draft["ai_summary"] = ai_summary
            note.draft_json = draft
        else:
            note = ConsultationNote(
                appointment_id=appointment.id,
                doctor_id=appointment.doctor_id,
                patient_id=appointment.patient_id,
                draft_json={"ai_summary": ai_summary},
            )
            db.add(note)
    except Exception:
        pass

    await db.flush()
    return session


async def process_session_lifecycle(db: AsyncSession) -> int:
    """Background job: auto-complete sessions past end time."""
    now = _now()
    result = await db.execute(
        select(ConsultationSession).where(
            ConsultationSession.status == ConsultationSessionStatus.ACTIVE,
            ConsultationSession.scheduled_end <= now,
        )
    )
    sessions = result.scalars().all()
    for session in sessions:
        await complete_session(db, session)
    return len(sessions)
