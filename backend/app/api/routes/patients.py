import asyncio
import logging
from datetime import date, datetime, time, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_patient, require_ai_subscription, require_roles
from app.services.medication_extraction_service import extract_medications_from_prescription_image_async
from app.services.patient_context_service import build_patient_ai_context
from app.services.drug_interaction_service import analyze_drug_interactions
from app.services.medical_report_ai_service import summarize_medical_report
from app.core.enums import DoctorApprovalStatus, UserRole
from app.db.session import get_db
from app.models import Appointment, Doctor, DoctorExpertise, MedicalRecord, Medication, Notification, Patient, Prescription, User
from app.schemas import (
    APIResponse,
    AppointmentCreate,
    AppointmentRescheduleRequest,
    AppointmentResponse,
    AvailableSlotResponse,
    DoctorSearchResponse,
    MedicalRecordCreate,
    MedicalRecordResponse,
    MedicationBulkCreate,
    MedicationCreate,
    MedicationResponse,
    MedicationUpdate,
    PrescriptionExtractionResponse,
    DrugInteractionResponse,
    MedicalReportSummaryResponse,
    NotificationResponse,
    PaginatedResponse,
    PatientProfileUpdate,
    PrescriptionResponse,
    SlotBookingRequest,
)
from app.services.emr_service import calc_age, ensure_patient_mrn
from app.services.file_storage import save_medical_file
from app.services.appointment_service import (
    book_appointment_slot,
    cancel_appointment,
    get_available_slots,
    reschedule_appointment,
)

router = APIRouter(prefix="/patients", tags=["Patients"])
logger = logging.getLogger(__name__)


