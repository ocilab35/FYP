// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title HealthcareVerificationRegistry
 * @notice Stores SHA-256 content hashes and audit metadata for healthcare records.
 *         Never stores PHI, files, or large payloads — hashes and IDs only.
 */
contract HealthcareVerificationRegistry is AccessControl, ReentrancyGuard {
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");

    uint8 public constant RESOURCE_MEDICAL_REPORT = 1;
    uint8 public constant RESOURCE_PRESCRIPTION = 2;
    uint8 public constant RESOURCE_AUDIT = 3;

    struct MedicalReportRecord {
        bytes32 contentHash;
        bytes32 patientId;
        uint64 registeredAt;
        address registrar;
        bool exists;
    }

    struct PrescriptionRecord {
        bytes32 contentHash;
        bytes32 patientId;
        bytes32 doctorId;
        uint64 registeredAt;
        address registrar;
        bool exists;
    }

    struct AuditRecord {
        bytes32 actionHash;
        bytes32 userId;
        bytes32 userRole;
        bytes32 resourceType;
        bytes32 resourceId;
        uint64 registeredAt;
        address registrar;
        bool exists;
    }

    mapping(bytes32 => MedicalReportRecord) private _medicalReports;
    mapping(bytes32 => PrescriptionRecord) private _prescriptions;
    mapping(bytes32 => AuditRecord) private _auditEvents;
    bytes32[] private _auditEventIds;

    mapping(bytes32 => bool) private _usedNonces;

    event MedicalReportRegistered(
        bytes32 indexed recordId,
        bytes32 indexed patientId,
        bytes32 contentHash,
        uint64 timestamp
    );
    event PrescriptionRegistered(
        bytes32 indexed prescriptionId,
        bytes32 indexed patientId,
        bytes32 contentHash,
        uint64 timestamp
    );
    event AuditEventRegistered(
        bytes32 indexed actionId,
        bytes32 indexed userId,
        bytes32 actionHash,
        uint64 timestamp
    );
    event VerificationPerformed(
        bytes32 indexed resourceId,
        bytes32 contentHash,
        bool verified,
        uint8 resourceType
    );
    event RegistrarUpdated(address indexed registrar, bool authorized);

    modifier onlyValidHash(bytes32 contentHash) {
        require(contentHash != bytes32(0), "Invalid hash");
        _;
    }

    constructor(address admin, address registrar) {
        require(admin != address(0), "Invalid admin");
        require(registrar != address(0), "Invalid registrar");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, registrar);
    }

    function registerMedicalReport(
        bytes32 recordId,
        bytes32 patientId,
        bytes32 contentHash,
        bytes32 nonce
    ) external onlyRole(REGISTRAR_ROLE) nonReentrant onlyValidHash(contentHash) {
        require(recordId != bytes32(0), "Invalid record ID");
        require(patientId != bytes32(0), "Invalid patient ID");
        require(!_medicalReports[recordId].exists, "Report already registered");
        _consumeNonce(nonce);

        _medicalReports[recordId] = MedicalReportRecord({
            contentHash: contentHash,
            patientId: patientId,
            registeredAt: uint64(block.timestamp),
            registrar: msg.sender,
            exists: true
        });

        emit MedicalReportRegistered(recordId, patientId, contentHash, uint64(block.timestamp));
    }

    function verifyMedicalReport(
        bytes32 recordId,
        bytes32 contentHash
    ) external onlyValidHash(contentHash) returns (bool verified) {
        MedicalReportRecord storage rec = _medicalReports[recordId];
        require(rec.exists, "Report not registered");
        verified = rec.contentHash == contentHash;
        emit VerificationPerformed(recordId, contentHash, verified, RESOURCE_MEDICAL_REPORT);
    }

    function getMedicalReport(
        bytes32 recordId
    )
        external
        view
        returns (bytes32 contentHash, bytes32 patientId, uint64 registeredAt, address registrar, bool exists)
    {
        MedicalReportRecord storage rec = _medicalReports[recordId];
        return (rec.contentHash, rec.patientId, rec.registeredAt, rec.registrar, rec.exists);
    }

    function registerPrescription(
        bytes32 prescriptionId,
        bytes32 patientId,
        bytes32 doctorId,
        bytes32 contentHash,
        bytes32 nonce
    ) external onlyRole(REGISTRAR_ROLE) nonReentrant onlyValidHash(contentHash) {
        require(prescriptionId != bytes32(0), "Invalid prescription ID");
        require(patientId != bytes32(0), "Invalid patient ID");
        require(doctorId != bytes32(0), "Invalid doctor ID");
        require(!_prescriptions[prescriptionId].exists, "Prescription already registered");
        _consumeNonce(nonce);

        _prescriptions[prescriptionId] = PrescriptionRecord({
            contentHash: contentHash,
            patientId: patientId,
            doctorId: doctorId,
            registeredAt: uint64(block.timestamp),
            registrar: msg.sender,
            exists: true
        });

        emit PrescriptionRegistered(prescriptionId, patientId, contentHash, uint64(block.timestamp));
    }

    function verifyPrescription(
        bytes32 prescriptionId,
        bytes32 contentHash
    ) external onlyValidHash(contentHash) returns (bool verified) {
        PrescriptionRecord storage rec = _prescriptions[prescriptionId];
        require(rec.exists, "Prescription not registered");
        verified = rec.contentHash == contentHash;
        emit VerificationPerformed(prescriptionId, contentHash, verified, RESOURCE_PRESCRIPTION);
    }

    function getPrescription(
        bytes32 prescriptionId
    )
        external
        view
        returns (
            bytes32 contentHash,
            bytes32 patientId,
            bytes32 doctorId,
            uint64 registeredAt,
            address registrar,
            bool exists
        )
    {
        PrescriptionRecord storage rec = _prescriptions[prescriptionId];
        return (rec.contentHash, rec.patientId, rec.doctorId, rec.registeredAt, rec.registrar, rec.exists);
    }

    function registerAuditEvent(
        bytes32 actionId,
        bytes32 userId,
        bytes32 userRole,
        bytes32 resourceType,
        bytes32 resourceId,
        bytes32 actionHash,
        bytes32 nonce
    ) external onlyRole(REGISTRAR_ROLE) nonReentrant onlyValidHash(actionHash) {
        require(actionId != bytes32(0), "Invalid action ID");
        require(!_auditEvents[actionId].exists, "Audit event already registered");
        _consumeNonce(nonce);

        _auditEvents[actionId] = AuditRecord({
            actionHash: actionHash,
            userId: userId,
            userRole: userRole,
            resourceType: resourceType,
            resourceId: resourceId,
            registeredAt: uint64(block.timestamp),
            registrar: msg.sender,
            exists: true
        });
        _auditEventIds.push(actionId);

        emit AuditEventRegistered(actionId, userId, actionHash, uint64(block.timestamp));
    }

    function getAuditEvent(
        bytes32 actionId
    )
        external
        view
        returns (
            bytes32 actionHash,
            bytes32 userId,
            bytes32 userRole,
            bytes32 resourceType,
            bytes32 resourceId,
            uint64 registeredAt,
            address registrar,
            bool exists
        )
    {
        AuditRecord storage rec = _auditEvents[actionId];
        return (
            rec.actionHash,
            rec.userId,
            rec.userRole,
            rec.resourceType,
            rec.resourceId,
            rec.registeredAt,
            rec.registrar,
            rec.exists
        );
    }

    function auditEventCount() external view returns (uint256) {
        return _auditEventIds.length;
    }

    function auditEventIdAt(uint256 index) external view returns (bytes32) {
        require(index < _auditEventIds.length, "Index out of bounds");
        return _auditEventIds[index];
    }

    function setRegistrar(address registrar, bool authorized) external onlyRole(ADMIN_ROLE) {
        require(registrar != address(0), "Invalid registrar");
        if (authorized) {
            _grantRole(REGISTRAR_ROLE, registrar);
        } else {
            _revokeRole(REGISTRAR_ROLE, registrar);
        }
        emit RegistrarUpdated(registrar, authorized);
    }

    function _consumeNonce(bytes32 nonce) private {
        require(nonce != bytes32(0), "Invalid nonce");
        require(!_usedNonces[nonce], "Replay detected");
        _usedNonces[nonce] = true;
    }
}
