"""Patient-friendly medical report summarization via Qwen."""

from __future__ import annotations

import json
import logging

from app.ai.json_utils import extract_json_object
from app.ai.prompts.system import MEDICAL_DISCLAIMER, SAFETY_SYSTEM_RULES
from app.ai.qwen_client import QwenAPIError, qwen_client
from app.core.config import settings

logger = logging.getLogger(__name__)


def _fallback_summary(title: str, description: str | None, record_type: str) -> dict:
    text = description or title
    return {
        "patient_summary": f"This {record_type.replace('_', ' ')} report ({title}) has been uploaded. Please review with your doctor for a full interpretation.",
        "key_findings": [text[:200]] if text else [],
        "possible_concerns": [],
        "follow_up_recommendations": ["Discuss this report with your healthcare provider"],
        "disclaimer": MEDICAL_DISCLAIMER,
    }


async def summarize_medical_report(
    *,
    title: str,
    record_type: str,
    description: str | None,
    extracted_text: str | None,
    patient_context: dict,
) -> dict:
    content = extracted_text or description or title
    if not content.strip():
        return _fallback_summary(title, description, record_type)

    if not settings.qwen_enabled:
        return _fallback_summary(title, description, record_type)

    prompt = f"""{SAFETY_SYSTEM_RULES}

Summarize this medical report for a patient in plain language.

REPORT TYPE: {record_type}
TITLE: {title}
DESCRIPTION: {description or "N/A"}
REPORT TEXT/CONTENT:
{content[:8000]}

PATIENT CONTEXT:
{json.dumps(patient_context.get("demographics", {}), default=str)}
Allergies: {patient_context.get("allergies")}
Chronic conditions: {patient_context.get("chronic_conditions")}

Return JSON:
{{
  "patient_summary": "plain language summary",
  "key_findings": ["string"],
  "possible_concerns": ["string"],
  "follow_up_recommendations": ["string"],
  "disclaimer": "{MEDICAL_DISCLAIMER}"
}}
"""
    try:
        raw = await qwen_client.chat_completion(
            [{"role": "system", "content": prompt}],
            temperature=0.2,
        )
        data = extract_json_object(raw)
        if not data.get("patient_summary"):
            return _fallback_summary(title, description, record_type)
        data.setdefault("disclaimer", MEDICAL_DISCLAIMER)
        return data
    except QwenAPIError as exc:
        logger.warning("Report summary Qwen failed: %s", exc)
        return _fallback_summary(title, description, record_type)
