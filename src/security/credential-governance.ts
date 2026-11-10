import type { SecretReference } from "./secret-reference.ts";

export class CredentialGovernanceError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "CredentialGovernanceError";
  }
}

export type CredentialStatus = "active" | "rotation_due" | "expired" | "revoked";

export interface CredentialRecord {
  id: string;
  tenantId: string;
  ownerActorId: string;
  reference: SecretReference;
  scopes: readonly string[];
  status: CredentialStatus;
  createdAt: string;
  rotationDueAt?: string;
  rotatedAt?: string;
  revokedAt?: string;
  revision: number;
}

export interface CredentialAccessGrant {
  id: string;
  tenantId: string;
  actorId: string;
  credentialId: string;
  permissions: readonly string[];
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  revokedAt?: string;
  revision: number;
}

export interface CredentialRotationReview {
  tenantId: string;
  credentialId: string;
  idempotencyKey: string;
  rotatedBy: string;
  rotatedAt: string;
  previousVersion: string;
  currentVersion: string;
  previousRevision: number;
  revision: number;
}

export interface CredentialAccessReview {
  tenantId: string;
  grantId: string;
  reviewerId: string;
  decision: "retain" | "revoke";
  reasonCode: string;
  rationale: string;
  reviewedAt: string;
  previousRevision: number;
  revision: number;
}

export interface CredentialGovernanceStore {
  getCredential(tenantId: string, id: string): Promise<CredentialRecord | undefined>;
  findRotation(tenantId: string, idempotencyKey: string): Promise<CredentialRecord | undefined>;
  commitRotation(record: CredentialRecord, expectedRevision: number, idempotencyKey: string): Promise<boolean>;
  getGrant(tenantId: string, id: string): Promise<CredentialAccessGrant | undefined>;
  commitAccessReview(updated: CredentialAccessGrant, expectedRevision: number, review: CredentialAccessReview): Promise<boolean>;
}

export interface SecretRotationProvider {
  // The provider rotates the secret in its vault and returns metadata only; secret bytes never cross this boundary.
  // Implementations must honor idempotencyKey and return the same version for a replay.
  rotate(previous: SecretReference, idempotencyKey: string): Promise<SecretReference>;
}

export interface CredentialGovernanceDependencies {
  store: CredentialGovernanceStore;
  authorize(actorId: string, tenantId: string, action: "security.credential.rotate" | "security.access.review"): Promise<boolean>;
}

export interface RotateCredentialInput {
  tenantId: string;
  credentialId: string;
  actorId: string;
  expectedRevision: number;
  idempotencyKey: string;
  now?: Date;
  force?: boolean;
}

export interface ReviewCredentialAccessInput {
  tenantId: string;
  grantId: string;
  reviewerId: string;
  decision: "retain" | "revoke";
  reasonCode: string;
  rationale: string;
  expectedRevision: number;
  now?: Date;
}

const required = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 256;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

const validPermission = (value: string): boolean =>
  /^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)*\.(?:read|write|create|update|delete|execute|approve)$/.test(value);

function fail(code: string, path: string): never {
  throw new CredentialGovernanceError(code, path);
}

function validateReference(reference: SecretReference, now: Date, allowExpired: boolean): void {
  if (!reference || !required(reference.provider) || !required(reference.key) ||
      (reference.version !== undefined && !required(reference.version))) {
    fail("CREDENTIAL_REFERENCE_INVALID", "reference");
  }
  if (reference.expiresAt !== undefined) {
    if (!validTimestamp(reference.expiresAt)) fail("CREDENTIAL_REFERENCE_INVALID", "reference.expiresAt");
    if (!allowExpired && Date.parse(reference.expiresAt) <= now.getTime()) {
      fail("CREDENTIAL_REFERENCE_EXPIRED", "reference.expiresAt");
    }
  }
}

function validateCredential(record: CredentialRecord, now: Date): void {
  if (!record || !required(record.id) || !required(record.tenantId) || !required(record.ownerActorId) ||
      !Array.isArray(record.scopes) || record.scopes.length === 0 ||
      record.scopes.some(scope => !required(scope)) || new Set(record.scopes).size !== record.scopes.length ||
      !Number.isInteger(record.revision) || record.revision < 1 ||
      !["active", "rotation_due", "expired", "revoked"].includes(record.status) ||
      !validTimestamp(record.createdAt) ||
      (record.rotationDueAt !== undefined && !validTimestamp(record.rotationDueAt)) ||
      (record.rotatedAt !== undefined && !validTimestamp(record.rotatedAt)) ||
      (record.revokedAt !== undefined && !validTimestamp(record.revokedAt))) {
    fail("CREDENTIAL_RECORD_INVALID", "credential");
  }
  validateReference(record.reference, now, true);
}

