"""Build patient clinical context for AI personalization."""

from __future__ import annotations

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    AIConsultation,
    Appointment,
    ConsultationNote,
    MedicalRecord,
    Medication,
    Patient,
    Prescription,
    User,
)
from app.services.emr_service import calc_age


async def build_patient_ai_context(db: AsyncSession, patient: Patient) -> dict:
    user_result = await db.execute(
        select(User).where(User.id == patient.user_id)
    )
    user = user_result.scalar_one_or_none()

    meds_result = await db.execute(
        select(Medication)
        .where(Medication.patient_id == patient.id, Medication.deleted_at.is_(None), Medication.is_active.is_(True))
        .order_by(Medication.created_at.desc())
        .limit(30)
    )
    medications = [
        {
            "medicine_name": m.medicine_name,
            "dosage": m.dosage,
            "frequency": m.frequency,
            "duration": m.duration,
            "notes": m.notes,
        }
        for m in meds_result.scalars().all()
    ]

    records_result = await db.execute(
        select(MedicalRecord)
        .where(MedicalRecord.patient_id == patient.id, MedicalRecord.deleted_at.is_(None))
        .order_by(MedicalRecord.recorded_at.desc())
        .limit(15)
    )
    medical_records = [
        {
            "title": r.title,
            "record_type": r.record_type,
            "description": r.description,
            "recorded_at": r.recorded_at.isoformat() if r.recorded_at else None,
            "ai_summary": (r.metadata_json or {}).get("ai_summary"),
        }
        for r in records_result.scalars().all()
    ]

    rx_result = await db.execute(
        select(Prescription)
        .where(Prescription.patient_id == patient.id, Prescription.deleted_at.is_(None))
        .order_by(Prescription.created_at.desc())
        .limit(10)
    )
    prescriptions = [
        {
            "diagnosis": p.diagnosis,
            "medications": p.medications,
            "instructions": p.instructions,
            "created_at": p.created_at.isoformat() if p.created_at else None,
        }
        for p in rx_result.scalars().all()
    ]

    notes_result = await db.execute(
        select(ConsultationNote)
        .where(ConsultationNote.patient_id == patient.id)
        .order_by(ConsultationNote.updated_at.desc())
        .limit(8)
    )
    consultation_notes = [
        {
            "symptoms": n.symptoms,
            "diagnosis": n.diagnosis,
            "treatment_plan": n.treatment_plan,
            "follow_up_notes": n.follow_up_notes,
        }
        for n in notes_result.scalars().all()
    ]

    ai_result = await db.execute(
        select(AIConsultation)
        .where(AIConsultation.patient_id == patient.id, AIConsultation.deleted_at.is_(None))
        .order_by(AIConsultation.created_at.desc())
        .limit(5)
    )
    prior_ai = [
        {
            "symptoms": c.symptoms,
            "summary": c.summary,
            "risk_level": c.risk_level.value if hasattr(c.risk_level, "value") else str(c.risk_level),
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in ai_result.scalars().all()
    ]

    appt_result = await db.execute(
        select(Appointment)
        .where(Appointment.patient_id == patient.id, Appointment.deleted_at.is_(None))
        .order_by(Appointment.scheduled_at.desc())
        .limit(8)
    )
    appointments = [
        {
            "scheduled_at": a.scheduled_at.isoformat() if a.scheduled_at else None,
            "status": a.status.value if hasattr(a.status, "value") else str(a.status),
            "reason": a.reason,
        }
        for a in appt_result.scalars().all()
    ]

    return {
        "demographics": {
            "full_name": f"{user.first_name} {user.last_name}" if user else "Patient",
            "age": calc_age(patient.date_of_birth),
            "gender": patient.gender,
            "blood_group": patient.blood_group,
        },
        "allergies": patient.allergies,
        "chronic_conditions": patient.chronic_conditions,
        "emergency_contact": patient.emergency_contact,
        "current_medications": medications,
        "medical_records": medical_records,
        "prescriptions": prescriptions,
        "consultation_notes": consultation_notes,
        "prior_ai_consultations": prior_ai,
        "appointments": appointments,
    }


async def load_patient_with_user(db: AsyncSession, patient_id: UUID) -> tuple[Patient, User | None]:
    result = await db.execute(
        select(Patient)
        .options(selectinload(Patient.user))
        .where(Patient.id == patient_id, Patient.deleted_at.is_(None))
    )
    patient = result.scalar_one_or_none()
    if not patient:
        return None, None  # type: ignore
    return patient, patient.user
