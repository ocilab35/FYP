"""Health risk scoring engine using patient data + Qwen analysis."""

from __future__ import annotations

import json
import logging

from app.ai.json_utils import extract_json_object
from app.ai.prompts.system import MEDICAL_DISCLAIMER, SAFETY_SYSTEM_RULES
from app.ai.qwen_client import QwenAPIError, qwen_client
from app.core.config import settings

logger = logging.getLogger(__name__)


def _fallback_health_risk(patient_context: dict) -> dict:
    score = 25
    factors: list[str] = []
    if patient_context.get("chronic_conditions"):
        score += 20
        factors.append("Chronic conditions on record")
    if patient_context.get("allergies"):
        score += 5
        factors.append("Documented allergies")
    meds = patient_context.get("current_medications") or []
    if len(meds) >= 3:
        score += 15
        factors.append("Multiple active medications")
    if len(meds) >= 6:
        score += 10
        factors.append("Polypharmacy risk")

    age = (patient_context.get("demographics") or {}).get("age")
    if age and age >= 60:
        score += 10
        factors.append("Age 60+")

    score = min(score, 95)
    category = "low" if score < 35 else "medium" if score < 65 else "high"
    return {
        "risk_score": score,
        "risk_category": category,
        "explanation": "; ".join(factors) if factors else "No major risk factors identified from available records.",
        "recommendations": [
            "Keep medications and allergies updated",
            "Schedule routine check-ups",
            "Consult a doctor if new symptoms appear",
        ],
        "factors": factors,
        "disclaimer": MEDICAL_DISCLAIMER,
    }


async def calculate_health_risk(patient_context: dict, symptoms: list[str] | None = None) -> dict:
    if not settings.qwen_enabled:
        return _fallback_health_risk(patient_context)

    prompt = f"""{SAFETY_SYSTEM_RULES}

Analyze this patient's health risk holistically.

PATIENT CONTEXT:
{json.dumps(patient_context, default=str)[:6000]}

CURRENT SYMPTOMS (if any): {json.dumps(symptoms or [])}

Return JSON:
{{
  "risk_score": 0-100,
  "risk_category": "low|medium|high",
  "explanation": "string",
  "recommendations": ["string"],
  "factors": ["string"],
  "disclaimer": "{MEDICAL_DISCLAIMER}"
}}
"""
    try:
        raw = await qwen_client.chat_completion(
            [{"role": "system", "content": prompt}],
            temperature=0.2,
        )
        data = extract_json_object(raw)
        if not data.get("risk_score"):
            return _fallback_health_risk(patient_context)
        data["risk_score"] = max(0, min(100, int(data["risk_score"])))
        data.setdefault("disclaimer", MEDICAL_DISCLAIMER)
        return data
    except QwenAPIError as exc:
        logger.warning("Health risk Qwen failed: %s", exc)
        return _fallback_health_risk(patient_context)
