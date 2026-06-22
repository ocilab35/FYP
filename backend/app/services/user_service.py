from sqlalchemy import func, or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import UserRole
from app.models import User


async def check_duplicate_user(
    db: AsyncSession, email: str, phone: str, cnic: str
) -> tuple[bool, str | None]:
    result = await db.execute(
        select(User).where(
            User.deleted_at.is_(None),
            or_(User.email == email, User.phone == phone, User.cnic == cnic),
        )
    )
    existing = result.scalar_one_or_none()
    if not existing:
        return False, None
    if existing.email == email:
        return True, "Email already registered"
    if existing.phone == phone:
        return True, "Phone number already registered"
    if existing.cnic == cnic:
        return True, "CNIC already registered"
    return True, "Account already exists"


async def get_user_by_email(db: AsyncSession, email: str) -> User | None:
    result = await db.execute(
        select(User)
        .options(selectinload(User.doctor), selectinload(User.patient))
        .where(User.email == email, User.deleted_at.is_(None))
    )
    return result.scalar_one_or_none()


async def count_users_by_role(db: AsyncSession, role: UserRole) -> int:
    result = await db.execute(
        select(func.count()).select_from(User).where(
            User.role == role, User.deleted_at.is_(None)
        )
    )
    return result.scalar() or 0
