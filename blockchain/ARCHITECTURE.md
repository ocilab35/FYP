# Blockchain Verification Layer

## Architecture

```
Patient/Doctor UI
       │
       ▼
FastAPI Gateway (RBAC + JWT)
       │
       ├── PostgreSQL (metadata, file paths, tx refs)
       ├── Local/Object Storage (actual files — never on-chain)
       └── BlockchainService (web3.py)
                 │
                 ▼
     HealthcareVerificationRegistry (Solidity)
           SHA-256 hashes only
```

## Principles

- **No PHI on-chain** — only `bytes32` content hashes, UUID-derived IDs, timestamps
- **Backend gateway** — only `REGISTRAR_ROLE` wallet registers hashes; patients/doctors never sign txs
- **Verify anytime** — re-hash file/PDF, compare with DB + on-chain registry
- **Simulated mode** — when RPC/contract unavailable, deterministic simulated tx hashes + DB anchoring

## Components

| Layer | Path |
|-------|------|
| Smart contract | `blockchain/contracts/HealthcareVerificationRegistry.sol` |
| Deploy | `blockchain/scripts/deploy.js` |
| Web3 gateway | `backend/app/services/blockchain_service.py` |
| Verification | `backend/app/services/verification_service.py` |
| Audit mirror | `backend/app/services/audit_blockchain_service.py` |
| Hash utils | `backend/app/services/hash_utils.py` |
| API | `backend/app/api/routes/verification.py` |

## Setup

### 1. Local Hardhat node

```bash
cd blockchain
npm install
npm run compile
npm run node          # terminal 1
npm run deploy:local  # terminal 2
```

### 2. Backend env

```env
BLOCKCHAIN_ENABLED=true
BLOCKCHAIN_RPC_URL=http://127.0.0.1:8545
BLOCKCHAIN_PRIVATE_KEY=<hardhat account #0 private key>
BLOCKCHAIN_CONTRACT_ADDRESS=<from contract.json>
```

### 3. Migrate DB

```bash
cd backend
python -m app.db.migrate_blockchain
```

## Workflows

### Medical report
1. Upload → SHA-256(file bytes)
2. Save file to storage + DB row
3. `registerMedicalReport(recordId, patientId, hash)` on-chain
4. Store `blockchain_tx_hash`, `blockchain_hash`, `verification_status=verified`

### Prescription
1. Doctor creates prescription → PDF generated
2. SHA-256(PDF bytes) → `registerPrescription(...)` on-chain

### Audit
1. `log_audit()` writes PostgreSQL row
2. SHA-256(audit payload) → `registerAuditEvent(...)` on-chain

## Security

- OpenZeppelin `AccessControl` + `ReentrancyGuard`
- Replay prevention via per-tx nonces
- Registrar wallet validation via env
- Input validation on hash length (32 bytes)
- Graceful fallback if chain unavailable

## Testing strategy

- Unit: `hash_utils` deterministic hashes
- Integration: upload → verify returns `verified`
- Tamper: modify file → verify returns `tampered`
- Contract: Hardhat tests for register/verify/replay
