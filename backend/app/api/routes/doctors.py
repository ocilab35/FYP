from datetime import date, datetime, time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import get_current_doctor, require_roles
from app.core.enums import AppointmentStatus, NotificationType, UserRole
from app.core.formatting import format_datetime_12h
from app.db.session import get_db
from app.models import Appointment, ConsultationNote, ConsultationSession, Doctor, DoctorAvailability, MedicalRecord, Notification, Patient, Prescription, User
from app.schemas import (
    APIResponse,
    AppointmentResponse,
    AppointmentUpdate,
    ConsultationNoteResponse,
    ConsultationNoteSave,
    DoctorAvailabilityCreate,
    DoctorAvailabilityResponse,
    DoctorAvailabilityUpdate,
    DoctorProfileUpdate,
    NotificationResponse,
    PrescriptionCreate,
    PrescriptionResponse,
)
from app.services.appointment_service import get_available_slots
from app.services.consultation_service import approve_appointment, reject_appointment
from app.services.emr_service import load_appointment_context, save_consultation_note, verify_doctor_appointment_access
from app.services.prescription_service import generate_prescription_pdf

router = APIRouter(prefix="/doctors", tags=["Doctors"])


@router.get("/schedule", response_model=APIResponse[dict])
async def get_daily_schedule(
    schedule_date: date = Query(..., alias="date"),
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    appt_result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient).selectinload(Patient.user))
        .where(
            Appointment.doctor_id == doctor.id,
            Appointment.appointment_date == schedule_date,
            Appointment.deleted_at.is_(None),
            Appointment.status.in_([
                AppointmentStatus.PENDING,
                AppointmentStatus.APPROVED,
                AppointmentStatus.CONFIRMED,
                AppointmentStatus.ACTIVE,
            ]),
        )
        .order_by(Appointment.scheduled_at)
    )
    appointments = appt_result.scalars().all()
    available = await get_available_slots(db, doctor.id, schedule_date)

    return APIResponse(
        data={
            "date": schedule_date.isoformat(),
            "appointments": [
                {
                    **AppointmentResponse.model_validate(a).model_dump(),
                    "patient_name": (
                        f"{a.patient.user.first_name} {a.patient.user.last_name}"
                        if a.patient and a.patient.user
                        else "Unknown"
                    ),
                }
                for a in appointments
            ],
            "available_slots": available,
            "total_appointments": len(appointments),
        }
    )


