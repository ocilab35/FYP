"""Payment processing, Polar webhooks, and appointment booking after payment."""

from __future__ import annotations

import hashlib
import hmac
import json
import logging
import base64
from datetime import date, time
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.config import settings
from app.core.enums import NotificationType, PaymentStatus, PaymentType
from app.models import Doctor, Patient, Payment, User
from app.services.appointment_service import book_appointment_slot
from app.services.notification_service import create_notification, notify_appointment_booked
from app.services.polar_client import PolarAPIError, polar_client
from app.services.subscription_service import activate_subscription

logger = logging.getLogger(__name__)

PROCESSED_WEBHOOKS: set[str] = set()


def pkr_to_paisa(amount_pkr: float) -> int:
    return int(round(amount_pkr * 100))


def verify_polar_webhook(body: bytes, headers: dict) -> dict:
    """Verify Standard Webhooks signature from Polar."""
    secret = settings.POLAR_WEBHOOK_SECRET.strip()
    if not secret:
        raise HTTPException(status_code=500, detail="Webhook secret not configured")

    msg_id = headers.get("webhook-id") or headers.get("Webhook-Id")
    timestamp = headers.get("webhook-timestamp") or headers.get("Webhook-Timestamp")
    signature_header = headers.get("webhook-signature") or headers.get("Webhook-Signature")

    if not all([msg_id, timestamp, signature_header]):
        raise HTTPException(status_code=400, detail="Missing webhook headers")

    signed_content = f"{msg_id}.{timestamp}.{body.decode('utf-8')}".encode()
    secret_key = secret
    if secret.startswith("whsec_"):
        secret_key = base64.b64decode(secret[6:])

    expected = hmac.new(secret_key, signed_content, hashlib.sha256).digest()
    expected_b64 = base64.b64encode(expected).decode()

    for part in signature_header.split(" "):
        if "," in part:
            _, sig = part.split(",", 1)
            if hmac.compare_digest(sig, expected_b64):
                return json.loads(body)
        elif hmac.compare_digest(part, expected_b64):
            return json.loads(body)

    raise HTTPException(status_code=401, detail="Invalid webhook signature")


async def create_subscription_checkout(
    db: AsyncSession,
    user: User,
) -> dict:
    if not settings.polar_enabled or not settings.POLAR_AI_SUBSCRIPTION_PRODUCT_ID:
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured. Set POLAR_API_KEY and POLAR_AI_SUBSCRIPTION_PRODUCT_ID.",
        )

    amount = settings.AI_SUBSCRIPTION_AMOUNT_PKR
    payment = Payment(
        user_id=user.id,
        amount=amount,
        currency="PKR",
        payment_type=PaymentType.SUBSCRIPTION,
        payment_status=PaymentStatus.PENDING,
        payment_provider="polar",
        metadata_json={"plan": "ai_doctor_monthly"},
    )
    db.add(payment)
    await db.flush()

    success_url = (
        f"{settings.FRONTEND_URL}/patient/billing/success"
        f"?type=subscription&payment_id={payment.id}&checkout_id={{CHECKOUT_ID}}"
    )

    try:
        checkout = await polar_client.create_checkout(
            product_id=settings.POLAR_AI_SUBSCRIPTION_PRODUCT_ID,
            amount_paisa=pkr_to_paisa(amount),
            customer_email=user.email,
            customer_name=f"{user.first_name} {user.last_name}",
            external_customer_id=str(user.id),
            success_url=success_url,
            metadata={
                "payment_id": str(payment.id),
                "payment_type": "subscription",
                "user_id": str(user.id),
            },
        )
    except PolarAPIError as exc:
        payment.payment_status = PaymentStatus.FAILED
        await db.flush()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    payment.polar_checkout_id = checkout.get("id")
    await db.flush()

    return {
        "payment_id": str(payment.id),
        "checkout_id": checkout.get("id"),
        "checkout_url": checkout.get("url"),
        "amount": amount,
        "currency": "PKR",
    }


