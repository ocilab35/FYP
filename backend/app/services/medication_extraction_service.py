"""Orchestrate prescription image OCR and medication field extraction."""

from __future__ import annotations

import asyncio

from app.services.prescription_ocr_service import extract_text_from_image
from app.services.prescription_parser_service import ParsedMedication, parse_prescription_medications
from app.services.prescription_qwen_service import extract_medications_with_qwen

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_BYTES = 10 * 1024 * 1024


def extract_medications_from_prescription_image(
    image_bytes: bytes,
    content_type: str | None,
    patient_context: dict | None = None,
) -> dict:
    """Sync entrypoint for thread pool execution."""
    if len(image_bytes) > MAX_BYTES:
        raise ValueError("Image too large. Maximum size is 10MB.")

    if content_type and content_type.split(";")[0].strip().lower() not in ALLOWED_MIME:
        raise ValueError("Unsupported format. Upload JPG, PNG, or WebP.")

    ocr = extract_text_from_image(image_bytes)
    return asyncio.run(_build_extraction_result(ocr, patient_context))


async def extract_medications_from_prescription_image_async(
    image_bytes: bytes,
    content_type: str | None,
    patient_context: dict | None = None,
) -> dict:
    if len(image_bytes) > MAX_BYTES:
        raise ValueError("Image too large. Maximum size is 10MB.")

    if content_type and content_type.split(";")[0].strip().lower() not in ALLOWED_MIME:
        raise ValueError("Unsupported format. Upload JPG, PNG, or WebP.")

    ocr = await asyncio.to_thread(extract_text_from_image, image_bytes)
    return await _build_extraction_result(ocr, patient_context)


async def _build_extraction_result(ocr, patient_context: dict | None) -> dict:
    medications, warnings, overall = await extract_medications_with_qwen(
        ocr.raw_text,
        ocr.lines,
        patient_context,
    )

    if not medications:
        rule_meds, rule_warnings = parse_prescription_medications(ocr.lines, ocr.raw_text)
        medications = [_med_to_dict(m) for m in rule_meds]
        warnings = rule_warnings
        if rule_meds:
            overall = round(sum(m.confidence for m in rule_meds) / len(rule_meds), 2)
        elif ocr.lines:
            overall = round(sum(l.confidence for l in ocr.lines) / len(ocr.lines), 2)

    engine = ocr.engine
    from app.core.config import settings
    if settings.qwen_enabled:
        engine = f"{ocr.engine}+qwen"

    return {
        "medications": medications,
        "raw_text": ocr.raw_text[:8000] if ocr.raw_text else None,
        "overall_confidence": overall,
        "ocr_engine": engine,
        "warnings": warnings,
    }


def _med_to_dict(m: ParsedMedication) -> dict:
    return {
        "medicine_name": m.medicine_name,
        "dosage": m.dosage,
        "frequency": m.frequency,
        "duration": m.duration,
        "notes": m.notes,
        "confidence": m.confidence,
    }
