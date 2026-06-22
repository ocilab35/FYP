"""Telemedicine schema migration."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

STATEMENTS = [
    """
    DO $$ BEGIN
        ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'approved';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
    """
    DO $$ BEGIN
        ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'rejected';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
    """
    DO $$ BEGIN
        ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'active';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
    """
    DO $$ BEGIN
        ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'confirmed';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
    """
    UPDATE appointments SET status = 'approved'::appointmentstatus
    WHERE status::text = 'confirmed'
    """,
    """
    DO $$ BEGIN
        CREATE TYPE consultationsessionstatus AS ENUM ('waiting', 'active', 'completed');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
    """
    DO $$ BEGIN
        CREATE TYPE videocallstatus AS ENUM ('idle', 'connecting', 'active', 'ended');
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
    """
    CREATE TABLE IF NOT EXISTS consultation_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        scheduled_start TIMESTAMPTZ NOT NULL,
        scheduled_end TIMESTAMPTZ NOT NULL,
        actual_start TIMESTAMPTZ,
        actual_end TIMESTAMPTZ,
        status consultationsessionstatus NOT NULL DEFAULT 'waiting',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_consultation_sessions_status ON consultation_sessions (status)
    """,
    """
    CREATE TABLE IF NOT EXISTS consultation_messages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL REFERENCES consultation_sessions(id) ON DELETE CASCADE,
        sender_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        sender_role VARCHAR(20) NOT NULL,
        content TEXT NOT NULL,
        message_type VARCHAR(20) NOT NULL DEFAULT 'text',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_consultation_messages_session ON consultation_messages (session_id, created_at)
    """,
    """
    CREATE TABLE IF NOT EXISTS video_call_sessions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        session_id UUID NOT NULL UNIQUE REFERENCES consultation_sessions(id) ON DELETE CASCADE,
        status videocallstatus NOT NULL DEFAULT 'idle',
        started_at TIMESTAMPTZ,
        ended_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    ALTER TABLE consultation_notes ADD COLUMN IF NOT EXISTS draft_json JSONB
    """,
    """
    ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS consultation_session_id UUID
        REFERENCES consultation_sessions(id) ON DELETE SET NULL
    """,
    """
    ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS pdf_url VARCHAR(500)
    """,
    """
    ALTER TABLE prescriptions ADD COLUMN IF NOT EXISTS recommendations TEXT
    """,
    """
    DO $$ BEGIN
        ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'appointment_approval_request';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
    """
    DO $$ BEGIN
        ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'appointment_approved';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
    """
    DO $$ BEGIN
        ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'appointment_rejected';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
    """
    DO $$ BEGIN
        ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'consultation_started';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
    """
    DO $$ BEGIN
        ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'consultation_completed';
    EXCEPTION WHEN duplicate_object THEN NULL; END $$
    """,
]


async def run():
    enum_stmts = STATEMENTS[:5]
    rest_stmts = STATEMENTS[5:]
    for stmt in enum_stmts:
        async with engine.begin() as conn:
            await conn.execute(text(stmt.strip()))
    for stmt in rest_stmts:
        async with engine.begin() as conn:
            await conn.execute(text(stmt.strip()))
    print("Telemedicine migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run())