@router.get("/profile", response_model=APIResponse[dict])
async def get_profile(
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    user, patient = patient_ctx
    mrn = await ensure_patient_mrn(db, patient)
    return APIResponse(
        data={
            "user": {
                "id": str(user.id),
                "email": user.email,
                "phone": user.phone,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            "patient": {
                "id": str(patient.id),
                "mrn": mrn,
                "date_of_birth": patient.date_of_birth.isoformat() if patient.date_of_birth else None,
                "age": calc_age(patient.date_of_birth),
                "gender": patient.gender,
                "blood_group": patient.blood_group,
                "address": patient.address,
                "emergency_contact": patient.emergency_contact,
                "allergies": patient.allergies,
                "chronic_conditions": patient.chronic_conditions,
            },
        }
    )


@router.patch("/profile", response_model=APIResponse[dict])
async def update_profile(
    data: PatientProfileUpdate,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "date_of_birth" and value:
            setattr(patient, field, value.date() if hasattr(value, "date") else value)
        else:
            setattr(patient, field, value)
    await db.flush()
    return APIResponse(message="Profile updated")


@router.get("/doctors", response_model=APIResponse[PaginatedResponse[DoctorSearchResponse]])
async def search_doctors(
    q: str | None = None,
    specialization: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.PATIENT)),
):
    query = (
        select(Doctor)
        .join(User)
        .options(selectinload(Doctor.expertise_tags), selectinload(Doctor.user))
        .where(
            Doctor.deleted_at.is_(None),
            Doctor.approval_status == DoctorApprovalStatus.APPROVED,
            User.is_active.is_(True),
        )
    )
    if specialization:
        query = query.where(Doctor.specialization.ilike(f"%{specialization}%"))
    if q:
        query = query.where(
            (User.first_name + " " + User.last_name).ilike(f"%{q}%")
            | Doctor.specialization.ilike(f"%{q}%")
        )

    count_result = await db.execute(select(func.count()).select_from(query.subquery()))
    total = count_result.scalar() or 0

    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    doctors = result.scalars().all()

    items = [
        DoctorSearchResponse(
            id=d.id,
            user_id=d.user_id,
            first_name=d.user.first_name,
            last_name=d.user.last_name,
            specialization=d.specialization,
            experience_years=d.experience_years,
            consultation_fee=d.consultation_fee,
            rating=d.rating,
            total_reviews=d.total_reviews,
            hospital_affiliation=d.hospital_affiliation,
            expertise_tags=[t.tag for t in d.expertise_tags],
        )
        for d in doctors
    ]
    return APIResponse(
        data=PaginatedResponse(
            items=items,
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, (total + page_size - 1) // page_size),
        )
    )


@router.get("/doctors/{doctor_id}/available-slots", response_model=APIResponse[list[AvailableSlotResponse]])
async def get_doctor_available_slots(
    doctor_id: UUID,
    appointment_date: date = Query(..., alias="date"),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    if appointment_date < date.today():
        raise HTTPException(status_code=400, detail="Cannot view slots for past dates")
    slots = await get_available_slots(db, doctor_id, appointment_date)
    return APIResponse(data=[AvailableSlotResponse(**s) for s in slots])


@router.post("/appointments/book", response_model=APIResponse[AppointmentResponse], status_code=201)
async def book_slot_appointment(
    data: SlotBookingRequest,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    """Direct booking disabled — appointments require payment via /payments/checkout/appointment."""
    raise HTTPException(
        status_code=402,
        detail="Payment required. Use the payment checkout flow to book appointments.",
    )


@router.post("/appointments", response_model=APIResponse[AppointmentResponse], status_code=201)
async def book_appointment_legacy(
    data: AppointmentCreate,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    """Legacy endpoint — payment required via /payments/checkout/appointment."""
    raise HTTPException(
        status_code=402,
        detail="Payment required. Use the payment checkout flow to book appointments.",
    )


@router.patch("/appointments/{appointment_id}/cancel", response_model=APIResponse[AppointmentResponse])
async def cancel_patient_appointment(
    appointment_id: UUID,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    user, patient = patient_ctx
    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.patient_id == patient.id,
            Appointment.deleted_at.is_(None),
        )
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")
    updated = await cancel_appointment(db, appointment, user)
    return APIResponse(message="Appointment cancelled", data=AppointmentResponse.model_validate(updated))


@router.patch("/appointments/{appointment_id}/reschedule", response_model=APIResponse[AppointmentResponse])
async def reschedule_patient_appointment(
    appointment_id: UUID,
    data: AppointmentRescheduleRequest,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    user, patient = patient_ctx
    if data.appointment_date < date.today():
        raise HTTPException(status_code=400, detail="Cannot reschedule to a past date")

    result = await db.execute(
        select(Appointment).where(
            Appointment.id == appointment_id,
            Appointment.patient_id == patient.id,
            Appointment.deleted_at.is_(None),
        )
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    new_start = time.fromisoformat(data.start_time)
    new_appointment = await reschedule_appointment(
        db, appointment, patient, user, data.appointment_date, new_start
    )
    return APIResponse(
        message="Appointment rescheduled successfully",
        data=AppointmentResponse.model_validate(new_appointment),
    )


@router.get("/appointments", response_model=APIResponse[list[AppointmentResponse]])
async def list_appointments(
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    result = await db.execute(
        select(Appointment)
        .where(Appointment.patient_id == patient.id, Appointment.deleted_at.is_(None))
        .order_by(Appointment.scheduled_at.desc())
    )
    return APIResponse(data=[AppointmentResponse.model_validate(a) for a in result.scalars().all()])


@router.get("/prescriptions", response_model=APIResponse[list[PrescriptionResponse]])
async def list_prescriptions(
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    result = await db.execute(
        select(Prescription)
        .where(Prescription.patient_id == patient.id, Prescription.deleted_at.is_(None))
        .order_by(Prescription.created_at.desc())
    )
    return APIResponse(data=[PrescriptionResponse.model_validate(p) for p in result.scalars().all()])


@router.get("/medical-records", response_model=APIResponse[list[MedicalRecordResponse]])
async def list_medical_records(
    record_type: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    query = select(MedicalRecord).where(
        MedicalRecord.patient_id == patient.id, MedicalRecord.deleted_at.is_(None)
    )
    if record_type:
        query = query.where(MedicalRecord.record_type == record_type)
    query = query.order_by(MedicalRecord.recorded_at.desc()).offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    return APIResponse(data=[MedicalRecordResponse.model_validate(r) for r in result.scalars().all()])


@router.post("/medical-records/upload", response_model=APIResponse[MedicalRecordResponse], status_code=201)
async def upload_medical_record(
    title: str = Form(...),
    record_type: str = Form(...),
    description: str | None = Form(None),
    file: UploadFile = File(...),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    stored = await save_medical_file(patient.id, file)
    record = MedicalRecord(
        patient_id=patient.id,
        title=title,
        record_type=record_type,
        description=description,
        file_url=stored["file_url"],
        file_name=stored["file_name"],
        file_size=stored["file_size"],
        mime_type=stored["mime_type"],
        recorded_at=datetime.now(timezone.utc),
    )
    db.add(record)
    await db.flush()

    from app.api.deps import log_audit
    from app.services.verification_service import verification_service

    await log_audit(
        db,
        action="medical_record_uploaded",
        resource_type="medical_record",
        user_id=patient_ctx[0].id,
        resource_id=str(record.id),
        user=patient_ctx[0],
    )
    await verification_service.register_medical_record(db, record, stored["file_content"])
    return APIResponse(message="Medical record uploaded and anchored", data=MedicalRecordResponse.model_validate(record))


@router.post("/medical-records", response_model=APIResponse[MedicalRecordResponse], status_code=201)
async def create_medical_record(
    data: MedicalRecordCreate,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    record = MedicalRecord(patient_id=patient.id, **data.model_dump())
    db.add(record)
    await db.flush()
    return APIResponse(data=MedicalRecordResponse.model_validate(record))


@router.delete("/medical-records/{record_id}")
async def delete_medical_record(
    record_id: UUID,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    result = await db.execute(
        select(MedicalRecord).where(
            MedicalRecord.id == record_id,
            MedicalRecord.patient_id == patient.id,
            MedicalRecord.deleted_at.is_(None),
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    record.deleted_at = datetime.now(timezone.utc)
    return APIResponse(message="Medical record deleted")


@router.post("/medications/extract-from-prescription", response_model=APIResponse[PrescriptionExtractionResponse])
async def extract_medications_from_prescription(
    file: UploadFile = File(...),
    _: User = Depends(require_ai_subscription),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _user, patient = patient_ctx
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty file uploaded.")

    try:
        context = await build_patient_ai_context(db, patient)
        result = await extract_medications_from_prescription_image_async(
            content,
            file.content_type,
            context,
        )
        data = PrescriptionExtractionResponse.model_validate(result)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        logger.exception("Prescription extraction failed")
        raise HTTPException(
            status_code=422,
            detail=f"Could not process prescription image: {exc}",
        ) from exc

    return APIResponse(message="Prescription processed", data=data)


@router.post("/medications/bulk", response_model=APIResponse[list[MedicationResponse]], status_code=201)
async def add_medications_bulk(
    data: MedicationBulkCreate,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    created: list[Medication] = []
    for item in data.medications:
        med = Medication(patient_id=patient.id, **item.model_dump())
        db.add(med)
        created.append(med)
    await db.flush()
    return APIResponse(
        message=f"{len(created)} medication(s) added",
        data=[MedicationResponse.model_validate(m) for m in created],
    )


@router.get("/medications", response_model=APIResponse[list[MedicationResponse]])
async def list_medications(
    active_only: bool = Query(False),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    query = select(Medication).where(Medication.patient_id == patient.id, Medication.deleted_at.is_(None))
    if active_only:
        query = query.where(Medication.is_active.is_(True))
    result = await db.execute(query.order_by(Medication.is_active.desc(), Medication.created_at.desc()))
    return APIResponse(data=[MedicationResponse.model_validate(m) for m in result.scalars().all()])


@router.post("/medications", response_model=APIResponse[MedicationResponse], status_code=201)
async def add_medication(
    data: MedicationCreate,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    med = Medication(patient_id=patient.id, **data.model_dump())
    db.add(med)
    await db.flush()
    return APIResponse(message="Medication added", data=MedicationResponse.model_validate(med))


@router.patch("/medications/{medication_id}", response_model=APIResponse[MedicationResponse])
async def update_medication(
    medication_id: UUID,
    data: MedicationUpdate,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    result = await db.execute(
        select(Medication).where(
            Medication.id == medication_id,
            Medication.patient_id == patient.id,
            Medication.deleted_at.is_(None),
        )
    )
    med = result.scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(med, field, value)
    return APIResponse(data=MedicationResponse.model_validate(med))


@router.delete("/medications/{medication_id}")
async def delete_medication(
    medication_id: UUID,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    result = await db.execute(
        select(Medication).where(
            Medication.id == medication_id,
            Medication.patient_id == patient.id,
            Medication.deleted_at.is_(None),
        )
    )
    med = result.scalar_one_or_none()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    med.deleted_at = datetime.now(timezone.utc)
    return APIResponse(message="Medication removed")


@router.get("/medications/interactions", response_model=APIResponse[DrugInteractionResponse])
async def check_medication_interactions(
    _: User = Depends(require_ai_subscription),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    context = await build_patient_ai_context(db, patient)
    result = await analyze_drug_interactions(
        context.get("current_medications") or [],
        patient.allergies,
        patient.chronic_conditions,
    )
    return APIResponse(data=DrugInteractionResponse.model_validate(result))


@router.post("/medical-records/{record_id}/summarize", response_model=APIResponse[MedicalReportSummaryResponse])
async def summarize_medical_record_endpoint(
    record_id: UUID,
    _: User = Depends(require_ai_subscription),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    result = await db.execute(
        select(MedicalRecord).where(
            MedicalRecord.id == record_id,
            MedicalRecord.patient_id == patient.id,
            MedicalRecord.deleted_at.is_(None),
        )
    )
    record = result.scalar_one_or_none()
    if not record:
        raise HTTPException(status_code=404, detail="Medical record not found")

    context = await build_patient_ai_context(db, patient)
    existing_summary = (record.metadata_json or {}).get("ai_summary", {})
    extracted_text = record.description or record.title

    summary = await summarize_medical_report(
        title=record.title,
        record_type=record.record_type,
        description=record.description,
        extracted_text=extracted_text,
        patient_context=context,
    )

    metadata = dict(record.metadata_json or {})
    metadata["ai_summary"] = summary
    record.metadata_json = metadata
    await db.flush()

    return APIResponse(data=MedicalReportSummaryResponse.model_validate(summary))


@router.get("/notifications", response_model=APIResponse[list[NotificationResponse]])
async def list_notifications(
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    user, _ = patient_ctx
    result = await db.execute(
        select(Notification).where(Notification.user_id == user.id).order_by(Notification.created_at.desc()).limit(50)
    )
    return APIResponse(data=[NotificationResponse.model_validate(n) for n in result.scalars().all()])


@router.patch("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: UUID,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    user, _ = patient_ctx
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id)
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
    return APIResponse(message="Notification marked as read")
