"""Create subscriptions and payments tables."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

STATEMENTS = [
    """
    DO $$ BEGIN
        CREATE TYPE subscriptionstatus AS ENUM ('active', 'expired', 'cancelled', 'pending');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    """
    DO $$ BEGIN
        CREATE TYPE paymenttype AS ENUM ('subscription', 'appointment');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    """
    DO $$ BEGIN
        CREATE TYPE paymentstatus AS ENUM ('pending', 'completed', 'failed', 'refunded');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    """
    CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        plan_name VARCHAR(100) NOT NULL DEFAULT 'AI Doctor Plan',
        amount DOUBLE PRECISION NOT NULL,
        start_date TIMESTAMPTZ NOT NULL,
        expiry_date TIMESTAMPTZ NOT NULL,
        status subscriptionstatus NOT NULL DEFAULT 'pending',
        payment_reference VARCHAR(255),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        amount DOUBLE PRECISION NOT NULL,
        currency VARCHAR(3) NOT NULL DEFAULT 'PKR',
        payment_type paymenttype NOT NULL,
        payment_status paymentstatus NOT NULL DEFAULT 'pending',
        transaction_id VARCHAR(255),
        payment_provider VARCHAR(50) NOT NULL DEFAULT 'polar',
        polar_checkout_id VARCHAR(255),
        appointment_id UUID REFERENCES appointments(id) ON DELETE SET NULL,
        metadata_json JSONB,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    "CREATE INDEX IF NOT EXISTS ix_subscriptions_user_status ON subscriptions (user_id, status)",
    "CREATE INDEX IF NOT EXISTS ix_subscriptions_expiry ON subscriptions (expiry_date)",
    "CREATE INDEX IF NOT EXISTS ix_payments_user ON payments (user_id, created_at)",
    "CREATE INDEX IF NOT EXISTS ix_payments_transaction ON payments (transaction_id)",
    "CREATE INDEX IF NOT EXISTS ix_payments_checkout ON payments (polar_checkout_id)",
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_transaction_id
        ON payments (transaction_id) WHERE transaction_id IS NOT NULL
    """,
]


async def migrate():
    async with engine.begin() as conn:
        for stmt in STATEMENTS:
            await conn.execute(text(stmt.strip()))
    print("Payments migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
