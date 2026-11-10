import test from "node:test";
import assert from "node:assert/strict";
import {
  BackupGovernanceError,
  assessDisasterRecovery,
  authorizeDataExport,
  executeBackupRestore,
  planBackupRestore,
  validateBackupManifest,
  verifyBackupArtifact,
  verifyExportArtifact,
  type BackupManifest,
  type DisasterRecoveryPolicy,
  type RestoreProvider,
} from "../../src/operations/backup-governance.ts";

const now = new Date("2026-11-10T12:00:00.000Z");
const backup: BackupManifest = {
  id: "backup_1", tenantId: "tenant_a", scope: ["outcomes", "evidence"], createdAt: "2026-11-10T11:30:00.000Z",
  formatVersion: "1.0", contentHash: "a".repeat(64), sizeBytes: 1024, region: "sa-east-1",
  replicaRegions: ["us-east-1"], encryption: { algorithm: "AES-256-GCM", keyReference: "vault:backup/key-v4" },
  consistencyPoint: "2026-11-10T11:29:59.000Z", retentionUntil: "2027-11-10T11:30:00.000Z", createdBy: "backup_agent",
};
const policy: DisasterRecoveryPolicy = {
  tenantId: "tenant_a", rpoSeconds: 3600, rtoSeconds: 7200, maxRestoreDrillAgeSeconds: 30 * 86400,
  requiredReplicaRegions: ["us-east-1"], requireEncryption: true,
};

test("validates encrypted backup manifests and verifies content integrity", () => {
  assert.doesNotThrow(() => validateBackupManifest(backup, now));
  assert.equal(verifyBackupArtifact(backup, "a".repeat(64), now), true);
  assert.equal(verifyBackupArtifact(backup, "b".repeat(64), now), false);
  assert.throws(() => validateBackupManifest({ ...backup, contentHash: "bad" }, now), /BACKUP_HASH_INVALID/);
  assert.throws(() => validateBackupManifest({ ...backup, encryption: { algorithm: "none" as never, keyReference: "" } }, now), /BACKUP_ENCRYPTION_INVALID/);
});

test("assesses RPO, RTO, replica coverage and restore-drill freshness", () => {
  const ready = assessDisasterRecovery(policy, [backup], [{
    id: "drill_1", tenantId: "tenant_a", backupId: "backup_1", performedAt: "2026-11-01T12:00:00.000Z",
    durationSeconds: 1800, status: "passed", verifiedBy: "auditor",
  }], now);
  assert.equal(ready.status, "ready");
  assert.equal(ready.backupAgeSeconds, 1800);
  assert.deepEqual(ready.reasons, []);
  const degraded = assessDisasterRecovery(policy, [{ ...backup, replicaRegions: [] }], [], now);
  assert.equal(degraded.status, "degraded");
  assert.ok(degraded.reasons.includes("RESTORE_DRILL_MISSING"));
  assert.ok(degraded.reasons.includes("REPLICA_REGION_MISSING"));
  const unavailable = assessDisasterRecovery(policy, [{ ...backup, createdAt: "2026-11-10T10:00:00.000Z", consistencyPoint: "2026-11-10T09:59:59.000Z" }], [], now);
  assert.equal(unavailable.status, "unavailable");
  assert.ok(unavailable.reasons.includes("RPO_BREACHED"));
});

test("rejects cross-tenant, malformed, expired and duplicate backup metadata", () => {
  assert.throws(() => validateBackupManifest({ ...backup, tenantId: " " }, now), /BACKUP_MANIFEST_INVALID/);
  assert.throws(() => assessDisasterRecovery(policy, [{ ...backup, tenantId: "tenant_b" }], [], now), /BACKUP_TENANT_MISMATCH/);
  assert.throws(() => assessDisasterRecovery(policy, [backup, backup], [], now), /BACKUP_DUPLICATE/);
  assert.throws(() => validateBackupManifest({ ...backup, retentionUntil: "2026-11-10T11:00:00.000Z" }, now), /BACKUP_RETENTION_EXPIRED/);
});

test("restore planning requires tenant authorization, integrity and independent production approval", () => {
  const plan = planBackupRestore({
    tenantId: "tenant_a", backup, target: "staging", targetId: "restore-stage-1", actorId: "operator",
    idempotencyKey: "restore-1", now,
  }, () => true);
  assert.equal(plan.tenantId, "tenant_a");
  assert.equal(plan.target, "staging");
  assert.throws(() => planBackupRestore({
    tenantId: "tenant_a", backup, target: "production", targetId: "prod-db", actorId: "operator",
    idempotencyKey: "restore-prod", now,
  }, () => true), /RESTORE_APPROVAL_REQUIRED/);
  assert.throws(() => planBackupRestore({
    tenantId: "tenant_b", backup, target: "staging", targetId: "restore-stage-2", actorId: "operator",
    idempotencyKey: "cross-tenant", now,
  }, () => true), /BACKUP_TENANT_MISMATCH/);
  assert.throws(() => planBackupRestore({
    tenantId: "tenant_a", backup, target: "staging", targetId: "restore-stage-3", actorId: "operator",
    idempotencyKey: "denied", now,
  }, () => false), /RESTORE_UNAUTHORIZED/);
});

