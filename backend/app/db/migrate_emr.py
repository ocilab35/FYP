"""EMR schema migration — medications, consultation_notes, MRN, file metadata."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

STATEMENTS = [
    """
    ALTER TABLE patients ADD COLUMN IF NOT EXISTS mrn VARCHAR(20)
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS ix_patients_mrn ON patients (mrn) WHERE mrn IS NOT NULL
    """,
    """
    ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS file_name VARCHAR(255)
    """,
    """
    ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS file_size INTEGER
    """,
    """
    ALTER TABLE medical_records ADD COLUMN IF NOT EXISTS mime_type VARCHAR(100)
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_medical_records_patient_type
        ON medical_records (patient_id, record_type)
    """,
    """
    CREATE TABLE IF NOT EXISTS medications (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        medicine_name VARCHAR(200) NOT NULL,
        dosage VARCHAR(100),
        frequency VARCHAR(100),
        duration VARCHAR(100),
        notes TEXT,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        deleted_at TIMESTAMPTZ
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_medications_patient_active
        ON medications (patient_id, deleted_at)
    """,
    """
    CREATE TABLE IF NOT EXISTS consultation_notes (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        appointment_id UUID NOT NULL UNIQUE REFERENCES appointments(id) ON DELETE CASCADE,
        doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
        patient_id UUID NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
        symptoms TEXT,
        diagnosis TEXT,
        treatment_plan TEXT,
        follow_up_notes TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE UNIQUE INDEX IF NOT EXISTS ix_consultation_notes_appointment
        ON consultation_notes (appointment_id)
    """,
    """
    UPDATE patients p SET mrn = sub.new_mrn
    FROM (
        SELECT id, 'MRN-2026-' || LPAD(ROW_NUMBER() OVER (ORDER BY created_at)::text, 6, '0') AS new_mrn
        FROM patients WHERE mrn IS NULL
    ) sub WHERE p.id = sub.id
    """,
]


async def run():
    async with engine.begin() as conn:
        for stmt in STATEMENTS:
            await conn.execute(text(stmt.strip()))
    print("EMR migration completed successfully!")


if __name__ == "__main__":
    asyncio.run(run())
