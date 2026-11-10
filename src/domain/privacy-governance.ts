import type { DataClass } from "./privacy.ts";
import type { WorkspaceTenantId } from "./workspace-isolation.ts";

export class PrivacyGovernanceError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "PrivacyGovernanceError";
  }
}

export type ConsentSource = "web" | "api" | "conversation" | "paper" | "signed_document";
export type ConsentStatus = "active" | "withdrawn" | "denied" | "expired";
export type ProcessingLegalBasis = "consent" | "contract" | "legal_obligation" | "legitimate_interest" | "vital_interest" | "public_task";

export interface GovernedPrivacyConsentRecord {
  id: string;
  tenantId: WorkspaceTenantId;
  dataSubjectId: string;
  purpose: string;
  categories: readonly string[];
  decision: "grant" | "deny";
  status: ConsentStatus;
  evidenceHash: string;
  source: ConsentSource;
  grantedAt: string;
  expiresAt?: string;
  revision: number;
  recordedBy: string;
  withdrawnAt?: string;
  withdrawnBy?: string;
  withdrawalReason?: string;
}

export interface ConsentStore {
  getConsent(tenantId: string, id: string): Promise<GovernedPrivacyConsentRecord | undefined>;
  findConsentByIdempotency(tenantId: string, key: string): Promise<GovernedPrivacyConsentRecord | undefined>;
  createConsent(record: GovernedPrivacyConsentRecord, idempotencyKey: string): Promise<boolean>;
  commitConsent(updated: GovernedPrivacyConsentRecord, expectedRevision: number): Promise<boolean>;
}

export interface DataProcessingRecord {
  id: string;
  tenantId: WorkspaceTenantId;
  dataSubjectId: string;
  category: string;
  classification: DataClass;
  purpose: string;
  legalBasis?: ProcessingLegalBasis;
  consentId?: string;
  createdAt: string;
  retentionUntil?: string;
}

export interface RetentionPolicy {
  tenantId: WorkspaceTenantId;
  retentionDays: number;
  legalHold: boolean;
  legalHoldReason?: string;
}

export interface RetentionAssessment {
  tenantId: WorkspaceTenantId;
  recordId: string;
  classification: DataClass;
  status: "retained" | "deletion_due" | "on_hold";
  dueAt: string;
  assessedAt: string;
  reason: "WITHIN_RETENTION" | "RETENTION_EXPIRED" | "LEGAL_HOLD";
}

const required = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 512;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

const DATA_CLASSES = new Set<DataClass>(["public", "internal", "confidential", "personal", "sensitive"]);
const LEGAL_BASES = new Set<ProcessingLegalBasis>(["consent", "contract", "legal_obligation", "legitimate_interest", "vital_interest", "public_task"]);
const CONSENT_SOURCES = new Set<ConsentSource>(["web", "api", "conversation", "paper", "signed_document"]);

function fail(code: string, path: string): never {
  throw new PrivacyGovernanceError(code, path);
}

function validateTenantId(tenantId: unknown): void {
  if (typeof tenantId !== "string" || !/^tenant_[a-z0-9]+(?:_[a-z0-9]+)*$/.test(tenantId) ||
      tenantId.slice("tenant_".length).length < 3 || tenantId.slice("tenant_".length).length > 64) {
    fail("PRIVACY_TENANT_INVALID", "tenantId");
  }
}

export function classifyData(signals: {
  containsSensitiveData: boolean;
  containsPersonalData: boolean;
  confidential: boolean;
  public: boolean;
}): DataClass {
  if (!signals || Object.values(signals).some(value => typeof value !== "boolean")) {
    fail("DATA_CLASSIFICATION_SIGNALS_INVALID", "signals");
  }
  if (signals.containsSensitiveData) return "sensitive";
  if (signals.containsPersonalData) return "personal";
  if (signals.confidential) return "confidential";
  if (signals.public) return "public";
  return "internal";
}

