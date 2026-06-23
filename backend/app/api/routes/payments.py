from datetime import date, time
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_patient, get_current_user, require_roles
from app.core.config import settings
from app.core.enums import PaymentStatus, UserRole
from app.db.session import get_db
from app.models import Patient, Payment, User
from app.schemas import (
    APIResponse,
    AppointmentCheckoutRequest,
    CheckoutResponse,
    PaymentHistoryResponse,
    SubscriptionStatusResponse,
)
from app.services.payment_service import (
    create_appointment_checkout,
    create_subscription_checkout,
    handle_webhook_event,
    verify_and_complete_checkout,
    verify_polar_webhook,
)
from app.services.subscription_service import get_active_subscription, subscription_to_dict

router = APIRouter(prefix="/payments", tags=["Payments"])


@router.get("/subscription/status", response_model=APIResponse[SubscriptionStatusResponse])
async def subscription_status(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    sub = await get_active_subscription(db, user.id)
    if not sub:
        return APIResponse(
            data=SubscriptionStatusResponse(
                is_active=False,
                plan_name="AI Doctor Plan",
                amount=settings.AI_SUBSCRIPTION_AMOUNT_PKR,
                status="expired",
                days_remaining=0,
                message="No active subscription. Subscribe to access AI Doctor services.",
            )
        )
    data = subscription_to_dict(sub)
    return APIResponse(
        data=SubscriptionStatusResponse(
            is_active=data["is_active"],
            plan_name=data["plan_name"],
            amount=data["amount"],
            status=data["status"],
            start_date=data["start_date"],
            expiry_date=data["expiry_date"],
            days_remaining=data["days_remaining"],
            message=None,
        )
    )


@router.post("/checkout/subscription", response_model=APIResponse[CheckoutResponse])
async def checkout_subscription(
    user: User = Depends(require_roles(UserRole.PATIENT)),
    db: AsyncSession = Depends(get_db),
):
    result = await create_subscription_checkout(db, user)
    return APIResponse(data=CheckoutResponse.model_validate(result))


@router.post("/checkout/appointment", response_model=APIResponse[CheckoutResponse])
async def checkout_appointment(
    data: AppointmentCheckoutRequest,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    user, patient = patient_ctx
    if data.appointment_date < date.today():
        raise HTTPException(status_code=400, detail="Cannot book appointments in the past")

    start = time.fromisoformat(data.start_time)
    result = await create_appointment_checkout(
        db,
        user,
        patient,
        doctor_id=data.doctor_id,
        appointment_date=data.appointment_date,
        start_time=start,
        reason=data.reason,
    )
    return APIResponse(data=CheckoutResponse.model_validate(result))


@router.get("/verify/{checkout_id}", response_model=APIResponse[dict])
async def verify_checkout(
    checkout_id: str,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    payment = await verify_and_complete_checkout(db, checkout_id, user_id=user.id)
    return APIResponse(
        data={
            "payment_id": str(payment.id),
            "payment_type": payment.payment_type.value,
            "payment_status": payment.payment_status.value,
            "appointment_id": str(payment.appointment_id) if payment.appointment_id else None,
        }
    )


@router.get("/history", response_model=APIResponse[list[PaymentHistoryResponse]])
async def payment_history(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == user.id)
        .order_by(Payment.created_at.desc())
        .limit(50)
    )
    payments = result.scalars().all()
    return APIResponse(
        data=[
            PaymentHistoryResponse(
                id=p.id,
                amount=p.amount,
                currency=p.currency,
                payment_type=p.payment_type.value,
                payment_status=p.payment_status.value,
                transaction_id=p.transaction_id,
                payment_provider=p.payment_provider,
                appointment_id=p.appointment_id,
                created_at=p.created_at,
            )
            for p in payments
        ]
    )


@router.post("/webhooks/polar", status_code=202)
async def polar_webhook(request: Request, db: AsyncSession = Depends(get_db)):
    body = await request.body()
    payload = verify_polar_webhook(body, dict(request.headers))
    await handle_webhook_event(db, payload)
    await db.commit()
    return {"received": True}
