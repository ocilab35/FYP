"""Blockchain-backed immutable audit trail."""

from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID, uuid4

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.enums import UserRole
from app.models import AuditLog, User
from app.services.blockchain_service import blockchain_service
from app.services.hash_utils import hash_audit_payload


class AuditBlockchainService:
    async def mirror_audit_log(
        self,
        db: AsyncSession,
        log: AuditLog,
        user: User | None = None,
    ) -> AuditLog:
        user_role = user.role.value if user and hasattr(user.role, "value") else "system"
        if isinstance(user_role, str) is False:
            user_role = str(user_role)

        action_hash = hash_audit_payload(
            action_id=log.id,
            user_id=log.user_id,
            user_role=user_role,
            action=log.action,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            timestamp_iso=log.created_at.isoformat() if log.created_at else datetime.now(timezone.utc).isoformat(),
            details=log.details,
        )

        receipt = blockchain_service.register_audit_event(
            action_id=log.id,
            user_id=log.user_id,
            user_role=user_role,
            resource_type=log.resource_type,
            resource_id=log.resource_id,
            action_hash_hex=action_hash,
        )

        log.blockchain_hash = action_hash
        log.blockchain_tx_hash = receipt.tx_hash
        log.user_role = user_role
        await db.flush()
        return log


audit_blockchain_service = AuditBlockchainService()
