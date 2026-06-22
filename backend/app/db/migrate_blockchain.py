"""Add blockchain verification columns to medical_records, prescriptions, audit_logs."""

import asyncio

from sqlalchemy import text

from app.db.session import engine


SQL = """
ALTER TABLE medical_records
  ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(100),
  ADD COLUMN IF NOT EXISTS blockchain_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS blockchain_verified_at TIMESTAMPTZ;

ALTER TABLE prescriptions
  ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(100),
  ADD COLUMN IF NOT EXISTS blockchain_hash VARCHAR(64),
  ADD COLUMN IF NOT EXISTS verification_status VARCHAR(20) DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS blockchain_verified_at TIMESTAMPTZ;

ALTER TABLE audit_logs
  ADD COLUMN IF NOT EXISTS user_role VARCHAR(20),
  ADD COLUMN IF NOT EXISTS blockchain_tx_hash VARCHAR(100),
  ADD COLUMN IF NOT EXISTS blockchain_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS ix_medical_records_verification ON medical_records (verification_status);
CREATE INDEX IF NOT EXISTS ix_prescriptions_verification ON prescriptions (verification_status);
CREATE INDEX IF NOT EXISTS ix_audit_logs_blockchain ON audit_logs (blockchain_tx_hash);
"""


async def migrate():
    async with engine.begin() as conn:
        for stmt in SQL.strip().split(";"):
            s = stmt.strip()
            if s:
                await conn.execute(text(s))
    print("Blockchain columns migration complete.")


if __name__ == "__main__":
    asyncio.run(migrate())
