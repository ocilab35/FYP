"""Auto-generate consultation summaries after visit completion."""

from __future__ import annotations

import json
import logging

from app.ai.json_utils import extract_json_object
from app.ai.prompts.system import MEDICAL_DISCLAIMER, SAFETY_SYSTEM_RULES
from app.ai.qwen_client import QwenAPIError, qwen_client
from app.core.config import settings

logger = logging.getLogger(__name__)


def _fallback_summary(note: dict | None, messages: list[dict]) -> dict:
    return {
        "chief_complaint": (note or {}).get("symptoms") or "Not documented",
        "symptoms": (note or {}).get("symptoms"),
        "discussion_summary": "Consultation completed. Review clinical notes for details.",
        "diagnosis": (note or {}).get("diagnosis"),
        "follow_up_plan": (note or {}).get("follow_up_notes") or (note or {}).get("treatment_plan"),
        "disclaimer": MEDICAL_DISCLAIMER,
    }


async def generate_consultation_summary(
    *,
    consultation_note: dict | None,
    chat_messages: list[dict],
    prescription: dict | None,
    patient_context: dict,
) -> dict:
    if not settings.qwen_enabled:
        return _fallback_summary(consultation_note, chat_messages)

    prompt = f"""{SAFETY_SYSTEM_RULES}

Generate a patient-friendly consultation summary.

CLINICAL NOTE: {json.dumps(consultation_note or {})[:3000]}
CHAT MESSAGES: {json.dumps(chat_messages[-30:])[:4000]}
PRESCRIPTION: {json.dumps(prescription or {})[:2000]}
PATIENT: {json.dumps(patient_context.get("demographics", {}), default=str)}

Return JSON:
{{
  "chief_complaint": "string",
  "symptoms": "string",
  "discussion_summary": "string",
  "diagnosis": "string",
  "follow_up_plan": "string",
  "disclaimer": "{MEDICAL_DISCLAIMER}"
}}
"""
    try:
        raw = await qwen_client.chat_completion(
            [{"role": "system", "content": prompt}],
            temperature=0.2,
        )
        data = extract_json_object(raw)
        if not data.get("discussion_summary"):
            return _fallback_summary(consultation_note, chat_messages)
        data.setdefault("disclaimer", MEDICAL_DISCLAIMER)
        return data
    except QwenAPIError as exc:
        logger.warning("Consultation summary Qwen failed: %s", exc)
        return _fallback_summary(consultation_note, chat_messages)
