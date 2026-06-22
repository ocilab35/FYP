"""Cryptographic hashing utilities for blockchain verification."""

from __future__ import annotations

import hashlib
import json
from typing import Any
from uuid import UUID


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_bytes32(data: bytes) -> bytes:
    return hashlib.sha256(data).digest()


def hash_file_content(content: bytes) -> str:
    return sha256_hex(content)


def hash_prescription_pdf(content: bytes) -> str:
    return sha256_hex(content)


def hash_prescription_payload(
    *,
    prescription_id: UUID,
    patient_id: UUID,
    doctor_id: UUID,
    diagnosis: str,
    medications: list[dict],
    instructions: str | None,
    created_at_iso: str,
) -> str:
    payload = {
        "prescription_id": str(prescription_id),
        "patient_id": str(patient_id),
        "doctor_id": str(doctor_id),
        "diagnosis": diagnosis,
        "medications": medications,
        "instructions": instructions or "",
        "created_at": created_at_iso,
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha256_hex(canonical)


def hash_audit_payload(
    *,
    action_id: UUID,
    user_id: UUID | None,
    user_role: str,
    action: str,
    resource_type: str,
    resource_id: str | None,
    timestamp_iso: str,
    details: dict | None = None,
) -> str:
    payload = {
        "action_id": str(action_id),
        "user_id": str(user_id) if user_id else "",
        "user_role": user_role,
        "action": action,
        "resource_type": resource_type,
        "resource_id": resource_id or "",
        "timestamp": timestamp_iso,
        "details": details or {},
    }
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return sha256_hex(canonical)


def uuid_to_bytes32(value: UUID | str) -> bytes:
    """Map UUID to bytes32 via SHA-256 (stable, collision-resistant)."""
    s = str(value).encode("utf-8")
    return hashlib.sha256(s).digest()


def string_to_bytes32(value: str) -> bytes:
    return hashlib.sha256(value.encode("utf-8")).digest()


def hex_to_bytes32(hex_str: str) -> bytes:
    cleaned = hex_str.removeprefix("0x")
    raw = bytes.fromhex(cleaned)
    if len(raw) != 32:
        raise ValueError("Hash must be 32 bytes")
    return raw
