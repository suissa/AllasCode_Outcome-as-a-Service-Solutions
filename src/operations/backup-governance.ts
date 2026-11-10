import { createHash } from "node:crypto";

export class BackupGovernanceError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "BackupGovernanceError";
  }
}

export type BackupEncryptionAlgorithm = "AES-256-GCM" | "XCHACHA20-POLY1305";

export interface BackupManifest {
  id: string;
  tenantId: string;
  scope: readonly string[];
  createdAt: string;
  formatVersion: string;
  contentHash: string;
  sizeBytes: number;
  region: string;
  replicaRegions: readonly string[];
  encryption: { algorithm: BackupEncryptionAlgorithm; keyReference: string };
  consistencyPoint: string;
  retentionUntil: string;
  createdBy: string;
}

export interface DisasterRecoveryPolicy {
  tenantId: string;
  rpoSeconds: number;
  rtoSeconds: number;
  maxRestoreDrillAgeSeconds: number;
  requiredReplicaRegions: readonly string[];
  requireEncryption: boolean;
}

export interface RestoreDrillEvidence {
  id: string;
  tenantId: string;
  backupId: string;
  performedAt: string;
  durationSeconds: number;
  status: "passed" | "failed";
  verifiedBy: string;
}

export interface DisasterRecoveryAssessment {
  tenantId: string;
  status: "ready" | "degraded" | "unavailable";
  latestBackupId?: string;
  backupAgeSeconds: number | null;
  latestRestoreDrillAt?: string;
  restoreDurationSeconds: number | null;
  reasons: readonly string[];
  assessedAt: string;
}

export interface RestorePlan {
  id: string;
  tenantId: string;
  backup: BackupManifest;
  target: "staging" | "production";
  targetId: string;
  actorId: string;
  approvedBy?: string;
  idempotencyKey: string;
  plannedAt: string;
  expectedContentHash: string;
}

export interface RestoreProvider {
  restoreToStaging(backup: BackupManifest, idempotencyKey: string): Promise<{ stageId: string; contentHash: string }>;
  validateStaging(stageId: string, backup: BackupManifest): Promise<{ valid: boolean; tenantId: string; scope: readonly string[] }>;
  promote(stageId: string, target: string): Promise<void>;
  rollback(stageId: string): Promise<void>;
}

export interface ExportAuthorization {
  tenantId: string;
  requestedBy: string;
  purpose: string;
  classification: "public" | "internal" | "confidential" | "personal" | "sensitive";
  includePersonalData: boolean;
  approvedBy?: string;
  idempotencyKey: string;
  authorizedAt: string;
}

export interface ExportArtifact {
  id: string;
  tenantId: string;
  classification: ExportAuthorization["classification"];
  contentHash: string;
  sizeBytes: number;
  createdAt: string;
  expiresAt: string;
  includesPersonalData: boolean;
}

const required = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 512;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function fail(code: string, path: string): never {
  throw new BackupGovernanceError(code, path);
}

export function validateBackupManifest(manifest: BackupManifest, now = new Date()): void {
  if (!manifest || !required(manifest.id) || !required(manifest.tenantId) || !required(manifest.formatVersion) ||
      !required(manifest.region) || !required(manifest.createdBy) || !Array.isArray(manifest.scope) ||
      manifest.scope.length === 0 || manifest.scope.some(item => !required(item)) ||
      new Set(manifest.scope).size !== manifest.scope.length ||
      !Array.isArray(manifest.replicaRegions) || manifest.replicaRegions.some(region => !required(region)) ||
      new Set(manifest.replicaRegions).size !== manifest.replicaRegions.length ||
      !/^[a-f0-9]{64}$/i.test(manifest.contentHash) ||
      !Number.isSafeInteger(manifest.sizeBytes) || manifest.sizeBytes < 1 ||
      !manifest.encryption || !["AES-256-GCM", "XCHACHA20-POLY1305"].includes(manifest.encryption.algorithm) ||
      !required(manifest.encryption.keyReference) ||
      !validTimestamp(manifest.createdAt) || !validTimestamp(manifest.consistencyPoint) ||
      !validTimestamp(manifest.retentionUntil) || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("BACKUP_MANIFEST_INVALID", "manifest");
  }
  if (Date.parse(manifest.createdAt) > now.getTime() ||
      Date.parse(manifest.consistencyPoint) > Date.parse(manifest.createdAt)) {
    fail("BACKUP_TIMESTAMP_INVALID", "createdAt/consistencyPoint");
  }
  if (Date.parse(manifest.retentionUntil) <= now.getTime()) fail("BACKUP_RETENTION_EXPIRED", "retentionUntil");
}