export async function rotateCredential(
  input: RotateCredentialInput,
  dependencies: { store: CredentialGovernanceStore; vault: SecretRotationProvider; authorize: CredentialGovernanceDependencies["authorize"] },
): Promise<Readonly<CredentialRecord>> {
  if (!input || !required(input.tenantId) || !required(input.credentialId) || !required(input.actorId) ||
      !required(input.idempotencyKey) || !Number.isInteger(input.expectedRevision) || input.expectedRevision < 1 ||
      (input.force !== undefined && typeof input.force !== "boolean")) {
    fail("CREDENTIAL_ROTATION_INPUT_INVALID", "input");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("CREDENTIAL_CLOCK_INVALID", "now");
  if (!await dependencies.authorize(input.actorId, input.tenantId, "security.credential.rotate")) {
    fail("CREDENTIAL_UNAUTHORIZED", "actorId");
  }

  const replay = await dependencies.store.findRotation(input.tenantId, input.idempotencyKey);
  if (replay) return Object.freeze({ ...replay, reference: Object.freeze({ ...replay.reference }), scopes: Object.freeze([...replay.scopes]) });

  const current = await dependencies.store.getCredential(input.tenantId, input.credentialId);
  if (!current) fail("CREDENTIAL_NOT_FOUND", "credentialId");
  validateCredential(current, now);
  if (current.tenantId !== input.tenantId) fail("CREDENTIAL_TENANT_MISMATCH", "credential.tenantId");
  if (current.revision !== input.expectedRevision) fail("CREDENTIAL_REVISION_CONFLICT", "expectedRevision");
  if (current.status === "revoked") fail("CREDENTIAL_NOT_ROTATABLE", "credential.status");
  if (current.rotationDueAt && Date.parse(current.rotationDueAt) > now.getTime() && !input.force) {
    fail("CREDENTIAL_ROTATION_NOT_DUE", "credential.rotationDueAt");
  }

  const nextReference = await dependencies.vault.rotate(current.reference, input.idempotencyKey);
  validateReference(nextReference, now, false);
  if (nextReference.provider !== current.reference.provider || nextReference.key !== current.reference.key ||
      !required(nextReference.version) || nextReference.version === current.reference.version) {
    fail("CREDENTIAL_ROTATION_RESULT_INVALID", "vault.result");
  }
  const updated: CredentialRecord = Object.freeze({
    ...current,
    reference: Object.freeze({ ...nextReference }),
    status: "active",
    rotatedAt: now.toISOString(),
    revision: current.revision + 1,
  });
  const committed = await dependencies.store.commitRotation(updated, current.revision, input.idempotencyKey);
  if (!committed) fail("CREDENTIAL_REVISION_CONFLICT", "credential.revision");
  return Object.freeze({ ...updated, scopes: Object.freeze([...updated.scopes]) });
}

export async function reviewCredentialAccess(
  input: ReviewCredentialAccessInput,
  dependencies: CredentialGovernanceDependencies,
): Promise<Readonly<{
  grant: CredentialAccessGrant;
  reviewerId: string;
  decision: "retain" | "revoke";
  reasonCode: string;
  rationale: string;
  reviewedAt: string;
}>> {
  if (!input || !required(input.tenantId) || !required(input.grantId) || !required(input.reviewerId) ||
      (input.decision !== "retain" && input.decision !== "revoke") ||
      !required(input.reasonCode) || !required(input.rationale) ||
      input.reasonCode.length > 128 || input.rationale.length > 2000 ||
      !Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    fail("ACCESS_REVIEW_INPUT_INVALID", "input");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("CREDENTIAL_CLOCK_INVALID", "now");
  if (!await dependencies.authorize(input.reviewerId, input.tenantId, "security.access.review")) {
    fail("ACCESS_REVIEW_UNAUTHORIZED", "reviewerId");
  }
  const current = await dependencies.store.getGrant(input.tenantId, input.grantId);
  if (!current) fail("ACCESS_GRANT_NOT_FOUND", "grantId");
  if (current.tenantId !== input.tenantId) fail("ACCESS_GRANT_TENANT_MISMATCH", "grant.tenantId");
  if (current.revision !== input.expectedRevision) fail("ACCESS_REVIEW_REVISION_CONFLICT", "expectedRevision");
  if (input.reviewerId === current.actorId || input.reviewerId === current.grantedBy) {
    fail("ACCESS_REVIEW_INDEPENDENT_REQUIRED", "reviewerId");
  }
  if (!required(current.actorId) || !required(current.credentialId) || !required(current.grantedBy) ||
      !validTimestamp(current.grantedAt) || !Array.isArray(current.permissions) || current.permissions.length === 0 ||
      current.permissions.some(permission => !validPermission(permission)) ||
      !Number.isInteger(current.revision) || current.revision < 1) {
    fail("ACCESS_GRANT_SCOPE_INVALID", "grant");
  }
  if (input.decision === "retain" &&
      (current.revokedAt !== undefined ||
       (current.expiresAt !== undefined && (!validTimestamp(current.expiresAt) || Date.parse(current.expiresAt) <= now.getTime())))) {
    fail("ACCESS_GRANT_NOT_RETAINABLE", "grant");
  }
  if (current.expiresAt !== undefined && !validTimestamp(current.expiresAt)) {
    fail("ACCESS_GRANT_INVALID", "grant.expiresAt");
  }

  const reviewedAt = now.toISOString();
  const updated: CredentialAccessGrant = Object.freeze({
    ...current,
    permissions: Object.freeze(input.decision === "revoke" ? [] : [...current.permissions]),
    ...(input.decision === "revoke" ? { revokedAt: reviewedAt } : {}),
    revision: current.revision + 1,
  });
  const review: CredentialAccessReview = Object.freeze({
    tenantId: input.tenantId,
    grantId: input.grantId,
    reviewerId: input.reviewerId,
    decision: input.decision,
    reasonCode: input.reasonCode,
    rationale: input.rationale,
    reviewedAt,
    previousRevision: current.revision,
    revision: updated.revision,
  });
  const committed = await dependencies.store.commitAccessReview(updated, current.revision, review);
  if (!committed) fail("ACCESS_REVIEW_REVISION_CONFLICT", "grant.revision");
  return Object.freeze({
    grant: Object.freeze({ ...updated, permissions: Object.freeze([...updated.permissions]) }),
    reviewerId: input.reviewerId,
    decision: input.decision,
    reasonCode: input.reasonCode,
    rationale: input.rationale,
    reviewedAt,
  });
}
