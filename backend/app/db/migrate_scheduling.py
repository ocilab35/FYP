"""Apply scheduling system schema changes to an existing database.

Run once after pulling scheduling updates:
    python -m app.db.migrate_scheduling
"""

import asyncio

from sqlalchemy import text

from app.db.session import engine

# Order matters: create appointment_slots BEFORE appointments.slot_id FK
STATEMENTS = [
    """
    DO $$ BEGIN
        CREATE TYPE slotstatus AS ENUM ('booked', 'cancelled');
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    """
    CREATE TABLE IF NOT EXISTS appointment_slots (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        appointment_date DATE NOT NULL,
        start_time TIME NOT NULL,
        end_time TIME NOT NULL,
        duration_minutes INTEGER NOT NULL DEFAULT 30,
        status slotstatus NOT NULL DEFAULT 'booked',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
    )
    """,
    "ALTER TABLE appointment_slots DROP COLUMN IF EXISTS appointment_id",
    """
    CREATE INDEX IF NOT EXISTS ix_appointment_slots_doctor_date
        ON appointment_slots (doctor_id, appointment_date)
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_appointment_slots_patient
        ON appointment_slots (patient_id)
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS uq_appointment_slot_doctor_date_start
        ON appointment_slots (doctor_id, appointment_date, start_time)
        WHERE status = 'booked' AND deleted_at IS NULL
    """,
    """
    ALTER TABLE doctor_availability
        ADD COLUMN IF NOT EXISTS slot_duration_minutes INTEGER NOT NULL DEFAULT 30
    """,
    """
    ALTER TABLE doctor_availability
        ADD COLUMN IF NOT EXISTS break_times JSONB NOT NULL DEFAULT '[]'::jsonb
    """,
    """
    ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES appointment_slots(id) ON DELETE SET NULL
    """,
    """
    ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS rescheduled_from_id UUID REFERENCES appointments(id) ON DELETE SET NULL
    """,
    """
    ALTER TABLE appointments
        ADD COLUMN IF NOT EXISTS appointment_date DATE
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_appointments_doctor_appt_date
        ON appointments (doctor_id, appointment_date)
    """,
    """
    ALTER TABLE notifications
        ADD COLUMN IF NOT EXISTS metadata_json JSONB
    """,
    """
    DO $$ BEGIN
        ALTER TYPE appointmentstatus ADD VALUE IF NOT EXISTS 'rescheduled';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    """
    DO $$ BEGIN
        ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'appointment_booked';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    """
    DO $$ BEGIN
        ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'appointment_cancelled';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
    """
    DO $$ BEGIN
        ALTER TYPE notificationtype ADD VALUE IF NOT EXISTS 'appointment_rescheduled';
    EXCEPTION WHEN duplicate_object THEN NULL;
    END $$
    """,
]


async def migrate():
    async with engine.begin() as conn:
        for stmt in STATEMENTS:
            await conn.execute(text(stmt.strip()))
    print("Scheduling migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(migrate())
