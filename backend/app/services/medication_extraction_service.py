"""Orchestrate prescription image OCR and medication field extraction."""

from __future__ import annotations

from app.services.prescription_ocr_service import extract_text_from_image
from app.services.prescription_parser_service import ParsedMedication, parse_prescription_medications

ALLOWED_MIME = {"image/jpeg", "image/png", "image/webp", "image/jpg"}
MAX_BYTES = 10 * 1024 * 1024


def extract_medications_from_prescription_image(
    image_bytes: bytes,
    content_type: str | None,
) -> dict:
    if len(image_bytes) > MAX_BYTES:
        raise ValueError("Image too large. Maximum size is 10MB.")

    if content_type and content_type.split(";")[0].strip().lower() not in ALLOWED_MIME:
        raise ValueError("Unsupported format. Upload JPG, PNG, or WebP.")

    ocr = extract_text_from_image(image_bytes)
    medications, warnings = parse_prescription_medications(ocr.lines, ocr.raw_text)

    overall = 0.0
    if medications:
        overall = round(sum(m.confidence for m in medications) / len(medications), 2)
    elif ocr.lines:
        overall = round(sum(l.confidence for l in ocr.lines) / len(ocr.lines), 2)

    return {
        "medications": [_med_to_dict(m) for m in medications],
        "raw_text": ocr.raw_text[:8000] if ocr.raw_text else None,
        "overall_confidence": overall,
        "ocr_engine": ocr.engine,
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
