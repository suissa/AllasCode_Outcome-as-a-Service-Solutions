import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { parseEntityId } from "../../src/domain/identifiers.ts";
import {
  assessRetention,
  classifyData,
  recordPrivacyConsent,
  validateDataProcessingBasis,
  withdrawPrivacyConsent,
  type ConsentRecord,
  type ConsentStore,
  type DataProcessingRecord,
} from "../../src/domain/privacy-governance.ts";

const now = new Date("2026-11-10T12:00:00.000Z");
const tenantId = parseEntityId("tenant", "tenant_alpha_001");
const evidenceHash = createHash("sha256").update("explicit consent screen capture", "utf8").digest("hex");

class MemoryConsentStore implements ConsentStore {
  records = new Map<string, ConsentRecord>();
  idempotency = new Map<string, ConsentRecord>();
  async getConsent(tenant: string, id: string) { return this.records.get(tenant + ":" + id); }
  async findConsentByIdempotency(tenant: string, key: string) { return this.idempotency.get(tenant + ":" + key); }
  async createConsent(record: ConsentRecord, key: string) {
    this.records.set(record.tenantId + ":" + record.id, record);
    this.idempotency.set(record.tenantId + ":" + key, record);
    return true;
  }
  async commitConsent(updated: ConsentRecord, expectedRevision: number) {
    const key = updated.tenantId + ":" + updated.id;
    const current = this.records.get(key);
    if (!current || current.revision !== expectedRevision) return false;
    this.records.set(key, updated);
    return true;
  }
}

const dependencies = (store: MemoryConsentStore) => ({
  store,
  authorize: async (actor: string, tenant: string, action: string) => actor !== "denied" && tenant === tenantId && action.length > 0,
});

const processing: DataProcessingRecord = {
  id: "processing_1", tenantId, dataSubjectId: "person_1", category: "contact",
  classification: "personal", purpose: "appointment reminders", legalBasis: "consent",
  consentId: "consent_1", createdAt: "2026-11-10T11:00:00.000Z",
  retentionUntil: "2027-11-10T11:00:00.000Z",
};

test("classifies data conservatively with sensitive and personal precedence", () => {
  assert.equal(classifyData({ containsSensitiveData: true, containsPersonalData: false, confidential: false, public: true }), "sensitive");
  assert.equal(classifyData({ containsSensitiveData: false, containsPersonalData: true, confidential: false, public: true }), "personal");
  assert.equal(classifyData({ containsSensitiveData: false, containsPersonalData: false, confidential: true, public: true }), "confidential");
  assert.equal(classifyData({ containsSensitiveData: false, containsPersonalData: false, confidential: false, public: true }), "public");
});

test("records explicit consent with hashed evidence and idempotent storage", async () => {
  const store = new MemoryConsentStore();
  const command = {
    id: "consent_1", tenantId, dataSubjectId: "person_1", actorId: "person_1",
    purpose: "appointment reminders", categories: ["contact", "schedule"],
    decision: "grant" as const, evidenceHash, source: "web" as const,
    idempotencyKey: "consent-grant-1", now,
  };
  const first = await recordPrivacyConsent(command, dependencies(store));
  const replay = await recordPrivacyConsent(command, dependencies(store));
  assert.equal(first.status, "active");
  assert.deepEqual(replay, first);
  assert.equal(first.evidenceHash, evidenceHash);
  assert.equal("rawEvidence" in first, false);
  assert.equal(store.records.size, 1);
});

test("rejects invalid consent payloads, unauthorized actors and conflicting idempotency keys", async () => {
  const store = new MemoryConsentStore();
  const base = {
    id: "consent_1", tenantId, dataSubjectId: "person_1", actorId: "person_1",
    purpose: "appointment reminders", categories: ["contact"], decision: "grant" as const,
    evidenceHash, source: "web" as const, idempotencyKey: "consent-1", now,
  };
  await assert.rejects(() => recordPrivacyConsent({ ...base, evidenceHash: "bad" }, dependencies(store)), /CONSENT_EVIDENCE_HASH_INVALID/);
  await assert.rejects(() => recordPrivacyConsent({ ...base, categories: [] }, dependencies(store)), /CONSENT_CATEGORIES_REQUIRED/);
  await assert.rejects(() => recordPrivacyConsent({ ...base, actorId: "denied" }, dependencies(store)), /PRIVACY_UNAUTHORIZED/);
  await recordPrivacyConsent(base, dependencies(store));
  await assert.rejects(() => recordPrivacyConsent({ ...base, id: "consent_other" }, dependencies(store)), /CONSENT_IDEMPOTENCY_CONFLICT/);
});

test("withdraws consent with authorization, expected revision and immutable audit metadata", async () => {
  const store = new MemoryConsentStore();
  await recordPrivacyConsent({
    id: "consent_1", tenantId, dataSubjectId: "person_1", actorId: "person_1",
    purpose: "appointment reminders", categories: ["contact"], decision: "grant",
    evidenceHash, source: "web", idempotencyKey: "grant", now,
  }, dependencies(store));
  const result = await withdrawPrivacyConsent({
    tenantId, consentId: "consent_1", actorId: "person_1", expectedRevision: 1,
    reason: "No longer needed", now,
  }, dependencies(store));
  assert.equal(result.status, "withdrawn");
  assert.equal(result.revision, 2);
  assert.equal(result.withdrawnBy, "person_1");
  assert.equal(result.withdrawalReason, "No longer needed");
  await assert.rejects(() => withdrawPrivacyConsent({
    tenantId, consentId: "consent_1", actorId: "person_1", expectedRevision: 1, reason: "retry", now,
  }, dependencies(store)), /CONSENT_NOT_ACTIVE|CONSENT_REVISION_CONFLICT/);
});

