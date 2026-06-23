"""Qwen-powered prescription parsing from OCR text."""

from __future__ import annotations

import json
import logging

from app.ai.json_utils import extract_json_object
from app.ai.prompts.system import SAFETY_SYSTEM_RULES
from app.ai.qwen_client import QwenAPIError, qwen_client
from app.core.config import settings
from app.services.prescription_parser_service import parse_prescription_medications
from app.services.prescription_ocr_service import OcrLine

logger = logging.getLogger(__name__)


async def extract_medications_with_qwen(
    raw_text: str,
    ocr_lines: list[OcrLine],
    patient_context: dict | None = None,
) -> tuple[list[dict], list[str], float]:
    """Parse medications using Qwen; fall back to rule-based parser."""
    rule_meds, rule_warnings = parse_prescription_medications(ocr_lines, raw_text)

    if not settings.qwen_enabled or not raw_text.strip():
        return (
            [_med_dict(m) for m in rule_meds],
            rule_warnings,
            _overall_confidence(rule_meds),
        )

    prompt = f"""{SAFETY_SYSTEM_RULES}

Extract medications from this prescription OCR text. Support handwritten and printed prescriptions.

OCR TEXT:
{raw_text[:8000]}

PATIENT CONTEXT (for personalization, not diagnosis):
{json.dumps(patient_context or {}, default=str)[:2000]}

Return JSON:
{{
  "medications": [
    {{
      "medicine_name": "string",
      "dosage": "string or null",
      "frequency": "string or null",
      "duration": "string or null",
      "notes": "string or null",
      "confidence": 0.0-1.0
    }}
  ],
  "warnings": ["string"]
}}

Normalize frequency like "1+1" to "Twice daily". Fix common OCR errors (25omg -> 250mg).
"""
    try:
        raw = await qwen_client.chat_completion(
            [{"role": "system", "content": prompt}],
            temperature=0.1,
        )
        data = extract_json_object(raw)
        meds = data.get("medications") or []
        warnings = list(data.get("warnings") or [])
        if not meds:
            warnings.extend(rule_warnings)
            return (
                [_med_dict(m) for m in rule_meds],
                warnings,
                _overall_confidence(rule_meds),
            )

        normalized = []
        for m in meds:
            if not m.get("medicine_name"):
                continue
            normalized.append({
                "medicine_name": str(m["medicine_name"]).strip(),
                "dosage": m.get("dosage"),
                "frequency": m.get("frequency"),
                "duration": m.get("duration"),
                "notes": m.get("notes"),
                "confidence": round(min(1.0, max(0.0, float(m.get("confidence", 0.75)))), 2),
            })

        if len(normalized) < len(rule_meds):
            warnings.append("Some medications may be missing — please review carefully.")
        warnings.extend(rule_warnings)
        return normalized, list(dict.fromkeys(warnings)), _overall_from_dicts(normalized)
    except QwenAPIError as exc:
        logger.warning("Qwen prescription parse failed: %s", exc)
        return (
            [_med_dict(m) for m in rule_meds],
            rule_warnings + ["AI enhancement unavailable — using OCR parser only."],
            _overall_confidence(rule_meds),
        )


def _med_dict(m) -> dict:
    return {
        "medicine_name": m.medicine_name,
        "dosage": m.dosage,
        "frequency": m.frequency,
        "duration": m.duration,
        "notes": m.notes,
        "confidence": m.confidence,
    }


def _overall_confidence(meds) -> float:
    if not meds:
        return 0.0
    return round(sum(m.confidence for m in meds) / len(meds), 2)


def _overall_from_dicts(meds: list[dict]) -> float:
    if not meds:
        return 0.0
    return round(sum(m.get("confidence", 0.5) for m in meds) / len(meds), 2)