export async function recordPrivacyConsent(
  input: {
    id: string;
    tenantId: WorkspaceTenantId;
    dataSubjectId: string;
    actorId: string;
    purpose: string;
    categories: readonly string[];
    decision: "grant" | "deny";
    evidenceHash: string;
    source: ConsentSource;
    idempotencyKey: string;
    expiresAt?: string;
    now?: Date;
  },
  dependencies: {
    store: ConsentStore;
    authorize(actorId: string, tenantId: WorkspaceTenantId, action: "privacy.consent.record"): Promise<boolean>;
  },
): Promise<Readonly<GovernedPrivacyConsentRecord>> {
  if (!input || !required(input.id) || !required(input.dataSubjectId) || !required(input.actorId) ||
      !required(input.purpose) || !required(input.idempotencyKey) ||
      !Array.isArray(input.categories) || input.categories.length === 0 ||
      input.categories.some(category => !required(category)) ||
      new Set(input.categories).size !== input.categories.length ||
      (input.decision !== "grant" && input.decision !== "deny") ||
      !/^[a-f0-9]{64}$/i.test(input.evidenceHash) || !CONSENT_SOURCES.has(input.source)) {
    if (input && (!/^[a-f0-9]{64}$/i.test(input.evidenceHash))) fail("CONSENT_EVIDENCE_HASH_INVALID", "evidenceHash");
    if (input && (!Array.isArray(input.categories) || input.categories.length === 0)) fail("CONSENT_CATEGORIES_REQUIRED", "categories");
    fail("CONSENT_INPUT_INVALID", "input");
  }
  validateTenantId(input.tenantId);
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("PRIVACY_CLOCK_INVALID", "now");
  if (input.expiresAt !== undefined &&
      (!validTimestamp(input.expiresAt) || Date.parse(input.expiresAt) <= now.getTime())) {
    fail("CONSENT_EXPIRY_INVALID", "expiresAt");
  }
  if (!await dependencies.authorize(input.actorId, input.tenantId, "privacy.consent.record")) {
    fail("PRIVACY_UNAUTHORIZED", "actorId");
  }
  const replay = await dependencies.store.findConsentByIdempotency(input.tenantId, input.idempotencyKey);
  if (replay) {
    if (replay.id !== input.id || replay.dataSubjectId !== input.dataSubjectId || replay.evidenceHash !== input.evidenceHash) {
      fail("CONSENT_IDEMPOTENCY_CONFLICT", "idempotencyKey");
    }
    return Object.freeze({ ...replay, categories: Object.freeze([...replay.categories]) });
  }
  const record: GovernedPrivacyConsentRecord = Object.freeze({
    id: input.id, tenantId: input.tenantId, dataSubjectId: input.dataSubjectId,
    purpose: input.purpose, categories: Object.freeze([...input.categories].sort()),
    decision: input.decision, status: input.decision === "grant" ? "active" : "denied",
    evidenceHash: input.evidenceHash, source: input.source, grantedAt: now.toISOString(),
    ...(input.expiresAt ? { expiresAt: input.expiresAt } : {}),
    revision: 1, recordedBy: input.actorId,
  });
  if (!await dependencies.store.createConsent(record, input.idempotencyKey)) {
    fail("CONSENT_IDEMPOTENCY_CONFLICT", "idempotencyKey");
  }
  return record;
}

export async function withdrawPrivacyConsent(
  input: {
    tenantId: WorkspaceTenantId;
    consentId: string;
    actorId: string;
    expectedRevision: number;
    reason: string;
    now?: Date;
  },
  dependencies: {
    store: ConsentStore;
    authorize(actorId: string, tenantId: WorkspaceTenantId, action: "privacy.consent.withdraw"): Promise<boolean>;
  },
): Promise<Readonly<GovernedPrivacyConsentRecord>> {
  if (!input || !required(input.consentId) || !required(input.actorId) || !required(input.reason) ||
      !Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) fail("CONSENT_WITHDRAWAL_INPUT_INVALID", "input");
  validateTenantId(input.tenantId);
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("PRIVACY_CLOCK_INVALID", "now");
  if (!await dependencies.authorize(input.actorId, input.tenantId, "privacy.consent.withdraw")) fail("PRIVACY_UNAUTHORIZED", "actorId");
  const current = await dependencies.store.getConsent(input.tenantId, input.consentId);
  if (!current) fail("CONSENT_NOT_FOUND", "consentId");
  if (current.tenantId !== input.tenantId) fail("PRIVACY_TENANT_MISMATCH", "consent.tenantId");
  if (current.status !== "active") fail("CONSENT_NOT_ACTIVE", "consent.status");
  if (current.revision !== input.expectedRevision) fail("CONSENT_REVISION_CONFLICT", "expectedRevision");
  const updated: GovernedPrivacyConsentRecord = Object.freeze({
    ...current, status: "withdrawn", withdrawnAt: now.toISOString(),
    withdrawnBy: input.actorId, withdrawalReason: input.reason, revision: current.revision + 1,
  });
  if (!await dependencies.store.commitConsent(updated, current.revision)) fail("CONSENT_REVISION_CONFLICT", "consent.revision");
  return updated;
}

