from datetime import date, time
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import AppointmentStatus, DoctorApprovalStatus, SlotStatus
from app.models import Appointment, AppointmentSlot, Doctor, DoctorAvailability, Patient, User
from app.services.notification_service import (
    notify_appointment_booked,
    notify_appointment_cancelled,
    notify_appointment_rescheduled,
    notify_patient_reschedule_confirmed,
)
from app.core.formatting import format_slot_datetime
from app.services.slot_engine import combine_date_time, generate_slots_for_availability


ACTIVE_APPOINTMENT_STATUSES = (
    AppointmentStatus.PENDING,
    AppointmentStatus.APPROVED,
    AppointmentStatus.CONFIRMED,
    AppointmentStatus.ACTIVE,
)


async def get_doctor_or_404(db: AsyncSession, doctor_id: UUID) -> Doctor:
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.user))
        .where(Doctor.id == doctor_id, Doctor.deleted_at.is_(None))
    )
    doctor = result.scalar_one_or_none()
    if not doctor or doctor.approval_status != DoctorApprovalStatus.APPROVED:
        raise HTTPException(status_code=404, detail="Doctor not found or not approved")
    return doctor


async def get_booked_ranges(
    db: AsyncSession, doctor_id: UUID, target_date: date
) -> list[tuple[time, time]]:
    result = await db.execute(
        select(AppointmentSlot).where(
            AppointmentSlot.doctor_id == doctor_id,
            AppointmentSlot.appointment_date == target_date,
            AppointmentSlot.status == SlotStatus.BOOKED,
            AppointmentSlot.deleted_at.is_(None),
        )
    )
    return [(s.start_time, s.end_time) for s in result.scalars().all()]


async def get_available_slots(
    db: AsyncSession, doctor_id: UUID, target_date: date
) -> list[dict]:
    doctor = await get_doctor_or_404(db, doctor_id)
    day_of_week = target_date.weekday()

    avail_result = await db.execute(
        select(DoctorAvailability).where(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.day_of_week == day_of_week,
            DoctorAvailability.is_available.is_(True),
        )
    )
    availability_blocks = avail_result.scalars().all()
    if not availability_blocks:
        return []

    booked_ranges = await get_booked_ranges(db, doctor_id, target_date)
    all_slots: list[dict] = []

    for block in availability_blocks:
        generated = generate_slots_for_availability(
            start_time=block.start_time,
            end_time=block.end_time,
            slot_duration_minutes=block.slot_duration_minutes,
            break_times=block.break_times or [],
            target_date=target_date,
            booked_ranges=booked_ranges,
        )
        for slot in generated:
            all_slots.append(
                {
                    "start_time": slot.start_time.isoformat(),
                    "end_time": slot.end_time.isoformat(),
                    "duration_minutes": slot.duration_minutes,
                    "label": slot.label,
                }
            )

    all_slots.sort(key=lambda s: s["start_time"])

    seen: set[str] = set()
    unique_slots: list[dict] = []
    for slot in all_slots:
        if slot["start_time"] in seen:
            continue
        seen.add(slot["start_time"])
        unique_slots.append(slot)
    return unique_slots


