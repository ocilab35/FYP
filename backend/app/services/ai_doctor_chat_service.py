"""Conversational AI Doctor powered by Qwen with clinical questioning."""

from __future__ import annotations

import json
import logging
from typing import Any

from app.ai.json_utils import extract_json_object
from app.ai.prompts.system import MEDICAL_DISCLAIMER, SAFETY_SYSTEM_RULES
from app.ai.qwen_client import QwenAPIError, qwen_client
from app.core.config import settings
from app.core.enums import RiskLevel
from app.services.ai_doctor_service import analyze_symptoms

logger = logging.getLogger(__name__)

EMERGENCY_KEYWORDS = (
    "chest pain",
    "difficulty breathing",
    "can't breathe",
    "cannot breathe",
    "loss of consciousness",
    "unconscious",
    "severe bleeding",
    "stroke",
    "heart attack",
)


def _detect_emergency(text: str) -> bool:
    lower = text.lower()
    return any(k in lower for k in EMERGENCY_KEYWORDS)


def _normalize_risk(value: str | None) -> RiskLevel:
    mapping = {
        "low": RiskLevel.LOW,
        "moderate": RiskLevel.MODERATE,
        "medium": RiskLevel.MODERATE,
        "high": RiskLevel.HIGH,
        "critical": RiskLevel.CRITICAL,
    }
    return mapping.get((value or "low").lower(), RiskLevel.LOW)


def _fallback_gathering_reply(message: str, conversation: list[dict]) -> dict:
    """Rule-based fallback when Qwen is unavailable."""
    emergency = _detect_emergency(message)
    if emergency:
        return {
            "reply": (
                "Your symptoms may require urgent medical attention. "
                "Please seek emergency care immediately or call your local emergency number."
            ),
            "follow_up_questions": [],
            "is_complete": True,
            "is_emergency": True,
            "disclaimer": MEDICAL_DISCLAIMER,
            "assessment": {
                "predicted_conditions": [{"name": "Possible emergency condition", "probability": 0.9}],
                "recommendations": ["Seek emergency medical care immediately"],
                "recommended_specialists": ["Emergency Medicine"],
                "risk_level": RiskLevel.CRITICAL.value,
                "summary": "Emergency symptoms detected. Do not rely on AI — get immediate medical help.",
                "health_risk_score": 95,
            },
        }

    turn_count = sum(1 for m in conversation if m.get("role") == "user")
    if turn_count < 3:
        questions = [
            "When did your symptoms start?",
            "How severe are they on a scale of 1–10?",
            "Do you have fever, nausea, or vomiting?",
            "Are you taking any medicines currently?",
            "Do you have any chronic conditions or allergies?",
        ]
        asked = min(turn_count, len(questions) - 1)
        return {
            "reply": (
                "Thank you for sharing. To understand your situation better, I need a few more details "
                "before providing guidance."
            ),
            "follow_up_questions": [questions[asked]],
            "is_complete": False,
            "is_emergency": False,
            "disclaimer": MEDICAL_DISCLAIMER,
            "assessment": None,
        }

    symptoms = [message]
    for msg in conversation:
        if msg.get("role") == "user":
            symptoms.append(msg.get("content", ""))
    analysis = analyze_symptoms(symptoms[:5])
    return {
        "reply": analysis["summary"],
        "follow_up_questions": [],
        "is_complete": True,
        "is_emergency": False,
        "disclaimer": MEDICAL_DISCLAIMER,
        "assessment": {
            **analysis,
            "risk_level": analysis["risk_level"].value if hasattr(analysis["risk_level"], "value") else analysis["risk_level"],
            "health_risk_score": _risk_to_score(analysis["risk_level"]),
        },
    }


def _risk_to_score(risk: RiskLevel | str) -> int:
    val = risk.value if hasattr(risk, "value") else str(risk)
    return {"low": 20, "moderate": 45, "high": 75, "critical": 92}.get(val.lower(), 30)


def _build_chat_system_prompt(patient_context: dict) -> str:
    return f"""{SAFETY_SYSTEM_RULES}

PATIENT CONTEXT (use for personalization):
{json.dumps(patient_context, default=str)[:6000]}

CONVERSATION MODE:
- Phase 1 (gathering): Ask 1-3 focused clinical follow-up questions. Do NOT give diagnosis yet.
- Phase 2 (assessment): Only when you have enough context, provide preliminary assessment.

Return JSON with this schema:
{{
  "reply": "string — message to patient",
  "follow_up_questions": ["string"],
  "is_complete": false,
  "is_emergency": false,
  "assessment": null OR {{
    "predicted_conditions": [{{"name": "string", "probability": 0.0-1.0}}],
    "recommendations": ["string"],
    "recommended_specialists": ["string"],
    "risk_level": "low|moderate|high|critical",
    "summary": "string",
    "health_risk_score": 0-100
  }},
  "disclaimer": "{MEDICAL_DISCLAIMER}"
}}

If patient mentions emergency symptoms, set is_emergency=true and urge emergency care.
If insufficient information, is_complete=false and ask follow-up questions.
"""


async def process_ai_doctor_message(
    message: str,
    conversation: list[dict[str, str]],
    patient_context: dict,
) -> dict[str, Any]:
    if _detect_emergency(message):
        fb = _fallback_gathering_reply(message, conversation)
        return fb

    if not settings.qwen_enabled:
        return _fallback_gathering_reply(message, conversation)

    messages: list[dict[str, str]] = [
        {"role": "system", "content": _build_chat_system_prompt(patient_context)},
    ]
    for turn in conversation[-20:]:
        role = turn.get("role", "user")
        if role in ("user", "assistant"):
            messages.append({"role": role, "content": str(turn.get("content", ""))[:2000]})
    messages.append({"role": "user", "content": message[:2000]})

    try:
        raw = await qwen_client.chat_completion(messages, json_mode=True)
        data = extract_json_object(raw)
        if not data.get("reply"):
            raise QwenAPIError("Invalid AI response structure")

        assessment = data.get("assessment")
        if assessment and assessment.get("risk_level"):
            assessment["risk_level"] = _normalize_risk(assessment["risk_level"]).value

        return {
            "reply": data.get("reply", ""),
            "follow_up_questions": data.get("follow_up_questions") or [],
            "is_complete": bool(data.get("is_complete")),
            "is_emergency": bool(data.get("is_emergency")),
            "disclaimer": data.get("disclaimer") or MEDICAL_DISCLAIMER,
            "assessment": assessment,
        }
    except QwenAPIError as exc:
        logger.warning("Qwen chat failed, using fallback: %s", exc)
        return _fallback_gathering_reply(message, conversation)