async def create_appointment_checkout(
    db: AsyncSession,
    user: User,
    patient: Patient,
    *,
    doctor_id: UUID,
    appointment_date: date,
    start_time: time,
    reason: str | None,
) -> dict:
    if not settings.polar_enabled or not settings.POLAR_APPOINTMENT_PRODUCT_ID:
        raise HTTPException(
            status_code=503,
            detail="Payment system not configured. Set POLAR_API_KEY and POLAR_APPOINTMENT_PRODUCT_ID.",
        )

    doc_result = await db.execute(
        select(Doctor).options(selectinload(Doctor.user)).where(Doctor.id == doctor_id)
    )
    doctor = doc_result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")

    fee = float(doctor.consultation_fee or 0)
    if fee <= 0:
        raise HTTPException(
            status_code=400,
            detail="This doctor has no consultation fee configured. Contact admin.",
        )

    payment = Payment(
        user_id=user.id,
        amount=fee,
        currency="PKR",
        payment_type=PaymentType.APPOINTMENT,
        payment_status=PaymentStatus.PENDING,
        payment_provider="polar",
        metadata_json={
            "doctor_id": str(doctor_id),
            "appointment_date": str(appointment_date),
            "start_time": start_time.isoformat(),
            "reason": reason,
            "patient_id": str(patient.id),
        },
    )
    db.add(payment)
    await db.flush()

    success_url = (
        f"{settings.FRONTEND_URL}/patient/billing/success"
        f"?type=appointment&payment_id={payment.id}&checkout_id={{CHECKOUT_ID}}"
    )

    try:
        checkout = await polar_client.create_checkout(
            product_id=settings.POLAR_APPOINTMENT_PRODUCT_ID,
            amount_paisa=pkr_to_paisa(fee),
            customer_email=user.email,
            customer_name=f"{user.first_name} {user.last_name}",
            external_customer_id=str(user.id),
            success_url=success_url,
            metadata={
                "payment_id": str(payment.id),
                "payment_type": "appointment",
                "user_id": str(user.id),
                "doctor_id": str(doctor_id),
            },
        )
    except PolarAPIError as exc:
        payment.payment_status = PaymentStatus.FAILED
        await db.flush()
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    payment.polar_checkout_id = checkout.get("id")
    await db.flush()

    return {
        "payment_id": str(payment.id),
        "checkout_id": checkout.get("id"),
        "checkout_url": checkout.get("url"),
        "amount": fee,
        "currency": "PKR",
        "doctor_name": f"Dr. {doctor.user.first_name} {doctor.user.last_name}" if doctor.user else None,
    }


async def _get_payment_by_id(db: AsyncSession, payment_id: UUID, user_id: UUID | None = None) -> Payment:
    query = select(Payment).where(Payment.id == payment_id)
    if user_id:
        query = query.where(Payment.user_id == user_id)
    result = await db.execute(query)
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found")
    return payment


