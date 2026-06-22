"""Extract text from prescription images using local OCR (no external API keys)."""

from __future__ import annotations

import io
import logging
import re
from dataclasses import dataclass

from PIL import Image, ImageEnhance, ImageOps

logger = logging.getLogger(__name__)

_ocr_engine = None
_tesseract_available = False

try:
    from rapidocr_onnxruntime import RapidOCR

    _ocr_engine = RapidOCR()
except ImportError:
    logger.warning("rapidocr-onnxruntime not installed; trying pytesseract fallback")

try:
    import pytesseract

    _tesseract_available = True
except ImportError:
    pass


@dataclass
class OcrLine:
    text: str
    confidence: float


@dataclass
class OcrResult:
    lines: list[OcrLine]
    raw_text: str
    engine: str


def _scale_image(image: Image.Image, target: int = 1600) -> Image.Image:
    w, h = image.size
    if max(w, h) >= target:
        return image
    scale = target / max(w, h)
    return image.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)


def _preprocess_variants(image: Image.Image) -> list[Image.Image]:
    """A small set of preprocessed views — balanced for speed and handwriting accuracy."""
    rgb = image.convert("RGB")
    gray = rgb.convert("L")
    cropped = _auto_crop_content(rgb)

    return [
        _scale_image(ImageEnhance.Contrast(cropped).enhance(2.4)),
        _scale_image(
            ImageEnhance.Sharpness(ImageEnhance.Contrast(cropped).enhance(2.0)).enhance(2.2)
        ),
        _scale_image(ImageOps.autocontrast(gray).convert("RGB")),
    ]


def _auto_crop_content(image: Image.Image) -> Image.Image:
    """Trim noisy background by focusing on non-uniform ink/content area."""
    gray = image.convert("L")
    w, h = gray.size
    margin_x, margin_y = int(w * 0.05), int(h * 0.05)
    inner = gray.crop((margin_x, margin_y, w - margin_x, h - margin_y))
    hist = inner.histogram()
    background = max(range(256), key=lambda i: hist[i])

    mask = gray.point(lambda p: 255 if abs(p - background) > 28 else 0)
    bbox = mask.getbbox()
    if not bbox:
        return image
    x0, y0, x1, y1 = bbox
    pad = 12
    x0 = max(0, x0 - pad)
    y0 = max(0, y0 - pad)
    x1 = min(w, x1 + pad)
    y1 = min(h, y1 + pad)
    if (x1 - x0) < w * 0.25 or (y1 - y0) < h * 0.15:
        return image
    return image.crop((x0, y0, x1, y1))


def _group_boxes_to_lines(boxes: list[tuple[str, float, tuple]]) -> list[OcrLine]:
    """Group OCR text boxes into reading-order lines using bounding boxes."""
    if not boxes:
        return []

    sorted_boxes = sorted(boxes, key=lambda b: (b[2][1], b[2][0]))
    lines: list[list[tuple[str, float, tuple]]] = []
    current: list[tuple[str, float, tuple]] = []
    current_y: float | None = None

    for text, conf, (x0, y0, x1, y1) in sorted_boxes:
        cy = (y0 + y1) / 2
        height = max(y1 - y0, 8)
        if current_y is None or abs(cy - current_y) <= height * 0.65:
            current.append((text, conf, (x0, y0, x1, y1)))
            current_y = cy if current_y is None else (current_y + cy) / 2
        else:
            lines.append(current)
            current = [(text, conf, (x0, y0, x1, y1))]
            current_y = cy
    if current:
        lines.append(current)

    result: list[OcrLine] = []
    for group in lines:
        group.sort(key=lambda b: b[2][0])
        text = " ".join(t for t, _, _ in group).strip()
        text = re.sub(r"\s+", " ", text)
        if len(text) >= 2:
            conf = sum(c for _, c, _ in group) / len(group)
            result.append(OcrLine(text=text, confidence=min(max(conf, 0.0), 1.0)))
    return result


def _parse_rapidocr_boxes(result) -> list[tuple[str, float, tuple]]:
    boxes: list[tuple[str, float, tuple]] = []
    if not result:
        return boxes
    for item in result:
        if len(item) < 3:
            continue
        text = str(item[1]).strip()
        if not text:
            continue
        conf = float(item[2]) if item[2] is not None else 0.5
        box = item[0]
        xs = [p[0] for p in box]
        ys = [p[1] for p in box]
        boxes.append((text, conf, (min(xs), min(ys), max(xs), max(ys))))
    return boxes


