from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_patient
from app.db.session import get_db
from app.models import AIConsultation, Patient, User
from app.schemas import AIConsultationRequest, AIConsultationResponse, APIResponse
from app.services.ai_doctor_service import analyze_symptoms

router = APIRouter(prefix="/ai-doctor", tags=["AI Doctor"])


@router.post("/consult", response_model=APIResponse[AIConsultationResponse], status_code=201)
async def ai_consultation(
    data: AIConsultationRequest,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    analysis = analyze_symptoms(data.symptoms, data.additional_info)

    consultation = AIConsultation(
        patient_id=patient.id,
        symptoms=data.symptoms,
        predicted_conditions=analysis["predicted_conditions"],
        recommendations=analysis["recommendations"],
        recommended_specialists=analysis["recommended_specialists"],
        risk_level=analysis["risk_level"],
        summary=analysis["summary"],
        conversation=[
            {"role": "user", "content": f"Symptoms: {', '.join(data.symptoms)}"},
            {"role": "assistant", "content": analysis["summary"]},
        ],
    )
    db.add(consultation)
    await db.flush()
    return APIResponse(data=AIConsultationResponse.model_validate(consultation))


@router.get("/history", response_model=APIResponse[list[AIConsultationResponse]])
async def ai_consultation_history(
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    result = await db.execute(
        select(AIConsultation)
        .where(AIConsultation.patient_id == patient.id, AIConsultation.deleted_at.is_(None))
        .order_by(AIConsultation.created_at.desc())
        .limit(20)
    )
    return APIResponse(data=[AIConsultationResponse.model_validate(c) for c in result.scalars().all()])