async def complete_payment(
    db: AsyncSession,
    payment: Payment,
    transaction_id: str,
) -> Payment:
    if payment.payment_status == PaymentStatus.COMPLETED:
        return payment

    if payment.transaction_id and payment.transaction_id != transaction_id:
        raise HTTPException(status_code=409, detail="Payment already processed with different transaction")

    payment.payment_status = PaymentStatus.COMPLETED
    payment.transaction_id = transaction_id

    if payment.payment_type == PaymentType.SUBSCRIPTION:
        sub = await activate_subscription(
            db,
            user_id=payment.user_id,
            payment_reference=transaction_id,
            amount=payment.amount,
        )
        await create_notification(
            db,
            user_id=payment.user_id,
            title="AI Doctor Subscription Active",
            message="Your AI Doctor subscription is now active. Enjoy unlimited AI-powered healthcare services.",
            notification_type=NotificationType.SUBSCRIPTION,
            link="/patient/ai-doctor",
            metadata={"subscription_id": str(sub.id)},
        )

    elif payment.payment_type == PaymentType.APPOINTMENT:
        meta = payment.metadata_json or {}
        patient_result = await db.execute(
            select(Patient).options(selectinload(Patient.user)).where(Patient.user_id == payment.user_id)
        )
        patient = patient_result.scalar_one_or_none()
        if not patient:
            raise HTTPException(status_code=400, detail="Patient profile not found")

        user_result = await db.execute(select(User).where(User.id == payment.user_id))
        user = user_result.scalar_one()

        appt_date = date.fromisoformat(meta["appointment_date"])
        start = time.fromisoformat(meta["start_time"])
        doctor_id = UUID(meta["doctor_id"])

        appointment = await book_appointment_slot(
            db,
            patient,
            user,
            doctor_id,
            appt_date,
            start,
            meta.get("reason"),
            send_booking_notification=False,
        )
        payment.appointment_id = appointment.id

        doc_result = await db.execute(
            select(Doctor).options(selectinload(Doctor.user)).where(Doctor.id == doctor_id)
        )
        doctor = doc_result.scalar_one_or_none()
        patient_name = f"{user.first_name} {user.last_name}"

        await create_notification(
            db,
            user_id=payment.user_id,
            title="Appointment Booked",
            message="Your appointment has been booked successfully after payment confirmation.",
            notification_type=NotificationType.PAYMENT,
            link="/patient/appointments",
            metadata={"appointment_id": str(appointment.id), "payment_id": str(payment.id)},
        )

        if doctor and doctor.user:
            await notify_appointment_booked(
                db,
                doctor.user_id,
                patient_name,
                appt_date,
                start,
                appointment.id,
            )
            await create_notification(
                db,
                user_id=doctor.user_id,
                title="New Paid Appointment",
                message=f"{patient_name} booked and paid for an appointment.",
                notification_type=NotificationType.APPOINTMENT_BOOKED,
                link="/doctor/appointments",
                metadata={"appointment_id": str(appointment.id), "paid": True},
            )

    await db.flush()
    return payment


async def verify_and_complete_checkout(
    db: AsyncSession,
    checkout_id: str,
    user_id: UUID | None = None,
) -> Payment:
    result = await db.execute(
        select(Payment).where(Payment.polar_checkout_id == checkout_id)
    )
    payment = result.scalar_one_or_none()
    if not payment:
        raise HTTPException(status_code=404, detail="Payment not found for checkout")
    if user_id and payment.user_id != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if payment.payment_status == PaymentStatus.COMPLETED:
        return payment

    try:
        checkout = await polar_client.get_checkout(checkout_id)
    except PolarAPIError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    status = (checkout.get("status") or "").lower()
    if status not in ("succeeded", "confirmed", "paid"):
        raise HTTPException(status_code=402, detail="Payment not completed yet")

    order_id = checkout.get("id") or checkout_id
    return await complete_payment(db, payment, transaction_id=order_id)


async def handle_webhook_event(db: AsyncSession, payload: dict) -> None:
    event_type = payload.get("type", "")
    data = payload.get("data") or {}
    event_id = payload.get("id") or data.get("id", "")

    if event_id in PROCESSED_WEBHOOKS:
        return
    PROCESSED_WEBHOOKS.add(event_id)
    if len(PROCESSED_WEBHOOKS) > 10000:
        PROCESSED_WEBHOOKS.clear()

    checkout_id = data.get("id") or data.get("checkout_id")
    metadata = data.get("metadata") or {}
    payment_id = metadata.get("payment_id")

    if not payment_id and checkout_id:
        result = await db.execute(
            select(Payment).where(Payment.polar_checkout_id == checkout_id)
        )
        payment = result.scalar_one_or_none()
    elif payment_id:
        payment = await _get_payment_by_id(db, UUID(payment_id))
    else:
        return

    if not payment:
        return

    if event_type in ("checkout.updated", "checkout.completed", "order.created", "order.paid"):
        status = (data.get("status") or "").lower()
        if status in ("succeeded", "confirmed", "paid", "") or event_type == "order.paid":
            txn = data.get("id") or checkout_id or payment.polar_checkout_id
            if txn:
                await complete_payment(db, payment, transaction_id=str(txn))