def _ocr_image(image: Image.Image) -> list[tuple[str, float, tuple]]:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    result, _ = _ocr_engine(buf.getvalue())
    return _parse_rapidocr_boxes(result)


def _strip_ocr_pass(image: Image.Image) -> list[tuple[str, float, tuple]]:
    """OCR horizontal strips — helps each handwritten line on prescriptions."""
    cropped = _auto_crop_content(image.convert("RGB"))
    w, h = cropped.size
    strips = 5
    strip_height = h // strips
    boxes: list[tuple[str, float, tuple]] = []
    if strip_height < 30:
        return boxes

    for i in range(strips):
        y0 = max(0, i * strip_height - 8)
        y1 = min(h, (i + 1) * strip_height + 8)
        strip = cropped.crop((0, y0, w, y1))
        strip = ImageEnhance.Sharpness(ImageEnhance.Contrast(strip).enhance(2.2)).enhance(2.0)
        strip = _scale_image(strip, target=1200)
        for text, conf, (x0, y0b, x1, y1b) in _ocr_image(strip):
            boxes.append((text, conf, (x0, y0 + y0b, x1, y0 + y1b)))
    return boxes


def extract_text_from_image(image_bytes: bytes) -> OcrResult:
    """Run local OCR on prescription image bytes."""
    try:
        image = Image.open(io.BytesIO(image_bytes))
        w, h = image.size
        if max(w, h) > 2400:
            scale = 2400 / max(w, h)
            image = image.resize((int(w * scale), int(h * scale)), Image.Resampling.LANCZOS)
    except Exception as exc:
        raise ValueError("Invalid image file. Use JPG, PNG, or WebP.") from exc

    if _ocr_engine is not None:
        return _run_rapidocr_multipass(image)

    if _tesseract_available:
        processed = _preprocess_variants(image)[0]
        return _run_tesseract(processed)

    raise RuntimeError(
        "OCR engine unavailable. Install rapidocr-onnxruntime or pytesseract with Tesseract OCR."
    )


def _run_rapidocr_multipass(image: Image.Image) -> OcrResult:
    all_boxes: list[tuple[str, float, tuple]] = []

    for variant in _preprocess_variants(image):
        all_boxes.extend(_ocr_image(variant))

    all_boxes.extend(_strip_ocr_pass(image))

    lines = _group_boxes_to_lines(all_boxes)
    if not lines:
        for text, conf, _ in all_boxes:
            if len(text.strip()) >= 2:
                lines.append(OcrLine(text=text, confidence=conf))

    deduped: dict[str, OcrLine] = {}
    for line in lines:
        key = re.sub(r"\s+", " ", line.text.lower())
        if key not in deduped or line.confidence > deduped[key].confidence:
            deduped[key] = line

    line_order: dict[str, float] = {}
    for text, _, (_x0, y0, _x1, y1) in all_boxes:
        key = re.sub(r"\s+", " ", text.lower())
        cy = (y0 + y1) / 2
        line_order[key] = min(line_order.get(key, cy), cy)

    final_lines = sorted(
        deduped.values(),
        key=lambda l: line_order.get(re.sub(r"\s+", " ", l.text.lower()), 9999),
    )
    raw = "\n".join(l.text for l in final_lines)
    return OcrResult(lines=final_lines, raw_text=raw, engine="rapidocr")


def _run_tesseract(image: Image.Image) -> OcrResult:
    data = pytesseract.image_to_data(image, output_type=pytesseract.Output.DICT)
    lines_map: dict[tuple[int, int, int], list[tuple[str, float]]] = {}

    n = len(data["text"])
    for i in range(n):
        text = (data["text"][i] or "").strip()
        if not text:
            continue
        key = (data["block_num"][i], data["par_num"][i], data["line_num"][i])
        conf = float(data["conf"][i])
        if conf < 0:
            conf = 50.0
        lines_map.setdefault(key, []).append((text, conf / 100.0))

    lines: list[OcrLine] = []
    for parts in lines_map.values():
        text = " ".join(p[0] for p in parts)
        conf = sum(p[1] for p in parts) / len(parts)
        lines.append(OcrLine(text=text, confidence=conf))

    raw = "\n".join(l.text for l in lines)
    return OcrResult(lines=lines, raw_text=raw, engine="tesseract")
