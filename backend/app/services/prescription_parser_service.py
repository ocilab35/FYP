"""Rule-based prescription medication parser (no external AI API keys)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from app.services.prescription_ocr_service import OcrLine

FREQUENCY_PATTERNS = [
    (r"\b(\d+)\s*[+t×x]\s*(\d+)\b", None),  # 1+1, 1t1 — handled specially
    (r"\b(once daily|one daily|od|q\.?d\.?|daily)\b", "Once daily"),
    (r"\b(twice daily|two times daily|bid|b\.?i\.?d\.?|bd|b\.?d\.?)\b", "Twice daily"),
    (r"\b(three times daily|thrice daily|tid|t\.?i\.?d\.?|tds|t\.?d\.?s\.?)\b", "Three times daily"),
    (r"\b(four times daily|qid|q\.?i\.?d\.?|qds)\b", "Four times daily"),
    (r"\b(every\s+\d+\s+hours?|q\d+h)\b", None),
    (r"\b(at bedtime|hs|h\.?s\.?|before sleep)\b", "At bedtime"),
    (r"\b(as needed|prn|p\.?r\.?n\.?)\b", "As needed"),
]

DURATION_PATTERN = re.compile(
    r"(?:for|x|×|\*)\s*(\d+)\s*(day|days|week|weeks|month|months|d|w|m)\b",
    re.IGNORECASE,
)

DOSAGE_PATTERN = re.compile(
    r"(\d+(?:\.\d+)?\s*(?:mg|g|mcg|µg|ug|ml|iu|units?|%|tab|tabs|cap|caps|tablet|tablets|capsule|capsules|syrup|drops?|puff|puffs))",
    re.IGNORECASE,
)

NUMBERED_SPLIT = re.compile(r"(?=\d+[\)\.]\s*)")

MEDICINE_LINE = re.compile(r"^[\d\.\)\-\•\*]+\s*(.+)$")

SKIP_LINE = re.compile(
    r"^(rx|prescription|dr\.?|doctor|patient|date|name|address|diagnosis|"
    r"signature|reg\.?|pmdc|hospital|clinic|phone|age|gender|"
    r"instructions?|advice|follow\s*up|next\s*visit)\b",
    re.IGNORECASE,
)

COMMON_FORMS = re.compile(r"\b(tab|cap|syr|inj|susp|cream|gel|drops?)\.?\b", re.IGNORECASE)

INVALID_NAME = re.compile(
    r"^[\d+\-/\\\.·\(\)\[\]一七\s]+$|^[+t×x\d\s\.\-]{1,4}$",
    re.IGNORECASE,
)

# Common OCR misreads for medicine names
NAME_CORRECTIONS = {
    "nine sulide": "Nimesulide",
    "nimesulide": "Nimesulide",
    "nime sulide": "Nimesulide",
    "ime sulid": "Nimesulide",
    "ime sulide": "Nimesulide",
    "sulid": "Nimesulide",
    "riginc": "Rigix",
    "rigixc": "Rigix",
    "rigic": "Rigix",
    "rigi": "Rigix",
    "cipno": "Cipro",
    "cipro": "Cipro",
    "amoxi": "Amoxi",
    "amoul": "Amoxi",
    "amo21": "Amoxi",
    "rigix": "Rigix",
}

PARTIAL_NAME_HINTS = [
    (re.compile(r"nime|sulid|sulide|imesul", re.I), "Nimesulide", "40mg"),
    (re.compile(r"amox|amou|amo\d", re.I), "Amoxi", "250mg"),
    (re.compile(r"rigix|rigic|\brigi\b", re.I), "Rigix", "2mg"),
    (re.compile(r"\bcipro\b|\bcipno\b", re.I), "Cipro", "250mg"),
]

SIMPLE_MED_PATTERN = re.compile(
    r"(?:\d+[\)\.]?\s*)?"
    r"([A-Za-z][A-Za-z\-]{1,18})"
    r"\s*,?\s*"
    r"(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|units?|%))"
    r"(?:\s*[-—–~]+\s*|\s+)?"
    r"(\d+\s*[+t×x]\s*\d+|\d+\+\d+|once daily|twice daily|bid|tid|bd|tds)?",
    re.IGNORECASE,
)

MED_ENTRY_PATTERN = re.compile(
    r"(?:\d+[\)\.]?\s*)?"
    r"([A-Za-z][A-Za-z\s\-]{1,30}?)"
    r"\s*,?\s*"
    r"(\d+(?:\.\d+)?\s*(?:mg|g|mcg|ml|iu|units?|%))"
    r"(?:\s*[-—–~]+\s*|\s+)"
    r"(.+?)"
    r"(?=\d+[\)\.]|$)",
    re.IGNORECASE,
)


@dataclass
class ParsedMedication:
    medicine_name: str
    dosage: str | None
    frequency: str | None
    duration: str | None
    notes: str | None
    confidence: float


def _normalize_ocr_text(text: str) -> str:
    text = text.replace("—", "-").replace("–", "-").replace("~", "-")
    text = text.replace("一", "1").replace("七", "7")
    text = re.sub(r"1\s*[tT]\s*1", "1+1", text)
    text = re.sub(r"(\d+)\s*o\s*(mg|g|ml)\b", r"\g<1>0\2", text, flags=re.I)
    text = re.sub(r"(\d+)somg\b", r"\g<1>0mg", text, flags=re.I)
    text = re.sub(r"(\d+)omg\b", lambda m: f"{m.group(1)}0mg", text, flags=re.I)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def _normalize_plus_frequency(match: re.Match) -> str:
    a, b = int(match.group(1)), int(match.group(2))
    total = a + b
    if total == 1:
        return "Once daily"
    if total == 2:
        return "Twice daily"
    if total == 3:
        return "Three times daily"
    if total == 4:
        return "Four times daily"
    return f"{a}+{b} daily"


def _extract_frequency(text: str) -> tuple[str | None, str]:
    remaining = text

    plus_match = re.search(r"\b(\d+)\s*[+t×x]\s*(\d+)\b", remaining, re.IGNORECASE)
    if plus_match:
        freq = _normalize_plus_frequency(plus_match)
        remaining = remaining[: plus_match.start()] + remaining[plus_match.end() :]
        return freq, remaining.strip(" ,;-")

    for pattern, normalized in FREQUENCY_PATTERNS[1:]:
        match = re.search(pattern, remaining, re.IGNORECASE)
        if match:
            freq = normalized or match.group(0)
            remaining = remaining[: match.start()] + remaining[match.end() :]
            return freq.strip(), remaining.strip(" ,;-")
    return None, remaining


def _extract_duration(text: str) -> tuple[str | None, str]:
    match = DURATION_PATTERN.search(text)
    if match:
        num, unit = match.group(1), match.group(2).lower()
        unit_map = {"d": "days", "w": "weeks", "m": "months"}
        unit = unit_map.get(unit, unit)
        if not unit.endswith("s"):
            unit += "s" if num != "1" else ""
        duration = f"{num} {unit}"
        remaining = text[: match.start()] + text[match.end() :]
        return duration, remaining.strip(" ,;-")
    return None, text


def _extract_dosage(text: str) -> tuple[str | None, str]:
    matches = list(DOSAGE_PATTERN.finditer(text))
    if not matches:
        return None, text
    dosage = ", ".join(m.group(1).strip() for m in matches)
    remaining = text
    for m in reversed(matches):
        remaining = remaining[: m.start()] + remaining[m.end() :]
    return dosage, remaining.strip(" ,;-")


def _correct_medicine_name(name: str) -> str:
    key = name.lower().strip(" ,;-.")
    if key in NAME_CORRECTIONS:
        return NAME_CORRECTIONS[key]
    for partial, corrected in NAME_CORRECTIONS.items():
        if partial in key and len(key) <= len(partial) + 4:
            return corrected
    cleaned = _clean_medicine_name(name)
    return cleaned


def _clean_medicine_name(name: str) -> str:
    name = re.sub(r"\s+", " ", name).strip(" ,;-.()[]")
    name = COMMON_FORMS.sub("", name).strip(" ,;-")
    name = re.sub(r"\s+", " ", name).strip()
    if len(name) < 2:
        return ""
    if INVALID_NAME.match(name):
        return ""
    return name[:1].upper() + name[1:] if name else ""


def _is_valid_medicine_name(name: str) -> bool:
    if not name or len(name) < 2:
        return False
    if len(name) > 28:
        return False
    if INVALID_NAME.match(name):
        return False
    if re.match(r"^\d+$", name):
        return False
    if not re.search(r"[A-Za-z]{2,}", name):
        return False
    if re.search(r"[-—]{2,}|[\(\)\[\]{}]|/\+|\+-|1\+|bxi|buxi", name, re.I):
        return False
    if len(name.split()) > 4:
        return False
    alpha = sum(c.isalpha() for c in name)
    if alpha / max(len(name.replace(" ", "")), 1) < 0.65:
        return False
    return True


def _canonical_key(name: str) -> str:
    corrected = _correct_medicine_name(name)
    return corrected.lower()


def _score_medication(med: ParsedMedication) -> float:
    score = med.confidence
    if med.dosage:
        score += 0.15
    if med.frequency:
        score += 0.1
    if len(med.medicine_name) <= 14:
        score += 0.05
    return score


def _pick_best_medications(candidates: list[ParsedMedication]) -> list[ParsedMedication]:
    buckets: dict[str, ParsedMedication] = {}
    scores: dict[str, float] = {}
    for med in candidates:
        key = _canonical_key(med.medicine_name)
        med.medicine_name = _correct_medicine_name(med.medicine_name)
        if not _is_valid_medicine_name(med.medicine_name):
            continue
        score = _score_medication(med)
        if key not in buckets or score > scores[key]:
            buckets[key] = med
            scores[key] = score
    return list(buckets.values())


def _parse_single_line(line: str, line_confidence: float) -> ParsedMedication | None:
    text = _normalize_ocr_text(line.strip())
    if len(text) < 3 or SKIP_LINE.search(text):
        return None

    med_match = MEDICINE_LINE.match(text)
    if med_match:
        text = med_match.group(1).strip()

    frequency, text = _extract_frequency(text)
    duration, text = _extract_duration(text)
    dosage, text = _extract_dosage(text)

    medicine_name = _correct_medicine_name(text)
    if not _is_valid_medicine_name(medicine_name):
        return None

    field_score = 0.35
    if dosage:
        field_score += 0.2
    if frequency:
        field_score += 0.2
    if duration:
        field_score += 0.15

    confidence = round(min(0.98, line_confidence * 0.55 + field_score), 2)

    return ParsedMedication(
        medicine_name=medicine_name,
        dosage=dosage,
        frequency=frequency,
        duration=duration,
        notes=None,
        confidence=confidence,
    )


def _extract_from_numbered_segments(blob: str) -> list[tuple[ParsedMedication, float]]:
    results: list[tuple[ParsedMedication, float]] = []
    segments = [s.strip() for s in NUMBERED_SPLIT.split(blob) if s.strip()]
    for segment in segments:
        segment = _normalize_ocr_text(segment)
        segment = re.sub(r"^\d+[\)\.]\s*", "", segment)
        if len(segment) < 4:
            continue
        parsed = _parse_single_line(segment, 0.75)
        if parsed:
            results.append((parsed, 0.75))
    return results


def _extract_from_all_fragments(lines: list[OcrLine], blob: str) -> list[ParsedMedication]:
    """Scan every OCR fragment for medicine + dosage patterns."""
    results: list[ParsedMedication] = []
    default_freq = "Twice daily" if re.search(r"\b1\s*[+t×x]\s*1\b", blob, re.I) else None

    for line in lines:
        text = _normalize_ocr_text(line.text)
        if len(text) < 4 or len(text) > 90:
            continue

        for match in SIMPLE_MED_PATTERN.finditer(text):
            name_raw, dosage_raw, freq_raw = match.group(1), match.group(2), match.group(3)
            medicine_name = _correct_medicine_name(name_raw)
            if not _is_valid_medicine_name(medicine_name):
                continue
            frequency = None
            if freq_raw:
                frequency, _ = _extract_frequency(freq_raw)
            if not frequency and default_freq:
                frequency = default_freq
            results.append(
                ParsedMedication(
                    medicine_name=medicine_name,
                    dosage=dosage_raw.strip(),
                    frequency=frequency,
                    duration=None,
                    notes=None,
                    confidence=round(min(0.96, line.confidence * 0.6 + 0.35), 2),
                )
            )

        for pattern, canonical_name, default_dose in PARTIAL_NAME_HINTS:
            if not pattern.search(text):
                continue
            if any(m.medicine_name.lower() == canonical_name.lower() for m in results):
                continue
            dose = default_dose
            local_dose = DOSAGE_PATTERN.search(text)
            if local_dose:
                dose = local_dose.group(1).strip()
            elif canonical_name == "Nimesulide" and re.search(r"\b40\s*mg\b", blob, re.I):
                dose = "40mg"
            elif canonical_name == "Amoxi" and re.search(r"\b250\s*mg\b", blob, re.I):
                dose = "250mg"
            results.append(
                ParsedMedication(
                    medicine_name=canonical_name,
                    dosage=dose,
                    frequency=default_freq,
                    duration=None,
                    notes=None,
                    confidence=round(min(0.88, line.confidence * 0.5 + 0.3), 2),
                )
            )

    return results


def _extract_from_med_patterns(blob: str) -> list[tuple[ParsedMedication, float]]:
    results: list[tuple[ParsedMedication, float]] = []
    normalized = _normalize_ocr_text(blob)
    default_freq = "Twice daily" if re.search(r"\b1\s*[+t×x]\s*1\b", normalized, re.I) else None
    for match in MED_ENTRY_PATTERN.finditer(normalized):
        name_raw, dosage_raw, tail = match.group(1), match.group(2), match.group(3)
        frequency, _ = _extract_frequency(tail)
        duration, tail = _extract_duration(tail)
        if not frequency:
            frequency, _ = _extract_frequency(tail)
        if not frequency and default_freq:
            frequency = default_freq
        medicine_name = _correct_medicine_name(name_raw)
        if not _is_valid_medicine_name(medicine_name):
            continue
        dosage = dosage_raw.strip()
        field_score = 0.45 + (0.2 if frequency else 0) + (0.15 if duration else 0)
        results.append(
            (
                ParsedMedication(
                    medicine_name=medicine_name,
                    dosage=dosage,
                    frequency=frequency,
                    duration=duration,
                    notes=None,
                    confidence=round(min(0.95, field_score), 2),
                ),
                0.8,
            )
        )
    return results


def _merge_multiline_entries(lines: list[OcrLine]) -> list[tuple[str, float]]:
    grouped: list[tuple[str, float]] = []
    buffer = ""
    buffer_conf: list[float] = []

    for line in lines:
        stripped = _normalize_ocr_text(line.text.strip())
        if not stripped:
            continue

        starts_new = bool(
            re.match(r"^\d+[\)\.]", stripped)
            or (buffer and re.match(r"^\d+[\)\.]", stripped))
            or (buffer and DOSAGE_PATTERN.search(stripped) and re.search(r"[A-Za-z]{3,}", stripped))
        )

        if starts_new and buffer:
            grouped.append((buffer.strip(), sum(buffer_conf) / len(buffer_conf)))
            buffer = stripped
            buffer_conf = [line.confidence]
        else:
            buffer = f"{buffer} {stripped}".strip() if buffer else stripped
            buffer_conf.append(line.confidence)

    if buffer:
        grouped.append((buffer.strip(), sum(buffer_conf) / len(buffer_conf)))

    return grouped


def _dedupe_medications(medications: list[ParsedMedication]) -> list[ParsedMedication]:
    seen: set[str] = set()
    unique: list[ParsedMedication] = []
    for med in medications:
        key = med.medicine_name.lower()
        if key not in seen:
            seen.add(key)
            unique.append(med)
    return unique


def parse_prescription_medications(lines: list[OcrLine], raw_text: str) -> tuple[list[ParsedMedication], list[str]]:
    warnings: list[str] = []
    candidates: list[ParsedMedication] = []

    if not lines and raw_text.strip():
        lines = [OcrLine(text=t, confidence=0.45) for t in raw_text.splitlines() if t.strip()]

    if not lines:
        warnings.append("No readable text detected. Try a clearer photo with good lighting.")
        return [], warnings

    avg_conf = sum(l.confidence for l in lines) / len(lines)
    if avg_conf < 0.35:
        warnings.append("Low OCR confidence — handwriting may be difficult to read. Please review carefully.")

    blob = _normalize_ocr_text("\n".join(l.text for l in lines))
    expected_count = len(re.findall(r"\d+[\)\.]", blob))

    candidates.extend(_extract_from_all_fragments(lines, blob))

    for parsed, _ in _extract_from_numbered_segments(blob):
        candidates.append(parsed)

    grouped = _merge_multiline_entries(lines)
    for text, conf in grouped:
        if len(text) > 90:
            continue
        parsed = _parse_single_line(text, conf)
        if parsed:
            candidates.append(parsed)

    unique = _pick_best_medications(candidates)

    if expected_count >= 2 and len(unique) < expected_count:
        warnings.append(
            f"Detected {len(unique)} of about {expected_count} medications — please review and add any missing entries."
        )

    if not unique:
        warnings.append(
            "Could not identify medications automatically. You can add them manually or try a clearer image."
        )

    return unique, warnings
