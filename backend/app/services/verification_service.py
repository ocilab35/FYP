"""Verification orchestration for medical records and prescriptions."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import MedicalRecord, Prescription
from app.services.blockchain_service import blockchain_service
from app.services.file_storage import resolve_medical_file
from app.services.hash_utils import hash_file_content, hash_prescription_pdf
from app.services.prescription_service import _prescription_dir


class VerificationService:
    async def register_medical_record(
        self,
        db: AsyncSession,
        record: MedicalRecord,
        file_content: bytes,
    ) -> MedicalRecord:
        content_hash = hash_file_content(file_content)
        receipt = blockchain_service.register_medical_report(
            record_id=record.id,
            patient_id=record.patient_id,
            content_hash_hex=content_hash,
        )
        record.blockchain_hash = content_hash
        record.blockchain_tx_hash = receipt.tx_hash
        record.verification_status = "verified" if receipt.tx_hash else "pending"
        record.blockchain_verified_at = datetime.now(timezone.utc)
        await db.flush()
        return record

    async def verify_medical_record(
        self, db: AsyncSession, record_id: UUID, patient_id: UUID | None = None
    ) -> dict:
        query = select(MedicalRecord).where(
            MedicalRecord.id == record_id,
            MedicalRecord.deleted_at.is_(None),
        )
        if patient_id:
            query = query.where(MedicalRecord.patient_id == patient_id)
        result = await db.execute(query)
        record = result.scalar_one_or_none()
        if not record:
            raise HTTPException(status_code=404, detail="Medical record not found")
        if not record.blockchain_hash or not record.file_url:
            return {
                "record_id": str(record.id),
                "status": "unverified",
                "verified": False,
                "message": "Record not anchored on blockchain",
            }

        stored_name = record.file_url.rsplit("/", 1)[-1]
        path = resolve_medical_file(record.patient_id, stored_name)
        current_hash = hash_file_content(path.read_bytes())
        local_match = current_hash == record.blockchain_hash

        chain_match = blockchain_service.verify_on_chain(
            resource_id=record.id,
            content_hash_hex=current_hash,
            resource_type="medical_record",
        )
        verified = local_match and (chain_match is not False)
        status = "verified" if verified else "tampered"
        record.verification_status = status
        await db.flush()

        return {
            "record_id": str(record.id),
            "status": status,
            "verified": verified,
            "blockchain_hash": record.blockchain_hash,
            "current_hash": current_hash,
            "blockchain_tx_hash": record.blockchain_tx_hash,
            "on_chain_verified": chain_match,
            "verified_at": record.blockchain_verified_at.isoformat() if record.blockchain_verified_at else None,
        }

    async def register_prescription(
        self,
        db: AsyncSession,
        prescription: Prescription,
    ) -> Prescription:
        pdf_path = _prescription_dir() / f"{prescription.id}.pdf"
        if not pdf_path.is_file():
            raise HTTPException(status_code=500, detail="Prescription PDF not found for anchoring")

        content_hash = hash_prescription_pdf(pdf_path.read_bytes())
        receipt = blockchain_service.register_prescription(
            prescription_id=prescription.id,
            patient_id=prescription.patient_id,
            doctor_id=prescription.doctor_id,
            content_hash_hex=content_hash,
        )
        prescription.blockchain_hash = content_hash
        prescription.blockchain_tx_hash = receipt.tx_hash
        prescription.verification_status = "verified"
        prescription.blockchain_verified_at = datetime.now(timezone.utc)
        await db.flush()
        return prescription

    async def verify_prescription(
        self, db: AsyncSession, prescription_id: UUID, patient_id: UUID | None = None
    ) -> dict:
        query = select(Prescription).where(
            Prescription.id == prescription_id,
            Prescription.deleted_at.is_(None),
        )
        if patient_id:
            query = query.where(Prescription.patient_id == patient_id)
        result = await db.execute(query)
        rx = result.scalar_one_or_none()
        if not rx:
            raise HTTPException(status_code=404, detail="Prescription not found")
        if not rx.blockchain_hash:
            return {
                "prescription_id": str(rx.id),
                "status": "unverified",
                "verified": False,
                "message": "Prescription not anchored on blockchain",
            }

        pdf_path = _prescription_dir() / f"{rx.id}.pdf"
        if not pdf_path.is_file():
            return {
                "prescription_id": str(rx.id),
                "status": "tampered",
                "verified": False,
                "message": "Prescription PDF missing",
            }

        current_hash = hash_prescription_pdf(pdf_path.read_bytes())
        local_match = current_hash == rx.blockchain_hash
        chain_match = blockchain_service.verify_on_chain(
            resource_id=rx.id,
            content_hash_hex=current_hash,
            resource_type="prescription",
        )
        verified = local_match and (chain_match is not False)
        status = "verified" if verified else "tampered"
        rx.verification_status = status
        await db.flush()

        return {
            "prescription_id": str(rx.id),
            "status": status,
            "verified": verified,
            "blockchain_hash": rx.blockchain_hash,
            "current_hash": current_hash,
            "blockchain_tx_hash": rx.blockchain_tx_hash,
            "on_chain_verified": chain_match,
            "verified_at": rx.blockchain_verified_at.isoformat() if rx.blockchain_verified_at else None,
        }


verification_service = VerificationService()
