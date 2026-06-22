"""Generate prescription PDF documents."""

import uuid
from pathlib import Path

from app.core.config import settings

try:
    from reportlab.lib.pagesizes import A4
    from reportlab.lib.units import mm
    from reportlab.pdfgen import canvas

    HAS_REPORTLAB = True
except ImportError:
    HAS_REPORTLAB = False


def _prescription_dir() -> Path:
    root = Path(settings.UPLOAD_DIR) / "prescriptions"
    root.mkdir(parents=True, exist_ok=True)
    return root


def generate_prescription_pdf(
    *,
    patient_name: str,
    doctor_name: str,
    diagnosis: str,
    medications: list[dict],
    instructions: str | None,
    recommendations: str | None,
    prescription_id: uuid.UUID,
) -> str:
    if not HAS_REPORTLAB:
        return ""

    filename = f"{prescription_id}.pdf"
    path = _prescription_dir() / filename

    c = canvas.Canvas(str(path), pagesize=A4)
    width, height = A4
    y = height - 30 * mm

    c.setFont("Helvetica-Bold", 16)
    c.drawString(30 * mm, y, "MediCore — Electronic Prescription")
    y -= 12 * mm

    c.setFont("Helvetica", 10)
    c.drawString(30 * mm, y, f"Patient: {patient_name}")
    y -= 6 * mm
    c.drawString(30 * mm, y, f"Doctor: {doctor_name}")
    y -= 6 * mm
    c.drawString(30 * mm, y, f"Diagnosis: {diagnosis}")
    y -= 10 * mm

    c.setFont("Helvetica-Bold", 11)
    c.drawString(30 * mm, y, "Medications")
    y -= 7 * mm
    c.setFont("Helvetica", 10)
    for i, med in enumerate(medications, 1):
        line = f"{i}. {med.get('medicine_name', 'N/A')}"
        if med.get("dosage"):
            line += f" — {med['dosage']}"
        if med.get("frequency"):
            line += f", {med['frequency']}"
        if med.get("duration"):
            line += f" for {med['duration']}"
        c.drawString(35 * mm, y, line)
        y -= 6 * mm
        if y < 40 * mm:
            c.showPage()
            y = height - 30 * mm

    if instructions:
        y -= 6 * mm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(30 * mm, y, "Instructions")
        y -= 7 * mm
        c.setFont("Helvetica", 10)
        for line in instructions.split("\n")[:8]:
            c.drawString(35 * mm, y, line[:90])
            y -= 6 * mm

    if recommendations:
        y -= 6 * mm
        c.setFont("Helvetica-Bold", 11)
        c.drawString(30 * mm, y, "Recommendations")
        y -= 7 * mm
        c.setFont("Helvetica", 10)
        for line in recommendations.split("\n")[:6]:
            c.drawString(35 * mm, y, line[:90])
            y -= 6 * mm

    c.save()
    return f"/api/v1/files/prescriptions/{filename}"
