from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.enums import UserRole
from app.db.session import get_db
from app.models import Appointment, MedicalRecord, User
from app.services.file_storage import resolve_medical_file

router = APIRouter(prefix="/files", tags=["Files"])


@router.get("/medical/{patient_id}/{stored_name}")
async def download_medical_file(
    patient_id: UUID,
    stored_name: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user.role == UserRole.PATIENT:
        if not user.patient or user.patient.id != patient_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role == UserRole.DOCTOR:
        if not user.doctor:
            raise HTTPException(status_code=403, detail="Access denied")
        appt = await db.execute(
            select(Appointment).where(
                Appointment.doctor_id == user.doctor.id,
                Appointment.patient_id == patient_id,
            ).limit(1)
        )
        if not appt.scalar_one_or_none():
            raise HTTPException(status_code=403, detail="No assigned appointment with this patient")
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    path = resolve_medical_file(patient_id, stored_name)
    record = (
        await db.execute(
            select(MedicalRecord).where(
                MedicalRecord.patient_id == patient_id,
                MedicalRecord.file_url.contains(stored_name),
                MedicalRecord.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()

    media_type = record.mime_type if record else "application/octet-stream"
    filename = record.file_name if record and record.file_name else stored_name
    return FileResponse(path, media_type=media_type, filename=filename)


@router.get("/prescriptions/{filename}")
async def download_prescription_pdf(
    filename: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    from pathlib import Path

    from app.core.config import settings
    from app.models import Prescription

    if ".." in filename or "/" in filename:
        raise HTTPException(status_code=400, detail="Invalid filename")

    result = await db.execute(
        select(Prescription).where(Prescription.pdf_url.contains(filename), Prescription.deleted_at.is_(None))
    )
    rx = result.scalar_one_or_none()
    if not rx:
        raise HTTPException(status_code=404, detail="Prescription not found")

    if user.role == UserRole.PATIENT:
        if not user.patient or user.patient.id != rx.patient_id:
            raise HTTPException(status_code=403, detail="Access denied")
    elif user.role == UserRole.DOCTOR:
        if not user.doctor or user.doctor.id != rx.doctor_id:
            raise HTTPException(status_code=403, detail="Access denied")
    else:
        raise HTTPException(status_code=403, detail="Access denied")

    path = Path(settings.UPLOAD_DIR) / "prescriptions" / filename
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(path, media_type="application/pdf", filename=filename)
