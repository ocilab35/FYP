from datetime import datetime, timezone
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_client_ip, get_current_user, hash_token, log_audit
from app.core.enums import DoctorApprovalStatus, UserRole
from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_password_hash,
    verify_password,
)
from app.db.session import get_db
from app.models import Doctor, DoctorExpertise, Patient, RefreshToken, User
from app.schemas import (
    APIResponse,
    DoctorRegister,
    LoginRequest,
    PatientRegister,
    RefreshRequest,
    TokenResponse,
    UserResponse,
)
from app.services.user_service import check_duplicate_user, get_user_by_email

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register/patient", response_model=APIResponse[UserResponse], status_code=201)
async def register_patient(
    data: PatientRegister,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    is_dup, msg = await check_duplicate_user(db, data.email, data.phone, data.cnic)
    if is_dup:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)

    user = User(
        email=data.email.lower(),
        phone=data.phone,
        cnic=data.cnic,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=UserRole.PATIENT,
        is_verified=True,
    )
    db.add(user)
    await db.flush()

    patient = Patient(
        user_id=user.id,
        date_of_birth=data.date_of_birth.date() if data.date_of_birth else None,
        gender=data.gender,
        blood_group=data.blood_group,
    )
    db.add(patient)
    await db.flush()
    from app.services.emr_service import ensure_patient_mrn

    await ensure_patient_mrn(db, patient)
    await log_audit(db, "register", "user", user.id, str(user.id), get_client_ip(request), user=user)
    return APIResponse(message="Patient registered successfully", data=UserResponse.model_validate(user))


@router.post("/register/doctor", response_model=APIResponse[UserResponse], status_code=201)
async def register_doctor(
    data: DoctorRegister,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    is_dup, msg = await check_duplicate_user(db, data.email, data.phone, data.cnic)
    if is_dup:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=msg)

    existing_license = await db.execute(
        select(Doctor).where(Doctor.license_number == data.license_number, Doctor.deleted_at.is_(None))
    )
    if existing_license.scalar_one_or_none():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="License number already registered")

    user = User(
        email=data.email.lower(),
        phone=data.phone,
        cnic=data.cnic,
        password_hash=get_password_hash(data.password),
        first_name=data.first_name,
        last_name=data.last_name,
        role=UserRole.DOCTOR,
    )
    db.add(user)
    await db.flush()

    doctor = Doctor(
        user_id=user.id,
        license_number=data.license_number,
        specialization=data.specialization,
        qualifications=data.qualifications,
        experience_years=data.experience_years,
        bio=data.bio,
        consultation_fee=data.consultation_fee,
        hospital_affiliation=data.hospital_affiliation,
        approval_status=DoctorApprovalStatus.PENDING,
    )
    db.add(doctor)
    await db.flush()

    for tag in data.expertise_tags:
        db.add(DoctorExpertise(doctor_id=doctor.id, tag=tag.strip()))

    await log_audit(db, "register", "user", user.id, str(user.id), get_client_ip(request), user=user)
    return APIResponse(
        message="Doctor registered successfully. Awaiting admin approval.",
        data=UserResponse.model_validate(user),
    )


@router.post("/login", response_model=APIResponse[TokenResponse])
async def login(data: LoginRequest, request: Request, db: AsyncSession = Depends(get_db)):
    user = await get_user_by_email(db, data.email.lower())
    if not user or not verify_password(data.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")

    if not user.is_active:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is deactivated")

    if user.role == UserRole.DOCTOR and user.doctor:
        if user.doctor.approval_status == DoctorApprovalStatus.PENDING:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor account pending approval")
        if user.doctor.approval_status == DoctorApprovalStatus.REJECTED:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Doctor account was rejected")

    user.last_login_at = datetime.now(timezone.utc)
    token_data = {"sub": str(user.id), "role": user.role.value}
    access = create_access_token(token_data)
    refresh = create_refresh_token(token_data)

    refresh_record = RefreshToken(
        user_id=user.id,
        token_hash=hash_token(refresh),
        expires_at=datetime.fromtimestamp(decode_token(refresh)["exp"], tz=timezone.utc),
    )
    db.add(refresh_record)
    await log_audit(db, "login", "user", user.id, str(user.id), get_client_ip(request), user=user)

    return APIResponse(
        data=TokenResponse(access_token=access, refresh_token=refresh),
        message="Login successful",
    )


@router.post("/refresh", response_model=APIResponse[TokenResponse])
async def refresh_token(data: RefreshRequest, db: AsyncSession = Depends(get_db)):
    payload = decode_token(data.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")

    token_hash = hash_token(data.refresh_token)
    result = await db.execute(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked.is_(False),
        )
    )
    stored = result.scalar_one_or_none()
    if not stored or stored.expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Refresh token expired or revoked")

    stored.revoked = True
    user_id = payload["sub"]
    token_data = {"sub": user_id, "role": payload.get("role")}
    new_access = create_access_token(token_data)
    new_refresh = create_refresh_token(token_data)

    db.add(
        RefreshToken(
            user_id=UUID(user_id),
            token_hash=hash_token(new_refresh),
            expires_at=datetime.fromtimestamp(decode_token(new_refresh)["exp"], tz=timezone.utc),
        )
    )
    return APIResponse(data=TokenResponse(access_token=new_access, refresh_token=new_refresh))


@router.get("/me", response_model=APIResponse[UserResponse])
async def get_me(user: User = Depends(get_current_user)):
    return APIResponse(data=UserResponse.model_validate(user))
