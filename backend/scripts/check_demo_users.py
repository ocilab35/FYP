import asyncio

from sqlalchemy import select, text
from sqlalchemy.orm import selectinload

from app.db.session import AsyncSessionLocal
from app.models import User, Doctor


async def main():
    async with AsyncSessionLocal() as db:
        for email in ["patient@vhms.com", "doctor@vhms.com", "admin@vhms.com"]:
            r = await db.execute(select(User).where(User.email == email))
            u = r.scalar_one_or_none()
            if u:
                raw = await db.execute(
                    text(
                        "SELECT u.role::text, d.approval_status::text "
                        "FROM users u LEFT JOIN doctors d ON d.user_id = u.id "
                        "WHERE u.email = :email"
                    ),
                    {"email": email},
                )
                raw_row = raw.fetchone()
                print(f"{email}: ORM role={u.role!r} ({u.role.name}) id={u.id} RAW={raw_row}")
            else:
                print(f"{email}: NOT FOUND")

        r = await db.execute(
            select(User)
            .options(selectinload(User.doctor))
            .where(User.email == "doctor@vhms.com")
        )
        r = await db.execute(
            text(
                "SELECT t.typname, e.enumlabel "
                "FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid "
                "WHERE t.typname IN ('userrole', 'doctorapprovalstatus') "
                "ORDER BY t.typname, e.enumsortorder"
            )
        )
        print("PG enum order:", r.fetchall())


if __name__ == "__main__":
    asyncio.run(main())