async def book_appointment_slot(
    db: AsyncSession,
    patient: Patient,
    user: User,
    doctor_id: UUID,
    target_date: date,
    start_time: time,
    reason: str | None = None,
    send_booking_notification: bool = True,
) -> Appointment:
    """Book a slot with row-level locking and unique constraint protection."""
    start_parsed = start_time if isinstance(start_time, time) else time.fromisoformat(str(start_time))

    await db.execute(select(Doctor).where(Doctor.id == doctor_id).with_for_update())
    await get_doctor_or_404(db, doctor_id)

    day_of_week = target_date.weekday()
    avail_result = await db.execute(
        select(DoctorAvailability).where(
            DoctorAvailability.doctor_id == doctor_id,
            DoctorAvailability.day_of_week == day_of_week,
            DoctorAvailability.is_available.is_(True),
        )
    )
    blocks = avail_result.scalars().all()
    if not blocks:
        raise HTTPException(status_code=400, detail="Doctor is not available on this date")

    booked_ranges = await get_booked_ranges(db, doctor_id, target_date)

    matched_end: time | None = None
    matched_duration: int | None = None
    for block in blocks:
        generated = generate_slots_for_availability(
            start_time=block.start_time,
            end_time=block.end_time,
            slot_duration_minutes=block.slot_duration_minutes,
            break_times=block.break_times or [],
            target_date=target_date,
            booked_ranges=booked_ranges,
        )
        for slot in generated:
            if slot.start_time == start_parsed:
                matched_end = slot.end_time
                matched_duration = slot.duration_minutes
                break
        if matched_end:
            break

    if not matched_end or not matched_duration:
        raise HTTPException(status_code=400, detail="Selected slot is not available")

    scheduled_at = combine_date_time(target_date, start_parsed)

    slot = AppointmentSlot(
        doctor_id=doctor_id,
        patient_id=patient.id,
        appointment_date=target_date,
        start_time=start_parsed,
        end_time=matched_end,
        duration_minutes=matched_duration,
        status=SlotStatus.BOOKED,
    )

    try:
        db.add(slot)
        await db.flush()
    except IntegrityError as exc:
        raise HTTPException(
            status_code=409,
            detail="This appointment slot has already been booked.",
        ) from exc

    appointment = Appointment(
        patient_id=patient.id,
        doctor_id=doctor_id,
        slot_id=slot.id,
        appointment_date=target_date,
        scheduled_at=scheduled_at,
        duration_minutes=matched_duration,
        status=AppointmentStatus.PENDING,
        reason=reason,
    )
    db.add(appointment)
    await db.flush()

    if send_booking_notification:
        doctor = await get_doctor_or_404(db, doctor_id)
        patient_name = f"{user.first_name} {user.last_name}"
        await notify_appointment_booked(
            db, doctor.user_id, patient_name, target_date, start_parsed, appointment.id
        )

    return appointment


async def cancel_appointment(
    db: AsyncSession,
    appointment: Appointment,
    patient_user: User,
) -> Appointment:
    if appointment.status in (AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED):
        raise HTTPException(status_code=400, detail="Appointment cannot be cancelled")

    await db.execute(select(Doctor).where(Doctor.id == appointment.doctor_id).with_for_update())

    appointment.status = AppointmentStatus.CANCELLED

    if appointment.slot_id:
        slot_result = await db.execute(
            select(AppointmentSlot).where(AppointmentSlot.id == appointment.slot_id).with_for_update()
        )
        slot = slot_result.scalar_one_or_none()
        if slot:
            slot.status = SlotStatus.CANCELLED

    doctor_result = await db.execute(
        select(Doctor).options(selectinload(Doctor.user)).where(Doctor.id == appointment.doctor_id)
    )
    doctor = doctor_result.scalar_one()
    patient_name = f"{patient_user.first_name} {patient_user.last_name}"
    await notify_appointment_cancelled(db, doctor.user_id, patient_name, appointment.id)

    return appointment


async def reschedule_appointment(
    db: AsyncSession,
    appointment: Appointment,
    patient: Patient,
    patient_user: User,
    new_date: date,
    new_start_time: time,
) -> Appointment:
    if appointment.status in (AppointmentStatus.CANCELLED, AppointmentStatus.COMPLETED):
        raise HTTPException(status_code=400, detail="Appointment cannot be rescheduled")

    old_doctor_id = appointment.doctor_id

    await db.execute(select(Doctor).where(Doctor.id == old_doctor_id).with_for_update())

    if appointment.slot_id:
        slot_result = await db.execute(
            select(AppointmentSlot).where(AppointmentSlot.id == appointment.slot_id).with_for_update()
        )
        old_slot = slot_result.scalar_one_or_none()
        if old_slot:
            old_slot.status = SlotStatus.CANCELLED

    appointment.status = AppointmentStatus.RESCHEDULED

    new_appointment = await book_appointment_slot(
        db,
        patient,
        patient_user,
        old_doctor_id,
        new_date,
        new_start_time,
        appointment.reason,
        send_booking_notification=False,
    )
    new_appointment.rescheduled_from_id = appointment.id

    doctor_result = await db.execute(
        select(Doctor).options(selectinload(Doctor.user)).where(Doctor.id == old_doctor_id)
    )
    doctor = doctor_result.scalar_one()
    patient_name = f"{patient_user.first_name} {patient_user.last_name}"
    await notify_appointment_rescheduled(
        db, doctor.user_id, patient_name, new_date, new_start_time, new_appointment.id
    )
    await notify_patient_reschedule_confirmed(
        db,
        patient_user.id,
        format_slot_datetime(new_date, new_start_time),
    )

    return new_appointment
