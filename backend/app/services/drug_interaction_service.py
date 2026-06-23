"""Drug interaction and allergy conflict detection."""

from __future__ import annotations

import json
import logging

from app.ai.json_utils import extract_json_object
from app.ai.prompts.system import MEDICAL_DISCLAIMER, SAFETY_SYSTEM_RULES
from app.ai.qwen_client import QwenAPIError, qwen_client
from app.core.config import settings

logger = logging.getLogger(__name__)


def _fallback_interactions(
    medications: list[dict],
    allergies: str | None,
    new_medications: list[dict] | None = None,
) -> dict:
    alerts: list[dict] = []
    names = {m.get("medicine_name", "").lower() for m in medications if m.get("medicine_name")}
    new_names = {m.get("medicine_name", "").lower() for m in (new_medications or []) if m.get("medicine_name")}

    duplicates = names & new_names
    for dup in duplicates:
        if dup:
            alerts.append({
                "type": "duplicate",
                "medicines": [dup.title()],
                "risk_level": "medium",
                "explanation": f"{dup.title()} appears to already be in your medication list.",
                "suggested_action": "Confirm with your doctor before adding a duplicate.",
            })

    if allergies:
        allergy_lower = allergies.lower()
        for med in new_medications or []:
            name = (med.get("medicine_name") or "").lower()
            if name and name in allergy_lower:
                alerts.append({
                    "type": "allergy",
                    "medicines": [med.get("medicine_name")],
                    "risk_level": "high",
                    "explanation": f"Possible allergy conflict with documented allergies: {allergies}",
                    "suggested_action": "Do not take without consulting your doctor.",
                })

    overall = "low"
    if any(a["risk_level"] == "high" for a in alerts):
        overall = "high"
    elif alerts:
        overall = "medium"

    return {
        "overall_risk": overall,
        "alerts": alerts,
        "disclaimer": MEDICAL_DISCLAIMER,
    }


async def analyze_drug_interactions(
    medications: list[dict],
    allergies: str | None,
    chronic_conditions: str | None = None,
    new_medications: list[dict] | None = None,
) -> dict:
    if not medications and not new_medications:
        return {"overall_risk": "low", "alerts": [], "disclaimer": MEDICAL_DISCLAIMER}

    if not settings.qwen_enabled:
        return _fallback_interactions(medications, allergies, new_medications)

    prompt = f"""{SAFETY_SYSTEM_RULES}

Analyze medication safety for this patient.

CURRENT MEDICATIONS: {json.dumps(medications)[:3000]}
NEW/PROPOSED MEDICATIONS: {json.dumps(new_medications or [])[:2000]}
ALLERGIES: {allergies or "None documented"}
CHRONIC CONDITIONS: {chronic_conditions or "None documented"}

Detect: drug-drug interactions, duplicate medicines, allergy conflicts.
Return JSON:
{{
  "overall_risk": "low|medium|high",
  "alerts": [
    {{
      "type": "interaction|duplicate|allergy",
      "medicines": ["string"],
      "risk_level": "low|medium|high",
      "explanation": "string",
      "suggested_action": "string"
    }}
  ],
  "disclaimer": "{MEDICAL_DISCLAIMER}"
}}
"""
    try:
        raw = await qwen_client.chat_completion(
            [{"role": "system", "content": prompt}],
            temperature=0.1,
        )
        data = extract_json_object(raw)
        data.setdefault("alerts", [])
        data.setdefault("overall_risk", "low")
        data.setdefault("disclaimer", MEDICAL_DISCLAIMER)
        return data
    except QwenAPIError as exc:
        logger.warning("Drug interaction Qwen failed: %s", exc)
        return _fallback_interactions(medications, allergies, new_medications)
