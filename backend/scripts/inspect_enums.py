import asyncio

from sqlalchemy import text

from app.db.session import engine


async def main():
    async with engine.connect() as conn:
        for name in ["notificationtype", "userrole", "appointmentstatus", "slotstatus"]:
            r = await conn.execute(
                text(
                    f"SELECT enumlabel FROM pg_enum e JOIN pg_type t ON e.enumtypid=t.oid "
                    f"WHERE t.typname='{name}' ORDER BY 1"
                )
            )
            print(name, [row[0] for row in r])


asyncio.run(main())