test("validates personal-data processing only with matching active consent and purpose", async () => {
  const store = new MemoryConsentStore();
  await recordPrivacyConsent({
    id: "consent_1", tenantId, dataSubjectId: "person_1", actorId: "person_1",
    purpose: "appointment reminders", categories: ["contact"], decision: "grant",
    evidenceHash, source: "web", idempotencyKey: "grant", now,
  }, dependencies(store));
  assert.equal(await validateDataProcessingBasis(processing, async (tenant, id) => store.getConsent(tenant, id), now), true);
  await assert.rejects(() => validateDataProcessingBasis({ ...processing, purpose: "marketing" }, async (tenant, id) => store.getConsent(tenant, id), now), /PROCESSING_CONSENT_SCOPE_MISMATCH/);
  await assert.rejects(() => validateDataProcessingBasis({ ...processing, dataSubjectId: "person_2" }, async (tenant, id) => store.getConsent(tenant, id), now), /PROCESSING_CONSENT_SCOPE_MISMATCH/);
  await withdrawPrivacyConsent({ tenantId, consentId: "consent_1", actorId: "person_1", expectedRevision: 1, reason: "withdrawn", now }, dependencies(store));
  await assert.rejects(() => validateDataProcessingBasis(processing, async (tenant, id) => store.getConsent(tenant, id), now), /PROCESSING_CONSENT_INACTIVE/);
});

test("accepts documented non-consent legal bases but rejects inconsistent consent references", async () => {
  const { consentId: _consentId, ...processingWithoutConsent } = processing;
  const record = { ...processingWithoutConsent, legalBasis: "contract" as const };
  assert.equal(await validateDataProcessingBasis(record, async () => undefined, now), true);
  await assert.rejects(() => validateDataProcessingBasis({ ...record, consentId: "consent_1" }, async () => undefined, now), /PROCESSING_CONSENT_REFERENCE_UNEXPECTED/);
  await assert.rejects(() => validateDataProcessingBasis({ ...record, legalBasis: "unknown" as never }, async () => undefined, now), /PROCESSING_LEGAL_BASIS_INVALID/);
});

test("assesses retention due dates, policy limits and legal holds deterministically", () => {
  const result = assessRetention({
    id: "record_1", tenantId, category: "contact", classification: "personal",
    createdAt: "2026-01-01T00:00:00.000Z",
  }, { tenantId, retentionDays: 30, legalHold: false }, now);
  assert.equal(result.status, "deletion_due");
  assert.equal(result.dueAt, "2026-01-31T00:00:00.000Z");
  const held = assessRetention({
    id: "record_2", tenantId, category: "contact", classification: "personal",
    createdAt: "2026-01-01T00:00:00.000Z",
  }, { tenantId, retentionDays: 30, legalHold: true, legalHoldReason: "Litigation hold" }, now);
  assert.equal(held.status, "on_hold");
  assert.equal(held.reason, "LEGAL_HOLD");
});

test("rejects cross-tenant, malformed and inconsistent retention metadata", () => {
  assert.throws(() => assessRetention({
    id: "record_1", tenantId: "tenant_other_001", category: "contact", classification: "personal",
    createdAt: "2026-01-01T00:00:00.000Z",
  }, { tenantId, retentionDays: 30, legalHold: false }, now), /PRIVACY_TENANT_MISMATCH/);
  assert.throws(() => assessRetention({
    id: "record_1", tenantId, category: "contact", classification: "personal", createdAt: "yesterday",
  }, { tenantId, retentionDays: 30, legalHold: false }, now), /RETENTION_RECORD_INVALID/);
  assert.throws(() => assessRetention({
    id: "record_1", tenantId, category: "contact", classification: "personal", createdAt: "2026-01-01T00:00:00.000Z",
  }, { tenantId, retentionDays: 0, legalHold: false }, now), /RETENTION_POLICY_INVALID/);
});

test("rejects future processing, expired retention and missing privacy basis", async () => {
  await assert.rejects(() => validateDataProcessingBasis({ ...processing, createdAt: "2026-11-10T12:01:00.000Z" }, async () => undefined, now), /PROCESSING_TIMESTAMP_FUTURE/);
  await assert.rejects(() => validateDataProcessingBasis({ ...processing, retentionUntil: "2026-11-10T11:00:00.000Z" }, async () => undefined, now), /PROCESSING_RETENTION_EXPIRED/);
  const { consentId: _consentId, legalBasis: _legalBasis, ...withoutBasis } = processing;
  await assert.rejects(() => validateDataProcessingBasis(withoutBasis, async () => undefined, now), /PROCESSING_PRIVACY_BASIS_REQUIRED/);
});