@router.get("/notifications", response_model=APIResponse[list[NotificationResponse]])
async def list_doctor_notifications(
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    user, _ = doctor_ctx
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return APIResponse(data=[NotificationResponse.model_validate(n) for n in result.scalars().all()])


@router.get("/notifications/unread-count", response_model=APIResponse[dict])
async def unread_notification_count(
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    user, _ = doctor_ctx
    count = (
        await db.execute(
            select(func.count())
            .select_from(Notification)
            .where(Notification.user_id == user.id, Notification.is_read.is_(False))
        )
    ).scalar() or 0
    return APIResponse(data={"count": count})


@router.patch("/notifications/{notification_id}/read")
async def mark_doctor_notification_read(
    notification_id: UUID,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    user, _ = doctor_ctx
    result = await db.execute(
        select(Notification).where(Notification.id == notification_id, Notification.user_id == user.id)
    )
    notif = result.scalar_one_or_none()
    if notif:
        notif.is_read = True
    return APIResponse(message="Notification marked as read")


@router.patch("/notifications/read-all")
async def mark_all_notifications_read(
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    user, _ = doctor_ctx
    result = await db.execute(select(Notification).where(Notification.user_id == user.id, Notification.is_read.is_(False)))
    for notif in result.scalars().all():
        notif.is_read = True
    return APIResponse(message="All notifications marked as read")


@router.get("/profile", response_model=APIResponse[dict])
async def get_doctor_profile(doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor)):
    user, doctor = doctor_ctx
    return APIResponse(
        data={
            "user": {
                "id": str(user.id),
                "email": user.email,
                "first_name": user.first_name,
                "last_name": user.last_name,
            },
            "doctor": {
                "id": str(doctor.id),
                "license_number": doctor.license_number,
                "specialization": doctor.specialization,
                "qualifications": doctor.qualifications,
                "experience_years": doctor.experience_years,
                "bio": doctor.bio,
                "consultation_fee": doctor.consultation_fee,
                "approval_status": doctor.approval_status.value,
                "hospital_affiliation": doctor.hospital_affiliation,
                "rating": doctor.rating,
                "expertise_tags": [t.tag for t in doctor.expertise_tags] if doctor.expertise_tags else [],
            },
        }
    )


@router.patch("/profile", response_model=APIResponse[dict])
async def update_doctor_profile(
    data: DoctorProfileUpdate,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(doctor, field, value)
    return APIResponse(message="Profile updated")


@router.get("/appointments/today", response_model=APIResponse[list[dict]])
async def list_today_appointments(
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    today = date.today()
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient).selectinload(Patient.user))
        .where(
            Appointment.doctor_id == doctor.id,
            Appointment.appointment_date == today,
            Appointment.deleted_at.is_(None),
        )
        .order_by(Appointment.scheduled_at)
    )
    items = []
    for a in result.scalars().all():
        appt = AppointmentResponse.model_validate(a).model_dump()
        appt["patient_name"] = (
            f"{a.patient.user.first_name} {a.patient.user.last_name}"
            if a.patient and a.patient.user
            else "Unknown"
        )
        appt["patient_mrn"] = a.patient.mrn if a.patient else None
        items.append(appt)
    return APIResponse(data=items)


@router.post("/appointments/{appointment_id}/approve", response_model=APIResponse[AppointmentResponse])
async def approve_appointment_request(
    appointment_id: UUID,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    appointment = await approve_appointment(db, doctor, appointment_id)
    return APIResponse(message="Appointment approved", data=AppointmentResponse.model_validate(appointment))


@router.post("/appointments/{appointment_id}/reject", response_model=APIResponse[AppointmentResponse])
async def reject_appointment_request(
    appointment_id: UUID,
    reason: str | None = Query(None),
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    appointment = await reject_appointment(db, doctor, appointment_id, reason)
    return APIResponse(message="Appointment rejected", data=AppointmentResponse.model_validate(appointment))


@router.get("/appointments/{appointment_id}", response_model=APIResponse[dict])
async def get_appointment_detail(
    appointment_id: UUID,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    appointment = await verify_doctor_appointment_access(db, doctor.id, appointment_id)
    data = AppointmentResponse.model_validate(appointment).model_dump()
    if appointment.patient and appointment.patient.user:
        data["patient_name"] = f"{appointment.patient.user.first_name} {appointment.patient.user.last_name}"
        data["patient_mrn"] = appointment.patient.mrn
    return APIResponse(data=data)


@router.get("/appointments/{appointment_id}/context", response_model=APIResponse[dict])
async def get_appointment_context(
    appointment_id: UUID,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    context = await load_appointment_context(db, doctor, appointment_id)
    return APIResponse(data=context)


@router.post("/appointments/{appointment_id}/notes", response_model=APIResponse[ConsultationNoteResponse])
async def save_appointment_notes(
    appointment_id: UUID,
    data: ConsultationNoteSave,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    user, doctor = doctor_ctx
    note = await save_consultation_note(
        db,
        doctor,
        appointment_id,
        symptoms=data.symptoms,
        diagnosis=data.diagnosis,
        treatment_plan=data.treatment_plan,
        follow_up_notes=data.follow_up_notes,
        is_draft=False,
        doctor_user_id=user.id,
    )
    return APIResponse(message="Consultation notes saved", data=ConsultationNoteResponse.model_validate(note))


@router.post("/appointments/{appointment_id}/notes/draft", response_model=APIResponse[dict])
async def save_appointment_notes_draft(
    appointment_id: UUID,
    data: ConsultationNoteSave,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    note = await save_consultation_note(
        db,
        doctor,
        appointment_id,
        symptoms=data.symptoms,
        diagnosis=data.diagnosis,
        treatment_plan=data.treatment_plan,
        follow_up_notes=data.follow_up_notes,
        is_draft=True,
    )
    return APIResponse(message="Draft saved", data={"draft_json": note.draft_json})


@router.get("/appointments", response_model=APIResponse[list[dict]])
async def list_doctor_appointments(
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient).selectinload(Patient.user))
        .where(Appointment.doctor_id == doctor.id, Appointment.deleted_at.is_(None))
        .order_by(Appointment.scheduled_at.desc())
    )
    items = []
    for a in result.scalars().all():
        appt = AppointmentResponse.model_validate(a).model_dump()
        appt["patient_name"] = (
            f"{a.patient.user.first_name} {a.patient.user.last_name}"
            if a.patient and a.patient.user
            else "Unknown"
        )
        appt["patient_mrn"] = a.patient.mrn if a.patient else None
        items.append(appt)
    return APIResponse(data=items)


@router.patch("/appointments/{appointment_id}", response_model=APIResponse[AppointmentResponse])
async def update_appointment(
    appointment_id: UUID,
    data: AppointmentUpdate,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    user, doctor = doctor_ctx
    result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient).selectinload(Patient.user))
        .where(Appointment.id == appointment_id, Appointment.doctor_id == doctor.id)
    )
    appointment = result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    for field, value in data.model_dump(exclude_unset=True).items():
        if field == "status" and value:
            setattr(appointment, field, AppointmentStatus(value))
        else:
            setattr(appointment, field, value)

    if data.status == "confirmed":
        patient_user_id = appointment.patient.user_id if appointment.patient else None
        if patient_user_id:
            db.add(
                Notification(
                    user_id=patient_user_id,
                    title="Appointment Confirmed",
                    message=f"Your appointment on {format_datetime_12h(appointment.scheduled_at)} has been confirmed.",
                    notification_type=NotificationType.APPOINTMENT_APPROVED,
                )
            )
    return APIResponse(data=AppointmentResponse.model_validate(appointment))


@router.post("/prescriptions", response_model=APIResponse[PrescriptionResponse], status_code=201)
async def create_prescription(
    data: PrescriptionCreate,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    user, doctor = doctor_ctx
    appt_result = await db.execute(
        select(Appointment)
        .options(selectinload(Appointment.patient).selectinload(Patient.user))
        .where(Appointment.id == data.appointment_id, Appointment.doctor_id == doctor.id)
    )
    appointment = appt_result.scalar_one_or_none()
    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    session = (
        await db.execute(
            select(ConsultationSession).where(ConsultationSession.appointment_id == data.appointment_id)
        )
    ).scalar_one_or_none()

    patient_name = (
        f"{appointment.patient.user.first_name} {appointment.patient.user.last_name}"
        if appointment.patient and appointment.patient.user
        else "Patient"
    )
    doctor_name = f"Dr. {user.first_name} {user.last_name}"

    prescription = Prescription(
        appointment_id=data.appointment_id,
        consultation_session_id=session.id if session else None,
        doctor_id=doctor.id,
        patient_id=appointment.patient_id,
        diagnosis=data.diagnosis,
        medications=data.medications,
        instructions=data.instructions,
        recommendations=getattr(data, "recommendations", None),
        valid_until=data.valid_until.date() if data.valid_until else None,
    )
    db.add(prescription)
    await db.flush()

    pdf_url = generate_prescription_pdf(
        patient_name=patient_name,
        doctor_name=doctor_name,
        diagnosis=data.diagnosis,
        medications=data.medications,
        instructions=data.instructions,
        recommendations=getattr(data, "recommendations", None),
        prescription_id=prescription.id,
    )
    if pdf_url:
        prescription.pdf_url = pdf_url

    from app.api.deps import log_audit
    from app.services.verification_service import verification_service

    await log_audit(
        db,
        action="prescription_generated",
        resource_type="prescription",
        user_id=user.id,
        resource_id=str(prescription.id),
        user=user,
    )
    await verification_service.register_prescription(db, prescription)

    if appointment.patient and appointment.patient.user:
        db.add(
            Notification(
                user_id=appointment.patient.user_id,
                title="New Prescription",
                message=f"Dr. {user.last_name} has issued a new prescription. View in My Consultations.",
                notification_type=NotificationType.PRESCRIPTION,
                link=f"/patient/consultations/{appointment.id}/summary",
            )
        )
    return APIResponse(data=PrescriptionResponse.model_validate(prescription))


@router.get("/availability", response_model=APIResponse[list[DoctorAvailabilityResponse]])
async def get_availability(
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    result = await db.execute(
        select(DoctorAvailability)
        .where(DoctorAvailability.doctor_id == doctor.id)
        .order_by(DoctorAvailability.day_of_week, DoctorAvailability.start_time)
    )
    slots = result.scalars().all()
    return APIResponse(
        data=[
            DoctorAvailabilityResponse(
                id=s.id,
                day_of_week=s.day_of_week,
                start_time=s.start_time.strftime("%H:%M"),
                end_time=s.end_time.strftime("%H:%M"),
                slot_duration_minutes=s.slot_duration_minutes,
                break_times=s.break_times or [],
                is_available=s.is_available,
            )
            for s in slots
        ]
    )


@router.post("/availability", response_model=APIResponse[DoctorAvailabilityResponse], status_code=201)
async def add_availability(
    data: DoctorAvailabilityCreate,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    start = time.fromisoformat(data.start_time)
    end = time.fromisoformat(data.end_time)
    if start >= end:
        raise HTTPException(status_code=400, detail="Start time must be before end time")

    slot = DoctorAvailability(
        doctor_id=doctor.id,
        day_of_week=data.day_of_week,
        start_time=start,
        end_time=end,
        slot_duration_minutes=data.slot_duration_minutes,
        break_times=[b.model_dump() for b in data.break_times],
        is_available=data.is_available,
    )
    db.add(slot)
    await db.flush()
    return APIResponse(
        message="Availability added",
        data=DoctorAvailabilityResponse(
            id=slot.id,
            day_of_week=slot.day_of_week,
            start_time=slot.start_time.strftime("%H:%M"),
            end_time=slot.end_time.strftime("%H:%M"),
            slot_duration_minutes=slot.slot_duration_minutes,
            break_times=slot.break_times or [],
            is_available=slot.is_available,
        ),
    )


@router.patch("/availability/{availability_id}", response_model=APIResponse[DoctorAvailabilityResponse])
async def update_availability(
    availability_id: UUID,
    data: DoctorAvailabilityUpdate,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    result = await db.execute(
        select(DoctorAvailability).where(
            DoctorAvailability.id == availability_id,
            DoctorAvailability.doctor_id == doctor.id,
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Availability not found")

    updates = data.model_dump(exclude_unset=True)
    if "start_time" in updates:
        slot.start_time = time.fromisoformat(updates.pop("start_time"))
    if "end_time" in updates:
        slot.end_time = time.fromisoformat(updates.pop("end_time"))
    if "break_times" in updates and updates["break_times"] is not None:
        slot.break_times = updates.pop("break_times")
    for field, value in updates.items():
        setattr(slot, field, value)

    return APIResponse(
        message="Availability updated",
        data=DoctorAvailabilityResponse(
            id=slot.id,
            day_of_week=slot.day_of_week,
            start_time=slot.start_time.strftime("%H:%M"),
            end_time=slot.end_time.strftime("%H:%M"),
            slot_duration_minutes=slot.slot_duration_minutes,
            break_times=slot.break_times or [],
            is_available=slot.is_available,
        ),
    )


@router.delete("/availability/{availability_id}")
async def delete_availability(
    availability_id: UUID,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    _, doctor = doctor_ctx
    result = await db.execute(
        select(DoctorAvailability).where(
            DoctorAvailability.id == availability_id,
            DoctorAvailability.doctor_id == doctor.id,
        )
    )
    slot = result.scalar_one_or_none()
    if not slot:
        raise HTTPException(status_code=404, detail="Availability not found")
    await db.delete(slot)
    return APIResponse(message="Availability removed")


@router.get("/patients/lookup", response_model=APIResponse[dict])
async def lookup_patient_by_mrn(
    mrn: str = Query(..., min_length=5),
    appointment_id: UUID | None = None,
    doctor_ctx: tuple[User, Doctor] = Depends(get_current_doctor),
    db: AsyncSession = Depends(get_db),
):
    """Controlled patient lookup — only via MRN and only if doctor has an appointment with patient."""
    _, doctor = doctor_ctx
    patient_result = await db.execute(
        select(Patient).options(selectinload(Patient.user)).where(Patient.mrn == mrn, Patient.deleted_at.is_(None))
    )
    patient = patient_result.scalar_one_or_none()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    appt_query = select(Appointment).where(
        Appointment.doctor_id == doctor.id,
        Appointment.patient_id == patient.id,
        Appointment.deleted_at.is_(None),
    )
    if appointment_id:
        appt_query = appt_query.where(Appointment.id == appointment_id)
    appt = (await db.execute(appt_query.limit(1))).scalar_one_or_none()
    if not appt:
        raise HTTPException(status_code=403, detail="No assigned appointment with this patient")

    return APIResponse(
        data={
            "patient_id": str(patient.id),
            "mrn": patient.mrn,
            "name": f"{patient.user.first_name} {patient.user.last_name}",
            "appointment_id": str(appt.id),
        }
    )
