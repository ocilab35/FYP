"""Normalize legacy uppercase notification enum labels to lowercase values."""

import asyncio

from sqlalchemy import text

from app.db.session import engine

STATEMENTS = [
    """
    UPDATE notifications SET notification_type = 'appointment'::notificationtype
    WHERE notification_type::text IN ('APPOINTMENT', 'appointment')
    AND notification_type::text != 'appointment'
    """,
    """
    UPDATE notifications SET notification_type = 'prescription'::notificationtype
    WHERE notification_type::text IN ('PRESCRIPTION', 'prescription')
    AND notification_type::text != 'prescription'
    """,
    """
    UPDATE notifications SET notification_type = 'system'::notificationtype
    WHERE notification_type::text IN ('SYSTEM', 'system')
    AND notification_type::text != 'system'
    """,
]


async def run():
    for stmt in STATEMENTS:
        try:
            async with engine.begin() as conn:
                await conn.execute(text(stmt.strip()))
        except Exception as exc:
            print(f"Skipped (may already ok): {exc}")
    print("Notification enum normalization completed!")


if __name__ == "__main__":
    asyncio.run(run())
