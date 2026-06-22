from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.api.deps import require_roles
from app.core.enums import DoctorApprovalStatus, UserRole
from app.db.session import get_db
from app.models import AIConsultation, Appointment, AuditLog, Doctor, Patient, User
from app.schemas import AdminStatsResponse, APIResponse, PaginatedResponse, UserResponse

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard", response_model=APIResponse[AdminStatsResponse])
async def admin_dashboard(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    total_users = (await db.execute(
        select(func.count()).select_from(User).where(User.deleted_at.is_(None))
    )).scalar() or 0
    total_patients = (await db.execute(
        select(func.count()).select_from(Patient).where(Patient.deleted_at.is_(None))
    )).scalar() or 0
    total_doctors = (await db.execute(
        select(func.count()).select_from(Doctor).where(Doctor.deleted_at.is_(None))
    )).scalar() or 0
    pending = (await db.execute(
        select(func.count()).select_from(Doctor).where(
            Doctor.approval_status == DoctorApprovalStatus.PENDING, Doctor.deleted_at.is_(None)
        )
    )).scalar() or 0
    total_appts = (await db.execute(
        select(func.count()).select_from(Appointment).where(Appointment.deleted_at.is_(None))
    )).scalar() or 0
    appts_today = (await db.execute(
        select(func.count()).select_from(Appointment).where(
            Appointment.scheduled_at >= today_start, Appointment.deleted_at.is_(None)
        )
    )).scalar() or 0
    ai_today = (await db.execute(
        select(func.count()).select_from(AIConsultation).where(
            AIConsultation.created_at >= today_start, AIConsultation.deleted_at.is_(None)
        )
    )).scalar() or 0
    active_today = (await db.execute(
        select(func.count()).select_from(User).where(User.last_login_at >= today_start)
    )).scalar() or 0

    return APIResponse(
        data=AdminStatsResponse(
            total_users=total_users,
            total_patients=total_patients,
            total_doctors=total_doctors,
            pending_doctor_approvals=pending,
            total_appointments=total_appts,
            appointments_today=appts_today,
            ai_consultations_today=ai_today,
            active_users_today=active_today,
        )
    )


@router.get("/users", response_model=APIResponse[PaginatedResponse[UserResponse]])
async def list_users(
    role: str | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    query = select(User).where(User.deleted_at.is_(None))
    if role:
        query = query.where(User.role == UserRole(role))
    query = query.order_by(User.created_at.desc())

    total = (await db.execute(select(func.count()).select_from(query.subquery()))).scalar() or 0
    result = await db.execute(query.offset((page - 1) * page_size).limit(page_size))
    users = result.scalars().all()

    return APIResponse(
        data=PaginatedResponse(
            items=[UserResponse.model_validate(u) for u in users],
            total=total,
            page=page,
            page_size=page_size,
            total_pages=max(1, (total + page_size - 1) // page_size),
        )
    )


@router.patch("/users/{user_id}/toggle-active")
async def toggle_user_active(
    user_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    result = await db.execute(select(User).where(User.id == user_id, User.deleted_at.is_(None)))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user.role == UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot deactivate admin accounts")
    user.is_active = not user.is_active
    return APIResponse(message=f"User {'activated' if user.is_active else 'deactivated'}")


@router.get("/doctors/pending", response_model=APIResponse[list[dict]])
async def pending_doctors(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    result = await db.execute(
        select(Doctor)
        .options(selectinload(Doctor.user), selectinload(Doctor.expertise_tags))
        .where(Doctor.approval_status == DoctorApprovalStatus.PENDING, Doctor.deleted_at.is_(None))
    )
    doctors = result.scalars().all()
    return APIResponse(
        data=[
            {
                "id": str(d.id),
                "user_id": str(d.user_id),
                "name": f"{d.user.first_name} {d.user.last_name}",
                "email": d.user.email,
                "specialization": d.specialization,
                "license_number": d.license_number,
                "experience_years": d.experience_years,
                "expertise_tags": [t.tag for t in d.expertise_tags],
            }
            for d in doctors
        ]
    )


@router.patch("/doctors/{doctor_id}/approve")
async def approve_doctor(
    doctor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    result = await db.execute(
        select(Doctor).options(selectinload(Doctor.user)).where(Doctor.id == doctor_id)
    )
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doctor.approval_status = DoctorApprovalStatus.APPROVED
    doctor.user.is_verified = True
    return APIResponse(message="Doctor approved")


@router.patch("/doctors/{doctor_id}/reject")
async def reject_doctor(
    doctor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    result = await db.execute(select(Doctor).where(Doctor.id == doctor_id))
    doctor = result.scalar_one_or_none()
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    doctor.approval_status = DoctorApprovalStatus.REJECTED
    return APIResponse(message="Doctor rejected")


@router.get("/appointments", response_model=APIResponse[list[dict]])
async def all_appointments(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    from app.schemas import AppointmentResponse

    result = await db.execute(
        select(Appointment).where(Appointment.deleted_at.is_(None)).order_by(Appointment.scheduled_at.desc()).limit(100)
    )
    return APIResponse(
        data=[AppointmentResponse.model_validate(a).model_dump() for a in result.scalars().all()]
    )


@router.get("/ai-activity", response_model=APIResponse[list[dict]])
async def ai_activity(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    result = await db.execute(
        select(AIConsultation).where(AIConsultation.deleted_at.is_(None)).order_by(AIConsultation.created_at.desc()).limit(50)
    )
    consultations = result.scalars().all()
    return APIResponse(
        data=[
            {
                "id": str(c.id),
                "patient_id": str(c.patient_id),
                "symptoms": c.symptoms,
                "risk_level": c.risk_level.value,
                "summary": c.summary[:200],
                "created_at": c.created_at.isoformat(),
            }
            for c in consultations
        ]
    )


@router.get("/audit-logs", response_model=APIResponse[list[dict]])
async def audit_logs(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_roles(UserRole.ADMIN)),
):
    result = await db.execute(
        select(AuditLog).order_by(AuditLog.created_at.desc()).limit(100)
    )
    logs = result.scalars().all()
    return APIResponse(
        data=[
            {
                "id": str(l.id),
                "action": l.action,
                "resource_type": l.resource_type,
                "user_id": str(l.user_id) if l.user_id else None,
                "ip_address": l.ip_address,
                "created_at": l.created_at.isoformat(),
            }
            for l in logs
        ]
    )