export function verifyBackupArtifact(manifest: BackupManifest, actualHash: string, now = new Date()): boolean {
  validateBackupManifest(manifest, now);
  return /^[a-f0-9]{64}$/i.test(actualHash) && manifest.contentHash.toLowerCase() === actualHash.toLowerCase();
}

export function assessDisasterRecovery(
  policy: DisasterRecoveryPolicy,
  backups: readonly BackupManifest[],
  drills: readonly RestoreDrillEvidence[],
  now = new Date(),
): Readonly<DisasterRecoveryAssessment> {
  if (!policy || !required(policy.tenantId) ||
      !Number.isFinite(policy.rpoSeconds) || policy.rpoSeconds < 1 ||
      !Number.isFinite(policy.rtoSeconds) || policy.rtoSeconds < 1 ||
      !Number.isFinite(policy.maxRestoreDrillAgeSeconds) || policy.maxRestoreDrillAgeSeconds < 1 ||
      !Array.isArray(policy.requiredReplicaRegions) ||
      typeof policy.requireEncryption !== "boolean" ||
      !Array.isArray(backups) || !Array.isArray(drills) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("DR_POLICY_INVALID", "policy");
  }
  const backupIds = new Set<string>();
  for (let index = 0; index < backups.length; index += 1) {
    const item = backups[index]!;
    validateBackupManifest(item, now);
    if (item.tenantId !== policy.tenantId) fail("BACKUP_TENANT_MISMATCH", `backups[${index}].tenantId`);
    if (backupIds.has(item.id)) fail("BACKUP_DUPLICATE", `backups[${index}].id`);
    backupIds.add(item.id);
  }
  const drillIds = new Set<string>();
  for (let index = 0; index < drills.length; index += 1) {
    const drill = drills[index]!;
    if (!drill || !required(drill.id) || !required(drill.backupId) || !required(drill.verifiedBy) ||
        !validTimestamp(drill.performedAt) || !Number.isFinite(drill.durationSeconds) || drill.durationSeconds < 0 ||
        (drill.status !== "passed" && drill.status !== "failed")) fail("RESTORE_DRILL_INVALID", `drills[${index}]`);
    if (drill.tenantId !== policy.tenantId) fail("BACKUP_TENANT_MISMATCH", `drills[${index}].tenantId`);
    if (drillIds.has(drill.id)) fail("RESTORE_DRILL_DUPLICATE", `drills[${index}].id`);
    drillIds.add(drill.id);
    if (!backupIds.has(drill.backupId)) fail("RESTORE_DRILL_BACKUP_UNKNOWN", `drills[${index}].backupId`);
    if (Date.parse(drill.performedAt) > now.getTime()) fail("RESTORE_DRILL_FROM_FUTURE", `drills[${index}].performedAt`);
  }

  const reasons: string[] = [];
  const latest = [...backups].sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt) || a.id.localeCompare(b.id))[0];
  let backupAgeSeconds: number | null = null;
  if (!latest) reasons.push("BACKUP_MISSING");
  else {
    backupAgeSeconds = Math.floor((now.getTime() - Date.parse(latest.createdAt)) / 1000);
    if (backupAgeSeconds > policy.rpoSeconds) reasons.push("RPO_BREACHED");
    if (policy.requireEncryption && !latest.encryption) reasons.push("BACKUP_ENCRYPTION_REQUIRED");
    for (const region of policy.requiredReplicaRegions) {
      if (!latest.replicaRegions.includes(region)) reasons.push("REPLICA_REGION_MISSING");
    }
  }

  const latestDrill = [...drills].sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt) || a.id.localeCompare(b.id))[0];
  let restoreDurationSeconds: number | null = null;
  if (!latestDrill) reasons.push("RESTORE_DRILL_MISSING");
  else {
    restoreDurationSeconds = latestDrill.durationSeconds;
    if (latestDrill.status !== "passed") reasons.push("RESTORE_DRILL_FAILED");
    if (now.getTime() - Date.parse(latestDrill.performedAt) > policy.maxRestoreDrillAgeSeconds * 1000) reasons.push("RESTORE_DRILL_STALE");
    if (latestDrill.durationSeconds > policy.rtoSeconds) reasons.push("RTO_BREACHED");
  }

  const uniqueReasons = [...new Set(reasons)].sort();
  const unavailable = uniqueReasons.includes("BACKUP_MISSING") || uniqueReasons.includes("RPO_BREACHED");
  return Object.freeze({
    tenantId: policy.tenantId,
    status: unavailable ? "unavailable" : uniqueReasons.length ? "degraded" : "ready",
    ...(latest ? { latestBackupId: latest.id } : {}),
    backupAgeSeconds,
    ...(latestDrill ? { latestRestoreDrillAt: latestDrill.performedAt } : {}),
    restoreDurationSeconds,
    reasons: Object.freeze(uniqueReasons),
    assessedAt: now.toISOString(),
  });
}

