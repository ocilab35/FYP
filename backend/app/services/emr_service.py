"""EMR appointment context loader — hospital-grade single-query patient chart."""

from datetime import date, datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.models import (
    Appointment,
    ConsultationNote,
    Doctor,
    MedicalRecord,
    Medication,
    Patient,
    Prescription,
    User,
)


def calc_age(dob: date | None) -> int | None:
    if not dob:
        return None
    today = date.today()
    return today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))


def _patient_profile_dict(patient: Patient, user: User) -> dict:
    return {
        "id": str(patient.id),
        "mrn": patient.mrn,
        "first_name": user.first_name,
        "last_name": user.last_name,
        "full_name": f"{user.first_name} {user.last_name}",
        "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
        "age": calc_age(patient.date_of_birth),
        "gender": patient.gender,
        "blood_group": patient.blood_group,
        "allergies": patient.allergies,
        "chronic_conditions": patient.chronic_conditions,
        "emergency_contact": patient.emergency_contact,
        "address": patient.address,
    }


async def verify_doctor_appointment_access(
    db: AsyncSession, doctor_id: UUID, appointment_id: UUID
) -> Appointment:
    result = await db.execute(
        select(Appointment)
        .options(
            selectinload(Appointment.patient).selectinload(Patient.user),
            selectinload(Appointment.consultation_note),
            selectinload(Appointment.prescription),
        )
        .where(
            Appointment.id == appointment_id,
            Appointment.doctor_id == doctor_id,
            Appointment.deleted_at.is_(None),
        )
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found or access denied")
    return appointment


async def load_appointment_context(
    db: AsyncSession, doctor: Doctor, appointment_id: UUID
) -> dict:
    """Load full patient EMR context for a doctor's assigned appointment."""
    appointment = await verify_doctor_appointment_access(db, doctor.id, appointment_id)
    patient = appointment.patient
    if not patient or not patient.user:
        raise HTTPException(status_code=404, detail="Patient not found")

    records_result = await db.execute(
        select(MedicalRecord)
        .where(MedicalRecord.patient_id == patient.id, MedicalRecord.deleted_at.is_(None))
        .order_by(MedicalRecord.recorded_at.desc())
        .limit(50)
    )
    medications_result = await db.execute(
        select(Medication)
        .where(Medication.patient_id == patient.id, Medication.deleted_at.is_(None))
        .order_by(Medication.is_active.desc(), Medication.created_at.desc())
    )
    prescriptions_result = await db.execute(
        select(Prescription)
        .where(Prescription.patient_id == patient.id, Prescription.deleted_at.is_(None))
        .order_by(Prescription.created_at.desc())
        .limit(20)
    )
    prior_appts_result = await db.execute(
        select(Appointment)
        .where(
            Appointment.patient_id == patient.id,
            Appointment.doctor_id == doctor.id,
            Appointment.deleted_at.is_(None),
            Appointment.id != appointment.id,
        )
        .order_by(Appointment.scheduled_at.desc())
        .limit(10)
    )

    note = appointment.consultation_note
    return {
        "appointment": {
            "id": str(appointment.id),
            "patient_id": str(appointment.patient_id),
            "doctor_id": str(appointment.doctor_id),
            "scheduled_at": appointment.scheduled_at.isoformat(),
            "appointment_date": appointment.appointment_date.isoformat() if appointment.appointment_date else None,
            "duration_minutes": appointment.duration_minutes,
            "status": appointment.status.value,
            "reason": appointment.reason,
            "notes": appointment.notes,
            "consultation_notes": appointment.consultation_notes,
        },
        "patient": _patient_profile_dict(patient, patient.user),
        "consultation_note": {
            "symptoms": note.symptoms if note else None,
            "diagnosis": note.diagnosis if note else None,
            "treatment_plan": note.treatment_plan if note else None,
            "follow_up_notes": note.follow_up_notes if note else None,
        }
        if note
        else None,
        "medical_records": [
            {
                "id": str(r.id),
                "title": r.title,
                "record_type": r.record_type,
                "description": r.description,
                "file_url": r.file_url,
                "file_name": r.file_name,
                "mime_type": r.mime_type,
                "recorded_at": r.recorded_at.isoformat(),
                "metadata_json": r.metadata_json,
            }
            for r in records_result.scalars().all()
        ],
        "medications": [
            {
                "id": str(m.id),
                "medicine_name": m.medicine_name,
                "dosage": m.dosage,
                "frequency": m.frequency,
                "duration": m.duration,
                "notes": m.notes,
                "is_active": m.is_active,
            }
            for m in medications_result.scalars().all()
        ],
        "prescriptions": [
            {
                "id": str(p.id),
                "appointment_id": str(p.appointment_id),
                "diagnosis": p.diagnosis,
                "medications": p.medications,
                "instructions": p.instructions,
                "valid_until": p.valid_until.isoformat() if p.valid_until else None,
                "created_at": p.created_at.isoformat(),
            }
            for p in prescriptions_result.scalars().all()
        ],
        "prior_appointments": [
            {
                "id": str(a.id),
                "scheduled_at": a.scheduled_at.isoformat(),
                "status": a.status.value,
                "reason": a.reason,
            }
            for a in prior_appts_result.scalars().all()
        ],
    }


async def save_consultation_note(
    db: AsyncSession,
    doctor: Doctor,
    appointment_id: UUID,
    *,
    symptoms: str | None = None,
    diagnosis: str | None = None,
    treatment_plan: str | None = None,
    follow_up_notes: str | None = None,
    is_draft: bool = False,
    doctor_user_id: UUID | None = None,
) -> ConsultationNote:
    appointment = await verify_doctor_appointment_access(db, doctor.id, appointment_id)

    draft_payload = {
        "symptoms": symptoms,
        "diagnosis": diagnosis,
        "treatment_plan": treatment_plan,
        "follow_up_notes": follow_up_notes,
    }

    result = await db.execute(
        select(ConsultationNote).where(ConsultationNote.appointment_id == appointment_id)
    )
    note = result.scalar_one_or_none()
    if note:
        note.draft_json = draft_payload
        if not is_draft:
            if symptoms is not None:
                note.symptoms = symptoms
            if diagnosis is not None:
                note.diagnosis = diagnosis
            if treatment_plan is not None:
                note.treatment_plan = treatment_plan
            if follow_up_notes is not None:
                note.follow_up_notes = follow_up_notes
    else:
        note = ConsultationNote(
            appointment_id=appointment_id,
            doctor_id=doctor.id,
            patient_id=appointment.patient_id,
            symptoms=None if is_draft else symptoms,
            diagnosis=None if is_draft else diagnosis,
            treatment_plan=None if is_draft else treatment_plan,
            follow_up_notes=None if is_draft else follow_up_notes,
            draft_json=draft_payload,
        )
        db.add(note)

    if not is_draft:
        summary_parts = [p for p in [symptoms, diagnosis, treatment_plan, follow_up_notes] if p]
        if summary_parts:
            appointment.consultation_notes = "\n\n".join(summary_parts)
        if doctor_user_id:
            from app.api.deps import log_audit
            from app.models import User as UserModel

            u_result = await db.execute(select(UserModel).where(UserModel.id == doctor_user_id))
            doc_user = u_result.scalar_one_or_none()
            await log_audit(
                db,
                action="consultation_note_saved",
                resource_type="appointment",
                user_id=doctor_user_id,
                resource_id=str(appointment_id),
                details=draft_payload,
                user=doc_user,
            )

    await db.flush()
    return note


async def generate_mrn(db: AsyncSession) -> str:
    year = datetime.now(timezone.utc).year
    prefix = f"MRN-{year}-"
    count = (
        await db.execute(
            select(func.count()).select_from(Patient).where(Patient.mrn.like(f"{prefix}%"))
        )
    ).scalar() or 0
    return f"{prefix}{count + 1:06d}"


async def ensure_patient_mrn(db: AsyncSession, patient: Patient) -> str:
    if patient.mrn:
        return patient.mrn
    patient.mrn = await generate_mrn(db)
    await db.flush()
    return patient.mrn
