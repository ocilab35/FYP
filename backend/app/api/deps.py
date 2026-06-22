import hashlib
from datetime import datetime, timezone
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.enums import UserRole
from app.core.security import decode_token
from app.db.session import get_db
from app.models import Doctor, Patient, User

security = HTTPBearer(auto_error=False)


async def get_current_user(
    credentials: HTTPAuthorizationCredentials | None = Depends(security),
    db: AsyncSession = Depends(get_db),
) -> User:
    if not credentials:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")

    payload = decode_token(credentials.credentials)
    if not payload or payload.get("type") != "access":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")

    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token payload")

    result = await db.execute(
        select(User)
        .options(
            selectinload(User.patient),
            selectinload(User.doctor).selectinload(Doctor.expertise_tags),
        )
        .where(User.id == UUID(user_id), User.deleted_at.is_(None))
    )
    user = result.scalar_one_or_none()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="User not found or inactive")
    return user


def require_roles(*roles: UserRole):
    async def role_checker(user: User = Depends(get_current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient permissions")
        return user

    return role_checker


async def get_current_patient(user: User = Depends(require_roles(UserRole.PATIENT))) -> tuple[User, Patient]:
    if not user.patient:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Patient profile not found")
    return user, user.patient


async def get_current_doctor(user: User = Depends(require_roles(UserRole.DOCTOR))) -> tuple[User, Doctor]:
    if not user.doctor:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Doctor profile not found")
    return user, user.doctor


def hash_token(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


async def log_audit(
    db: AsyncSession,
    action: str,
    resource_type: str,
    user_id: UUID | None = None,
    resource_id: str | None = None,
    ip_address: str | None = None,
    details: dict | None = None,
    user: User | None = None,
) -> None:
    from app.models import AuditLog
    from app.services.audit_blockchain_service import audit_blockchain_service

    log = AuditLog(
        user_id=user_id,
        action=action,
        resource_type=resource_type,
        resource_id=resource_id,
        ip_address=ip_address,
        details=details,
    )
    db.add(log)
    await db.flush()

    if user is None and user_id:
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalar_one_or_none()

    try:
        await audit_blockchain_service.mirror_audit_log(db, log, user)
    except Exception:
        pass  # Audit DB write succeeds even if chain mirror fails


def get_client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else None