export function planBackupRestore(
  input: {
    tenantId: string;
    backup: BackupManifest;
    target: "staging" | "production";
    targetId: string;
    actorId: string;
    approvedBy?: string;
    idempotencyKey: string;
    now?: Date;
  },
  authorize: (actorId: string, tenantId: string, action: "backup.restore.staging" | "backup.restore.production") => boolean,
): Readonly<RestorePlan> {
  if (!input || !required(input.tenantId) || !required(input.targetId) || !required(input.actorId) ||
      !required(input.idempotencyKey) || (input.target !== "staging" && input.target !== "production")) {
    fail("RESTORE_PLAN_INVALID", "input");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("BACKUP_CLOCK_INVALID", "now");
  validateBackupManifest(input.backup, now);
  if (input.backup.tenantId !== input.tenantId) fail("BACKUP_TENANT_MISMATCH", "backup.tenantId");
  if (input.target === "production" && (!required(input.approvedBy) || input.approvedBy === input.actorId)) {
    fail("RESTORE_APPROVAL_REQUIRED", "approvedBy");
  }
  const action = input.target === "production" ? "backup.restore.production" : "backup.restore.staging";
  if (!authorize(input.actorId, input.tenantId, action)) fail("RESTORE_UNAUTHORIZED", "actorId");
  return Object.freeze({
    id: `restore:${encodeURIComponent(input.tenantId)}:${encodeURIComponent(input.idempotencyKey)}`,
    tenantId: input.tenantId,
    backup: Object.freeze({ ...input.backup, scope: Object.freeze([...input.backup.scope]), replicaRegions: Object.freeze([...input.backup.replicaRegions]), encryption: Object.freeze({ ...input.backup.encryption }) }),
    target: input.target,
    targetId: input.targetId,
    actorId: input.actorId,
    ...(input.approvedBy ? { approvedBy: input.approvedBy } : {}),
    idempotencyKey: input.idempotencyKey,
    plannedAt: now.toISOString(),
    expectedContentHash: input.backup.contentHash,
  });
}

export async function executeBackupRestore(
  plan: RestorePlan,
  provider: RestoreProvider,
): Promise<Readonly<{ restored: true; tenantId: string; target: string; scope: readonly string[]; stageId: string }>> {
  if (!plan || !required(plan.tenantId) || !required(plan.targetId) || !required(plan.actorId) ||
      !required(plan.idempotencyKey) || !validTimestamp(plan.plannedAt) ||
      (plan.target !== "staging" && plan.target !== "production")) {
    fail("RESTORE_PLAN_INVALID", "plan");
  }
  validateBackupManifest(plan.backup, new Date(plan.plannedAt));
  if (plan.backup.tenantId !== plan.tenantId || plan.expectedContentHash !== plan.backup.contentHash) {
    fail("BACKUP_TENANT_MISMATCH", "plan.backup");
  }
  if (plan.target === "production" && (!required(plan.approvedBy) || plan.approvedBy === plan.actorId)) {
    fail("RESTORE_APPROVAL_REQUIRED", "plan.approvedBy");
  }

  let stageId: string | undefined;
  try {
    const staged = await provider.restoreToStaging(plan.backup, plan.idempotencyKey);
    if (!required(staged.stageId)) fail("RESTORE_STAGE_INVALID", "stageId");
    stageId = staged.stageId;
    if (!verifyBackupArtifact(plan.backup, staged.contentHash, new Date(plan.plannedAt))) {
      fail("RESTORE_INTEGRITY_FAILED", "staged.contentHash");
    }
    const validation = await provider.validateStaging(stageId, plan.backup);
    const expectedScope = [...plan.backup.scope].sort();
    const actualScope = [...validation.scope].sort();
    if (!validation.valid || validation.tenantId !== plan.tenantId ||
        expectedScope.length !== actualScope.length || expectedScope.some((value, index) => value !== actualScope[index])) {
      fail("RESTORE_SCOPE_MISMATCH", "staged.validation");
    }
    await provider.promote(stageId, plan.targetId);
    return Object.freeze({ restored: true, tenantId: plan.tenantId, target: plan.targetId, scope: Object.freeze([...expectedScope]), stageId });
  } catch (error) {
    if (stageId) {
      try { await provider.rollback(stageId); }
      catch { fail("RESTORE_ROLLBACK_FAILED", "stageId"); }
    }
    if (error instanceof BackupGovernanceError) throw error;
    fail("RESTORE_EXECUTION_FAILED", "provider");
  }
}

export function authorizeDataExport(
  request: {
    tenantId: string;
    requestedBy: string;
    purpose: string;
    classification: ExportAuthorization["classification"];
    includePersonalData: boolean;
    approvedBy?: string;
    idempotencyKey: string;
    now?: Date;
  },
  authorize: (actorId: string, tenantId: string, action: "data.export" | "data.export.personal") => boolean,
): Readonly<ExportAuthorization> {
  if (!request || !required(request.tenantId) || !required(request.requestedBy) ||
      !required(request.purpose) || !required(request.idempotencyKey) ||
      !["public", "internal", "confidential", "personal", "sensitive"].includes(request.classification) ||
      typeof request.includePersonalData !== "boolean") fail("EXPORT_REQUEST_INVALID", "request");
  const now = request.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("BACKUP_CLOCK_INVALID", "now");
  const personalClass = request.classification === "personal" || request.classification === "sensitive";
  if (personalClass !== request.includePersonalData) fail("EXPORT_CLASSIFICATION_MISMATCH", "classification");
  if (request.includePersonalData && (!required(request.approvedBy) || request.approvedBy === request.requestedBy)) {
    fail("EXPORT_APPROVAL_INDEPENDENT_REQUIRED", "approvedBy");
  }
  const action = request.includePersonalData ? "data.export.personal" : "data.export";
  if (!authorize(request.requestedBy, request.tenantId, action)) fail("EXPORT_UNAUTHORIZED", "requestedBy");
  return Object.freeze({
    tenantId: request.tenantId, requestedBy: request.requestedBy, purpose: request.purpose,
    classification: request.classification, includePersonalData: request.includePersonalData,
    ...(request.approvedBy ? { approvedBy: request.approvedBy } : {}),
    idempotencyKey: request.idempotencyKey, authorizedAt: now.toISOString(),
  });
}

export function verifyExportArtifact(
  authorization: ExportAuthorization,
  artifact: ExportArtifact,
  actualHash: string,
  now = new Date(),
): boolean {
  if (!authorization || !artifact || !required(artifact.id) || !required(artifact.tenantId) ||
      !validTimestamp(artifact.createdAt) || !validTimestamp(artifact.expiresAt) ||
      !Number.isSafeInteger(artifact.sizeBytes) || artifact.sizeBytes < 1 ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) fail("EXPORT_ARTIFACT_INVALID", "artifact");
  if (artifact.tenantId !== authorization.tenantId) fail("EXPORT_TENANT_MISMATCH", "artifact.tenantId");
  if (artifact.classification !== authorization.classification ||
      artifact.includesPersonalData !== authorization.includePersonalData) fail("EXPORT_CLASSIFICATION_MISMATCH", "artifact.classification");
  if (Date.parse(artifact.createdAt) > now.getTime() || Date.parse(artifact.expiresAt) <= now.getTime() ||
      Date.parse(artifact.expiresAt) <= Date.parse(artifact.createdAt)) fail("EXPORT_ARTIFACT_EXPIRED", "artifact.expiresAt");
  if (!/^[a-f0-9]{64}$/i.test(artifact.contentHash) || !/^[a-f0-9]{64}$/i.test(actualHash) ||
      artifact.contentHash.toLowerCase() !== actualHash.toLowerCase()) fail("EXPORT_INTEGRITY_FAILED", "artifact.contentHash");
  return true;
}