export async function validateDataProcessingBasis(
  record: DataProcessingRecord,
  findConsent: (tenantId: string, consentId: string) => Promise<GovernedPrivacyConsentRecord | undefined>,
  now = new Date(),
): Promise<true> {
  if (!record || !required(record.id) || !required(record.dataSubjectId) || !required(record.category) ||
      !required(record.purpose) || !DATA_CLASSES.has(record.classification) ||
      !validTimestamp(record.createdAt) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) fail("PROCESSING_RECORD_INVALID", "record");
  validateTenantId(record.tenantId);
  if (Date.parse(record.createdAt) > now.getTime()) fail("PROCESSING_TIMESTAMP_FUTURE", "createdAt");
  if (record.retentionUntil !== undefined) {
    if (!validTimestamp(record.retentionUntil)) fail("PROCESSING_RETENTION_INVALID", "retentionUntil");
    if (Date.parse(record.retentionUntil) <= now.getTime()) fail("PROCESSING_RETENTION_EXPIRED", "retentionUntil");
    if (Date.parse(record.retentionUntil) <= Date.parse(record.createdAt)) fail("PROCESSING_RETENTION_INVALID", "retentionUntil");
  }
  if (record.legalBasis !== undefined && !LEGAL_BASES.has(record.legalBasis)) {
    fail("PROCESSING_LEGAL_BASIS_INVALID", "legalBasis");
  }
  const requiresBasis = record.classification === "personal" || record.classification === "sensitive";
  if (requiresBasis && !record.legalBasis) fail("PROCESSING_PRIVACY_BASIS_REQUIRED", "legalBasis");
  if (record.legalBasis === "consent") {
    if (!required(record.consentId)) fail("PROCESSING_CONSENT_REQUIRED", "consentId");
    const consent = await findConsent(record.tenantId, record.consentId);
    if (!consent) fail("PROCESSING_CONSENT_NOT_FOUND", "consentId");
    if (consent.tenantId !== record.tenantId || consent.dataSubjectId !== record.dataSubjectId ||
        consent.purpose !== record.purpose || !consent.categories.includes(record.category)) {
      fail("PROCESSING_CONSENT_SCOPE_MISMATCH", "consentId");
    }
    if (consent.status !== "active" ||
        (consent.expiresAt !== undefined && Date.parse(consent.expiresAt) <= now.getTime()) ||
        Date.parse(consent.grantedAt) > Date.parse(record.createdAt)) {
      fail("PROCESSING_CONSENT_INACTIVE", "consentId");
    }
  } else if (record.consentId !== undefined) {
    fail("PROCESSING_CONSENT_REFERENCE_UNEXPECTED", "consentId");
  }
  return true;
}

export function assessRetention(
  record: {
    id: string;
    tenantId: WorkspaceTenantId;
    category: string;
    classification: DataClass;
    createdAt: string;
    retentionUntil?: string;
  },
  policy: RetentionPolicy,
  now = new Date(),
): Readonly<RetentionAssessment> {
  if (!record || !required(record.id) || !required(record.category) ||
      !DATA_CLASSES.has(record.classification) || !validTimestamp(record.createdAt) ||
      !policy || typeof policy.legalHold !== "boolean" ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("RETENTION_RECORD_INVALID", "record");
  }
  if (!Number.isInteger(policy.retentionDays) || policy.retentionDays < 1 || policy.retentionDays > 36500) {
    fail("RETENTION_POLICY_INVALID", "retentionDays");
  }
  validateTenantId(record.tenantId);
  validateTenantId(policy.tenantId);
  if (record.tenantId !== policy.tenantId) fail("PRIVACY_TENANT_MISMATCH", "record.tenantId");
  if (Date.parse(record.createdAt) > now.getTime()) fail("RETENTION_TIMESTAMP_FUTURE", "createdAt");
  if (policy.legalHold && !required(policy.legalHoldReason)) fail("RETENTION_POLICY_INVALID", "legalHoldReason");
  if (record.retentionUntil !== undefined &&
      (!validTimestamp(record.retentionUntil) || Date.parse(record.retentionUntil) <= Date.parse(record.createdAt))) {
    fail("RETENTION_DATE_INVALID", "retentionUntil");
  }
  const dueAt = record.retentionUntil ??
    new Date(Date.parse(record.createdAt) + policy.retentionDays * 86400_000).toISOString();
  const status = policy.legalHold ? "on_hold" : Date.parse(dueAt) <= now.getTime() ? "deletion_due" : "retained";
  const reason = policy.legalHold ? "LEGAL_HOLD" : status === "deletion_due" ? "RETENTION_EXPIRED" : "WITHIN_RETENTION";
  return Object.freeze({
    tenantId: record.tenantId, recordId: record.id, classification: record.classification,
    status, dueAt, assessedAt: now.toISOString(), reason,
  });
}
