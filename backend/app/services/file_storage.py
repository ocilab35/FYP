import uuid
from pathlib import Path

from fastapi import HTTPException, UploadFile

from app.core.config import settings

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".gif", ".webp", ".dcm", ".tiff", ".tif"}
ALLOWED_MIME = {
    "application/pdf",
    "image/png",
    "image/jpeg",
    "image/gif",
    "image/webp",
    "image/tiff",
    "application/dicom",
}


def _upload_root() -> Path:
    root = Path(settings.UPLOAD_DIR) / "medical"
    root.mkdir(parents=True, exist_ok=True)
    return root


async def save_medical_file(patient_id: uuid.UUID, file: UploadFile) -> dict:
    if not file.filename:
        raise HTTPException(status_code=400, detail="Filename is required")

    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"File type not allowed. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = await file.read()
    max_bytes = settings.MAX_UPLOAD_SIZE_MB * 1024 * 1024
    if len(content) > max_bytes:
        raise HTTPException(status_code=400, detail=f"File exceeds {settings.MAX_UPLOAD_SIZE_MB}MB limit")

    if file.content_type and file.content_type not in ALLOWED_MIME:
        raise HTTPException(status_code=400, detail="MIME type not allowed")

    patient_dir = _upload_root() / str(patient_id)
    patient_dir.mkdir(parents=True, exist_ok=True)

    stored_name = f"{uuid.uuid4()}{ext}"
    dest = patient_dir / stored_name
    dest.write_bytes(content)

    relative = f"/api/v1/files/medical/{patient_id}/{stored_name}"
    return {
        "file_url": relative,
        "file_name": file.filename,
        "file_size": len(content),
        "mime_type": file.content_type or "application/octet-stream",
        "stored_name": stored_name,
        "file_content": content,
    }


def resolve_medical_file(patient_id: uuid.UUID, stored_name: str) -> Path:
    if ".." in stored_name or "/" in stored_name or "\\" in stored_name:
        raise HTTPException(status_code=400, detail="Invalid file path")
    path = _upload_root() / str(patient_id) / stored_name
    if not path.is_file():
        raise HTTPException(status_code=404, detail="File not found")
    return path
