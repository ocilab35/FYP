"""Subscription lifecycle for AI Doctor access."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.enums import SubscriptionStatus
from app.models import Subscription


async def expire_stale_subscriptions(db: AsyncSession) -> int:
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Subscription).where(
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.expiry_date < now,
        )
    )
    count = 0
    for sub in result.scalars().all():
        sub.status = SubscriptionStatus.EXPIRED
        count += 1
    if count:
        await db.flush()
    return count


async def get_active_subscription(db: AsyncSession, user_id: UUID) -> Subscription | None:
    await expire_stale_subscriptions(db)
    now = datetime.now(timezone.utc)
    result = await db.execute(
        select(Subscription)
        .where(
            Subscription.user_id == user_id,
            Subscription.status == SubscriptionStatus.ACTIVE,
            Subscription.expiry_date >= now,
        )
        .order_by(Subscription.expiry_date.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()


async def has_active_ai_subscription(db: AsyncSession, user_id: UUID) -> bool:
    return (await get_active_subscription(db, user_id)) is not None


async def activate_subscription(
    db: AsyncSession,
    *,
    user_id: UUID,
    payment_reference: str,
    amount: float | None = None,
) -> Subscription:
    now = datetime.now(timezone.utc)
    days = settings.AI_SUBSCRIPTION_DAYS
    sub = Subscription(
        user_id=user_id,
        plan_name="AI Doctor Plan",
        amount=amount or settings.AI_SUBSCRIPTION_AMOUNT_PKR,
        start_date=now,
        expiry_date=now + timedelta(days=days),
        status=SubscriptionStatus.ACTIVE,
        payment_reference=payment_reference,
    )
    db.add(sub)
    await db.flush()
    return sub


def subscription_to_dict(sub: Subscription) -> dict:
    now = datetime.now(timezone.utc)
    days_remaining = max(0, (sub.expiry_date - now).days)
    return {
        "id": str(sub.id),
        "plan_name": sub.plan_name,
        "amount": sub.amount,
        "status": sub.status.value,
        "start_date": sub.start_date.isoformat(),
        "expiry_date": sub.expiry_date.isoformat(),
        "days_remaining": days_remaining,
        "is_active": sub.status == SubscriptionStatus.ACTIVE and sub.expiry_date >= now,
    }
