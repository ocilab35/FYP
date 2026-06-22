import asyncio
from datetime import date, time

from sqlalchemy import select

from app.core.enums import DoctorApprovalStatus, UserRole
from app.core.security import get_password_hash
from app.db.session import AsyncSessionLocal, engine
from app.models import Doctor, DoctorAvailability, DoctorExpertise, Patient, User
from app.core.database import Base


async def seed_doctor_schedule(db, doctor_id):
    existing = await db.execute(
        select(DoctorAvailability).where(DoctorAvailability.doctor_id == doctor_id).limit(1)
    )
    if existing.scalar_one_or_none():
        return
    for day in range(0, 5):
        db.add(
            DoctorAvailability(
                doctor_id=doctor_id,
                day_of_week=day,
                start_time=time(9, 0),
                end_time=time(17, 0),
                slot_duration_minutes=30,
                break_times=[{"start_time": "12:00", "end_time": "13:00"}],
                is_available=True,
            )
        )


async def seed():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        admin_exists = await db.execute(
            select(User).where(User.email == "admin@vhms.com")
        )
        if not admin_exists.scalar_one_or_none():
            admin = User(
                email="admin@vhms.com",
                phone="03001234567",
                cnic="42101-1234567-1",
                password_hash=get_password_hash("Admin@123"),
                first_name="System",
                last_name="Admin",
                role=UserRole.ADMIN,
                is_active=True,
                is_verified=True,
            )
            db.add(admin)

        doc_exists = await db.execute(
            select(User).where(User.email == "doctor@vhms.com")
        )
        if not doc_exists.scalar_one_or_none():
            doc_user = User(
                email="doctor@vhms.com",
                phone="03001234568",
                cnic="42101-1234567-2",
                password_hash=get_password_hash("Doctor@123"),
                first_name="Sarah",
                last_name="Ahmed",
                role=UserRole.DOCTOR,
                is_active=True,
                is_verified=True,
            )
            db.add(doc_user)
            await db.flush()
            doctor = Doctor(
                user_id=doc_user.id,
                license_number="PMC-2024-001",
                specialization="Cardiology",
                qualifications="MBBS, FCPS (Cardiology)",
                experience_years=12,
                bio="Experienced cardiologist specializing in preventive heart care.",
                consultation_fee=3000.0,
                approval_status=DoctorApprovalStatus.APPROVED,
                hospital_affiliation="Aga Khan University Hospital",
                rating=4.8,
                total_reviews=156,
            )
            db.add(doctor)
            await db.flush()
            for tag in ["Heart Disease", "Hypertension", "ECG", "Preventive Cardiology"]:
                db.add(DoctorExpertise(doctor_id=doctor.id, tag=tag))
            await seed_doctor_schedule(db, doctor.id)

            doc2_user = User(
                email="dr.khan@vhms.com",
                phone="03001234569",
                cnic="42101-1234567-3",
                password_hash=get_password_hash("Doctor@123"),
                first_name="Imran",
                last_name="Khan",
                role=UserRole.DOCTOR,
                is_active=True,
                is_verified=True,
            )
            db.add(doc2_user)
            await db.flush()
            doctor2 = Doctor(
                user_id=doc2_user.id,
                license_number="PMC-2024-002",
                specialization="General Physician",
                qualifications="MBBS, MD (Internal Medicine)",
                experience_years=8,
                bio="General physician with expertise in primary care and chronic disease management.",
                consultation_fee=2000.0,
                approval_status=DoctorApprovalStatus.APPROVED,
                hospital_affiliation="Shifa International Hospital",
                rating=4.6,
                total_reviews=89,
            )
            db.add(doctor2)
            await db.flush()
            for tag in ["Primary Care", "Diabetes", "Hypertension", "General Medicine"]:
                db.add(DoctorExpertise(doctor_id=doctor2.id, tag=tag))
            await seed_doctor_schedule(db, doctor2.id)

        patient_exists = await db.execute(
            select(User).where(User.email == "patient@vhms.com")
        )
        if not patient_exists.scalar_one_or_none():
            pat_user = User(
                email="patient@vhms.com",
                phone="03001234570",
                cnic="42101-1234567-4",
                password_hash=get_password_hash("Patient@123"),
                first_name="Ali",
                last_name="Hassan",
                role=UserRole.PATIENT,
                is_active=True,
                is_verified=True,
            )
            db.add(pat_user)
            await db.flush()
            db.add(
                Patient(
                    user_id=pat_user.id,
                    date_of_birth=date(1995, 6, 15),
                    gender="Male",
                    blood_group="B+",
                    address="Karachi, Pakistan",
                )
            )

        doctors_result = await db.execute(
            select(Doctor).where(Doctor.deleted_at.is_(None), Doctor.approval_status == DoctorApprovalStatus.APPROVED)
        )
        for doc in doctors_result.scalars().all():
            await seed_doctor_schedule(db, doc.id)

        await db.commit()
        print("Database seeded successfully!")


if __name__ == "__main__":
    asyncio.run(seed())
