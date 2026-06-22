"""Fix appointments where scheduled_at was stored as UTC wall-clock instead of hospital-local."""

import asyncio

from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.core.timezone_utils import combine_local_date_time
from app.db.session import AsyncSessionLocal
from app.models import Appointment, AppointmentSlot


async def migrate():
    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(Appointment)
            .options(selectinload(Appointment.slot))
            .where(Appointment.deleted_at.is_(None))
        )
        updated = 0
        for appt in result.scalars().all():
            target_date = appt.appointment_date
            start_time = None

            if appt.slot:
                target_date = target_date or appt.slot.appointment_date
                start_time = appt.slot.start_time
            elif target_date:
                start_time = appt.scheduled_at.time()

            if not target_date or not start_time:
                continue

            corrected = combine_local_date_time(target_date, start_time)
            if appt.scheduled_at != corrected:
                appt.scheduled_at = corrected
                updated += 1

        await db.commit()
        print(f"Updated {updated} appointment scheduled_at value(s).")


if __name__ == "__main__":
    asyncio.run(migrate())
