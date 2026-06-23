from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_patient, require_ai_subscription, require_ai_subscription
from app.core.enums import RiskLevel
from app.db.session import get_db
from app.models import AIConsultation, Patient, User
from app.schemas import (
    AIChatRequest,
    AIChatResponse,
    AIConsultationRequest,
    AIConsultationResponse,
    AIInsightsResponse,
    APIResponse,
    DrugInteractionResponse,
    HealthRiskResponse,
)
from app.services.ai_doctor_chat_service import process_ai_doctor_message
from app.services.ai_doctor_service import analyze_symptoms
from app.services.drug_interaction_service import analyze_drug_interactions
from app.services.health_risk_service import calculate_health_risk
from app.services.patient_context_service import build_patient_ai_context

router = APIRouter(prefix="/ai-doctor", tags=["AI Doctor"])


def _normalize_risk(value) -> RiskLevel:
    if isinstance(value, RiskLevel):
        return value
    mapping = {
        "low": RiskLevel.LOW,
        "moderate": RiskLevel.MODERATE,
        "medium": RiskLevel.MODERATE,
        "high": RiskLevel.HIGH,
        "critical": RiskLevel.CRITICAL,
    }
    return mapping.get(str(value).lower(), RiskLevel.LOW)


@router.post("/chat", response_model=APIResponse[AIChatResponse], status_code=201)
async def ai_doctor_chat(
    data: AIChatRequest,
    _: User = Depends(require_ai_subscription),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    patient_context = await build_patient_ai_context(db, patient)

    consultation: AIConsultation | None = None
    if data.session_id:
        result = await db.execute(
            select(AIConsultation).where(
                AIConsultation.id == data.session_id,
                AIConsultation.patient_id == patient.id,
                AIConsultation.deleted_at.is_(None),
            )
        )
        consultation = result.scalar_one_or_none()
        if not consultation:
            raise HTTPException(status_code=404, detail="AI session not found")

    conversation = list(consultation.conversation) if consultation else []
    ai_result = await process_ai_doctor_message(data.message, conversation, patient_context)

    conversation.append({"role": "user", "content": data.message})
    conversation.append({"role": "assistant", "content": ai_result["reply"]})

    assessment = ai_result.get("assessment")
    if consultation:
        consultation.conversation = conversation
        consultation.summary = ai_result["reply"]
        if assessment:
            consultation.predicted_conditions = assessment.get("predicted_conditions", [])
            consultation.recommendations = assessment.get("recommendations", [])
            consultation.recommended_specialists = assessment.get("recommended_specialists", [])
            consultation.risk_level = _normalize_risk(assessment.get("risk_level", "low"))
            consultation.summary = assessment.get("summary") or ai_result["reply"]
    else:
        symptoms = [data.message]
        consultation = AIConsultation(
            patient_id=patient.id,
            symptoms=symptoms,
            predicted_conditions=assessment.get("predicted_conditions", []) if assessment else [],
            recommendations=assessment.get("recommendations", []) if assessment else [],
            recommended_specialists=assessment.get("recommended_specialists", []) if assessment else [],
            risk_level=_normalize_risk(assessment.get("risk_level", "low")) if assessment else RiskLevel.LOW,
            summary=assessment.get("summary", ai_result["reply"]) if assessment else ai_result["reply"],
            conversation=conversation,
        )
        db.add(consultation)

    await db.flush()

    return APIResponse(
        data=AIChatResponse(
            session_id=consultation.id,
            reply=ai_result["reply"],
            follow_up_questions=ai_result.get("follow_up_questions") or [],
            is_complete=bool(ai_result.get("is_complete")),
            is_emergency=bool(ai_result.get("is_emergency")),
            disclaimer=ai_result.get("disclaimer", ""),
            assessment=assessment,
            conversation=conversation,
        )
    )


@router.post("/consult", response_model=APIResponse[AIConsultationResponse], status_code=201)
async def ai_consultation(
    data: AIConsultationRequest,
    _: User = Depends(require_ai_subscription),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    """Legacy one-shot symptom analysis — preserved for backward compatibility."""
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


@router.get("/sessions/{session_id}", response_model=APIResponse[AIConsultationResponse])
async def get_ai_session(
    session_id: UUID,
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    result = await db.execute(
        select(AIConsultation).where(
            AIConsultation.id == session_id,
            AIConsultation.patient_id == patient.id,
            AIConsultation.deleted_at.is_(None),
        )
    )
    consultation = result.scalar_one_or_none()
    if not consultation:
        raise HTTPException(status_code=404, detail="AI session not found")
    return APIResponse(data=AIConsultationResponse.model_validate(consultation))


@router.get("/health-risk", response_model=APIResponse[HealthRiskResponse])
async def get_health_risk(
    _: User = Depends(require_ai_subscription),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    context = await build_patient_ai_context(db, patient)
    risk = await calculate_health_risk(context)
    return APIResponse(data=HealthRiskResponse.model_validate(risk))


@router.get("/medication-alerts", response_model=APIResponse[DrugInteractionResponse])
async def get_medication_alerts(
    _: User = Depends(require_ai_subscription),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    context = await build_patient_ai_context(db, patient)
    result = await analyze_drug_interactions(
        context.get("current_medications") or [],
        patient.allergies,
        patient.chronic_conditions,
    )
    return APIResponse(data=DrugInteractionResponse.model_validate(result))


@router.get("/insights", response_model=APIResponse[AIInsightsResponse])
async def get_ai_insights(
    _: User = Depends(require_ai_subscription),
    patient_ctx: tuple[User, Patient] = Depends(get_current_patient),
    db: AsyncSession = Depends(get_db),
):
    _, patient = patient_ctx
    context = await build_patient_ai_context(db, patient)
    health_risk = await calculate_health_risk(context)
    med_alerts = await analyze_drug_interactions(
        context.get("current_medications") or [],
        patient.allergies,
        patient.chronic_conditions,
    )

    chronic_monitoring = []
    if patient.chronic_conditions:
        chronic_monitoring.append(f"Monitor: {patient.chronic_conditions}")

    recommendations = list(health_risk.get("recommendations") or [])
    if med_alerts.get("alerts"):
        recommendations.append("Review medication alerts with your doctor")

    return APIResponse(
        data=AIInsightsResponse(
            health_risk=HealthRiskResponse.model_validate(health_risk),
            medication_alerts=DrugInteractionResponse.model_validate(med_alerts),
            recommendations=recommendations,
            chronic_monitoring=chronic_monitoring,
        )
    )