test("executes restore through staging, verifies restored tenant and promotes only after validation", async () => {
  const plan = planBackupRestore({
    tenantId: "tenant_a", backup, target: "production", targetId: "prod-db", actorId: "operator",
    approvedBy: "independent_approver", idempotencyKey: "restore-prod", now,
  }, () => true);
  const calls: string[] = [];
  const provider: RestoreProvider = {
    restoreToStaging: async (_manifest, key) => { calls.push("stage:" + key); return { stageId: "stage_1", contentHash: "a".repeat(64) }; },
    validateStaging: async () => { calls.push("validate"); return { valid: true, tenantId: "tenant_a", scope: ["outcomes", "evidence"] }; },
    promote: async () => { calls.push("promote"); },
    rollback: async () => { calls.push("rollback"); },
  };
  const result = await executeBackupRestore(plan, provider);
  assert.equal(result.restored, true);
  assert.deepEqual(calls, ["stage:restore-prod", "validate", "promote"]);
});

test("rolls back invalid staged restores and never promotes corrupted or cross-tenant data", async () => {
  const plan = planBackupRestore({
    tenantId: "tenant_a", backup, target: "staging", targetId: "stage", actorId: "operator",
    idempotencyKey: "bad-restore", now,
  }, () => true);
  let promoted = false, rolledBack = false;
  const provider: RestoreProvider = {
    restoreToStaging: async () => ({ stageId: "stage_bad", contentHash: "b".repeat(64) }),
    validateStaging: async () => ({ valid: true, tenantId: "tenant_a", scope: ["outcomes", "evidence"] }),
    promote: async () => { promoted = true; },
    rollback: async () => { rolledBack = true; },
  };
  await assert.rejects(() => executeBackupRestore(plan, provider), /RESTORE_INTEGRITY_FAILED/);
  assert.equal(promoted, false);
  assert.equal(rolledBack, true);
  const crossTenantProvider: RestoreProvider = {
    ...provider,
    restoreToStaging: async () => ({ stageId: "stage_cross", contentHash: "a".repeat(64) }),
    validateStaging: async () => ({ valid: true, tenantId: "tenant_b", scope: ["outcomes", "evidence"] }),
  };
  await assert.rejects(() => executeBackupRestore(plan, crossTenantProvider), /RESTORE_SCOPE_MISMATCH/);
});

test("authorizes data exports with purpose limitation and independent approval for personal data", () => {
  const authorization = authorizeDataExport({
    tenantId: "tenant_a", requestedBy: "analyst", purpose: "contractual reporting",
    classification: "personal", includePersonalData: true, approvedBy: "privacy_officer",
    idempotencyKey: "export-1", now,
  }, () => true);
  assert.equal(authorization.approvedBy, "privacy_officer");
  assert.equal(authorization.includePersonalData, true);
  assert.throws(() => authorizeDataExport({
    tenantId: "tenant_a", requestedBy: "analyst", purpose: "report",
    classification: "personal", includePersonalData: true, approvedBy: "analyst",
    idempotencyKey: "export-self", now,
  }, () => true), /EXPORT_APPROVAL_INDEPENDENT_REQUIRED/);
  assert.throws(() => authorizeDataExport({
    tenantId: "tenant_a", requestedBy: "analyst", purpose: "report",
    classification: "internal", includePersonalData: false, idempotencyKey: "export-denied", now,
  }, () => false), /EXPORT_UNAUTHORIZED/);
});

test("verifies exported artifact tenant, classification, hash and expiry against authorization", () => {
  const authorization = authorizeDataExport({
    tenantId: "tenant_a", requestedBy: "analyst", purpose: "report",
    classification: "internal", includePersonalData: false, idempotencyKey: "export-2", now,
  }, () => true);
  const artifact = {
    id: "export_1", tenantId: "tenant_a", classification: "internal" as const,
    contentHash: "d".repeat(64), sizeBytes: 200, createdAt: now.toISOString(),
    expiresAt: "2026-11-10T13:00:00.000Z", includesPersonalData: false,
  };
  assert.equal(verifyExportArtifact(authorization, artifact, "d".repeat(64), now), true);
  assert.throws(() => verifyExportArtifact(authorization, { ...artifact, tenantId: "tenant_b" }, "d".repeat(64), now), /EXPORT_TENANT_MISMATCH/);
  assert.throws(() => verifyExportArtifact(authorization, { ...artifact, includesPersonalData: true }, "d".repeat(64), now), /EXPORT_CLASSIFICATION_MISMATCH/);
  assert.throws(() => verifyExportArtifact(authorization, artifact, "e".repeat(64), now), /EXPORT_INTEGRITY_FAILED/);
});
