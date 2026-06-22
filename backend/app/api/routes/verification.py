"""Blockchain verification and audit explorer APIs."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import require_roles
from app.core.enums import UserRole
from app.db.session import get_db
from app.models import AuditLog, MedicalRecord, Prescription, User
from app.schemas import APIResponse, VerificationResult
from app.services.blockchain_service import blockchain_service
from app.services.verification_service import verification_service

router = APIRouter(prefix="/verification", tags=["Blockchain Verification"])


@router.get("/medical-records/{record_id}", response_model=APIResponse[VerificationResult])
async def verify_medical_record(
    record_id: UUID,
    user: User = Depends(require_roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    patient_id = user.patient.id if user.role == UserRole.PATIENT and user.patient else None
    result = await verification_service.verify_medical_record(db, record_id, patient_id)
    return APIResponse(data=VerificationResult(**result))


@router.get("/prescriptions/{prescription_id}", response_model=APIResponse[VerificationResult])
async def verify_prescription(
    prescription_id: UUID,
    user: User = Depends(require_roles(UserRole.PATIENT, UserRole.DOCTOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    patient_id = user.patient.id if user.role == UserRole.PATIENT and user.patient else None
    result = await verification_service.verify_prescription(db, prescription_id, patient_id)
    return APIResponse(data=VerificationResult(**result))


@router.get("/admin/dashboard", response_model=APIResponse[dict])
async def blockchain_dashboard(
    _admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    verified_records = await db.scalar(
        select(func.count()).select_from(MedicalRecord).where(
            MedicalRecord.verification_status == "verified",
            MedicalRecord.deleted_at.is_(None),
        )
    )
    verified_rx = await db.scalar(
        select(func.count()).select_from(Prescription).where(
            Prescription.verification_status == "verified",
            Prescription.deleted_at.is_(None),
        )
    )
    anchored_audits = await db.scalar(
        select(func.count()).select_from(AuditLog).where(AuditLog.blockchain_tx_hash.isnot(None))
    )
    tampered_records = await db.scalar(
        select(func.count()).select_from(MedicalRecord).where(
            MedicalRecord.verification_status == "tampered"
        )
    )
    tampered_rx = await db.scalar(
        select(func.count()).select_from(Prescription).where(
            Prescription.verification_status == "tampered"
        )
    )

    return APIResponse(
        data={
            "blockchain_enabled": blockchain_service.is_enabled,
            "simulated_mode": blockchain_service.is_simulated,
            "verified_medical_records": verified_records or 0,
            "verified_prescriptions": verified_rx or 0,
            "anchored_audit_events": anchored_audits or 0,
            "tampered_items": (tampered_records or 0) + (tampered_rx or 0),
        }
    )


@router.get("/admin/audit-trail", response_model=APIResponse[list[dict]])
async def blockchain_audit_trail(
    _admin: User = Depends(require_roles(UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(AuditLog)
        .where(AuditLog.blockchain_tx_hash.isnot(None))
        .order_by(AuditLog.created_at.desc())
        .limit(100)
    )
    items = [
        {
            "id": str(log.id),
            "action": log.action,
            "resource_type": log.resource_type,
            "resource_id": log.resource_id,
            "user_id": str(log.user_id) if log.user_id else None,
            "user_role": log.user_role,
            "blockchain_tx_hash": log.blockchain_tx_hash,
            "blockchain_hash": log.blockchain_hash,
            "created_at": log.created_at.isoformat(),
        }
        for log in result.scalars().all()
    ]
    return APIResponse(data=items)
