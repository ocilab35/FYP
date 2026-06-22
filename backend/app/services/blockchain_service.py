"""Web3 blockchain gateway — backend-only writes, hash-only on-chain storage."""

from __future__ import annotations

import json
import logging
import secrets
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from uuid import UUID

from app.core.config import settings
from app.services.hash_utils import hex_to_bytes32, string_to_bytes32, uuid_to_bytes32

logger = logging.getLogger(__name__)

CONTRACT_JSON = Path(__file__).resolve().parent.parent / "blockchain" / "contract.json"


@dataclass
class ChainReceipt:
    tx_hash: str
    block_number: int | None
    simulated: bool


class BlockchainService:
    """Trusted backend gateway to HealthcareVerificationRegistry."""

    def __init__(self) -> None:
        self._web3 = None
        self._contract = None
        self._account = None
        self._simulated = False
        self._load()

    def _load(self) -> None:
        if not settings.BLOCKCHAIN_ENABLED:
            self._simulated = True
            logger.info("Blockchain disabled — using simulated ledger")
            return

        try:
            from web3 import Web3
            from eth_account import Account

            self._web3 = Web3(Web3.HTTPProvider(settings.BLOCKCHAIN_RPC_URL))
            if not self._web3.is_connected():
                logger.warning("Blockchain RPC unreachable — simulated mode")
                self._simulated = True
                return

            if not settings.BLOCKCHAIN_PRIVATE_KEY:
                logger.warning("BLOCKCHAIN_PRIVATE_KEY missing — simulated mode")
                self._simulated = True
                return

            self._account = Account.from_key(settings.BLOCKCHAIN_PRIVATE_KEY)
            address = settings.BLOCKCHAIN_CONTRACT_ADDRESS
            abi: list[Any] = []

            if CONTRACT_JSON.is_file():
                meta = json.loads(CONTRACT_JSON.read_text(encoding="utf-8"))
                address = address or meta.get("address")
                abi = meta.get("abi", [])

            if not address or not abi:
                logger.warning("Contract metadata missing — simulated mode")
                self._simulated = True
                return

            self._contract = self._web3.eth.contract(
                address=Web3.to_checksum_address(address),
                abi=abi,
            )
            logger.info("Blockchain connected: %s", address)
        except Exception as exc:
            logger.warning("Blockchain init failed (%s) — simulated mode", exc)
            self._simulated = True

    @property
    def is_simulated(self) -> bool:
        return self._simulated

    def _nonce(self) -> bytes:
        return secrets.token_bytes(32)

    def _sim_tx_hash(self, label: str, resource_id: UUID) -> str:
        from app.services.hash_utils import sha256_hex

        digest = sha256_hex(f"{label}:{resource_id}".encode())
        return f"0xsim{digest[:62]}"

    def _send(self, fn, *, resource_id: UUID, label: str) -> ChainReceipt:
        if self._simulated or not self._contract or not self._web3 or not self._account:
            return ChainReceipt(
                tx_hash=self._sim_tx_hash(label, resource_id),
                block_number=None,
                simulated=True,
            )

        from web3 import Web3

        nonce = self._web3.eth.get_transaction_count(self._account.address)
        chain_id = self._web3.eth.chain_id
        tx = fn.build_transaction(
            {
                "from": self._account.address,
                "nonce": nonce,
                "chainId": chain_id,
                "gas": settings.BLOCKCHAIN_GAS_LIMIT,
                "maxFeePerGas": self._web3.to_wei(settings.BLOCKCHAIN_MAX_FEE_GWEI, "gwei"),
                "maxPriorityFeePerGas": self._web3.to_wei(1, "gwei"),
            }
        )
        signed = self._account.sign_transaction(tx)
        tx_hash = self._web3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self._web3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)
        return ChainReceipt(
            tx_hash=Web3.to_hex(tx_hash),
            block_number=receipt.blockNumber,
            simulated=False,
        )

    def register_medical_report(
        self, *, record_id: UUID, patient_id: UUID, content_hash_hex: str
    ) -> ChainReceipt:
        if self._simulated or not self._contract:
            return ChainReceipt(
                tx_hash=self._sim_tx_hash("medical_report", record_id),
                block_number=None,
                simulated=True,
            )

        fn = self._contract.functions.registerMedicalReport(
            uuid_to_bytes32(record_id),
            uuid_to_bytes32(patient_id),
            hex_to_bytes32(content_hash_hex),
            self._nonce(),
        )
        return self._send(fn, resource_id=record_id, label="medical_report")

    def register_prescription(
        self,
        *,
        prescription_id: UUID,
        patient_id: UUID,
        doctor_id: UUID,
        content_hash_hex: str,
    ) -> ChainReceipt:
        if self._simulated or not self._contract:
            return ChainReceipt(
                tx_hash=self._sim_tx_hash("prescription", prescription_id),
                block_number=None,
                simulated=True,
            )

        fn = self._contract.functions.registerPrescription(
            uuid_to_bytes32(prescription_id),
            uuid_to_bytes32(patient_id),
            uuid_to_bytes32(doctor_id),
            hex_to_bytes32(content_hash_hex),
            self._nonce(),
        )
        return self._send(fn, resource_id=prescription_id, label="prescription")

    def register_audit_event(
        self,
        *,
        action_id: UUID,
        user_id: UUID | None,
        user_role: str,
        resource_type: str,
        resource_id: str | None,
        action_hash_hex: str,
    ) -> ChainReceipt:
        if self._simulated or not self._contract:
            return ChainReceipt(
                tx_hash=self._sim_tx_hash("audit", action_id),
                block_number=None,
                simulated=True,
            )

        fn = self._contract.functions.registerAuditEvent(
            uuid_to_bytes32(action_id),
            uuid_to_bytes32(user_id) if user_id else bytes(32),
            string_to_bytes32(user_role),
            string_to_bytes32(resource_type),
            string_to_bytes32(resource_id or ""),
            hex_to_bytes32(action_hash_hex),
            self._nonce(),
        )
        return self._send(fn, resource_id=action_id, label="audit")

    def verify_on_chain(
        self, *, resource_id: UUID, content_hash_hex: str, resource_type: str
    ) -> bool | None:
        if self._simulated or not self._contract:
            return None

        hash_b = hex_to_bytes32(content_hash_hex)
        rid = uuid_to_bytes32(resource_id)
        try:
            if resource_type == "medical_record":
                return self._contract.functions.verifyMedicalReport(rid, hash_b).call()
            if resource_type == "prescription":
                return self._contract.functions.verifyPrescription(rid, hash_b).call()
        except Exception as exc:
            logger.warning("On-chain verify failed: %s", exc)
        return None


blockchain_service = BlockchainService()
