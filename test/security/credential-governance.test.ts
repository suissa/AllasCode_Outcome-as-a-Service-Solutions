import test from "node:test";
import assert from "node:assert/strict";
import {
  CredentialGovernanceError,
  rotateCredential,
  reviewCredentialAccess,
  type CredentialGovernanceStore,
  type CredentialRecord,
  type CredentialAccessGrant,
  type SecretRotationProvider,
} from "../../src/security/credential-governance.ts";
import type { SecretReference } from "../../src/security/secret-reference.ts";

const now = new Date("2026-11-10T12:00:00.000Z");
const reference: SecretReference = { provider: "vault", key: "tenant-a/payment-api", version: "v1", expiresAt: "2027-01-01T00:00:00.000Z" };
const credential: CredentialRecord = {
  id: "cred_1", tenantId: "tenant_a", ownerActorId: "service_actor", reference,
  scopes: ["payment.read", "payment.write"], status: "active",
  createdAt: "2026-01-01T00:00:00.000Z", rotationDueAt: "2026-11-01T00:00:00.000Z",
  revision: 4,
};
const grant: CredentialAccessGrant = {
  id: "grant_1", tenantId: "tenant_a", actorId: "analyst", credentialId: "cred_1",
  permissions: ["payment.read"], grantedBy: "security_admin", grantedAt: "2026-01-01T00:00:00.000Z",
  revision: 2,
};

class MemoryGovernanceStore implements CredentialGovernanceStore {
  credentials = new Map<string, CredentialRecord>([[credential.tenantId + ":" + credential.id, credential]]);
  grants = new Map<string, CredentialAccessGrant>([[grant.tenantId + ":" + grant.id, grant]]);
  rotations = new Map<string, CredentialRecord>();
  reviews: unknown[] = [];
  async getCredential(tenantId: string, id: string) { return this.credentials.get(tenantId + ":" + id); }
  async findRotation(tenantId: string, key: string) { return this.rotations.get(tenantId + ":" + key); }
  async commitRotation(record: CredentialRecord, expectedRevision: number, idempotencyKey: string) {
    const key = record.tenantId + ":" + record.id;
    const current = this.credentials.get(key);
    if (!current || current.revision !== expectedRevision) return false;
    this.credentials.set(key, record);
    this.rotations.set(record.tenantId + ":" + idempotencyKey, record);
    return true;
  }
  async getGrant(tenantId: string, id: string) { return this.grants.get(tenantId + ":" + id); }
  async commitAccessReview(updated: CredentialAccessGrant, expectedRevision: number, review: unknown) {
    const key = updated.tenantId + ":" + updated.id;
    const current = this.grants.get(key);
    if (!current || current.revision !== expectedRevision) return false;
    this.grants.set(key, updated);
    this.reviews.push(review);
    return true;
  }
}

test("rotates a due credential through the vault without exposing secret material", async () => {
  const store = new MemoryGovernanceStore();
  const calls: string[] = [];
  const vault: SecretRotationProvider = {
    rotate: async (previous, key) => {
      calls.push(key);
      return { provider: previous.provider, key: previous.key, version: "v2", expiresAt: "2027-11-10T12:00:00.000Z" };
    },
  };
  const result = await rotateCredential({
    tenantId: "tenant_a", credentialId: "cred_1", actorId: "security_admin",
    expectedRevision: 4, idempotencyKey: "rotate-cred-1-v2", now,
  }, { store, vault, authorize: async () => true });
  assert.equal(result.reference.version, "v2");
  assert.equal(result.revision, 5);
  assert.equal(result.status, "active");
  assert.deepEqual(calls, ["rotate-cred-1-v2"]);
  assert.ok(!("secret" in result));
  assert.ok(Object.isFrozen(result));
});

test("rotation is idempotent, scoped and requires authorization and revision match", async () => {
  const store = new MemoryGovernanceStore();
  let rotations = 0;
  const deps = { store, vault: { rotate: async (previous: SecretReference) => {
    rotations += 1; return { ...previous, version: "v2", expiresAt: "2027-01-01T00:00:00.000Z" };
  } }, authorize: async () => true };
  const command = { tenantId: "tenant_a", credentialId: "cred_1", actorId: "security_admin", expectedRevision: 4, idempotencyKey: "idem-1", now };
  const first = await rotateCredential(command, deps);
  const replay = await rotateCredential(command, deps);
  assert.deepEqual(replay, first);
  await assert.rejects(() => rotateCredential({ ...command, credentialId: "other" }, deps), /CREDENTIAL_IDEMPOTENCY_CONFLICT/);
  assert.equal(rotations, 1);
  await assert.rejects(() => rotateCredential({ ...command, tenantId: "tenant_b" }, deps), /CREDENTIAL_NOT_FOUND/);
  await assert.rejects(() => rotateCredential({ ...command, actorId: "intruder", idempotencyKey: "idem-denied" }, {
    ...deps, authorize: async () => false,
  }), /CREDENTIAL_UNAUTHORIZED/);
  await assert.rejects(() => rotateCredential({ ...command, expectedRevision: 3, idempotencyKey: "idem-stale" }, deps), /CREDENTIAL_REVISION_CONFLICT/);
});

test("rejects premature rotation, revoked credentials and invalid provider results", async () => {
  const store = new MemoryGovernanceStore();
  const future = { ...credential, rotationDueAt: "2027-01-01T00:00:00.000Z" };
  store.credentials.set("tenant_a:cred_1", future);
  const command = { tenantId: "tenant_a", credentialId: "cred_1", actorId: "security_admin", expectedRevision: 4, idempotencyKey: "early", now };
  const deps = { store, vault: { rotate: async () => ({ ...reference, version: "v2" }) }, authorize: async () => true };
  await assert.rejects(() => rotateCredential(command, deps), /CREDENTIAL_ROTATION_NOT_DUE/);
  store.credentials.set("tenant_a:cred_1", { ...credential, status: "revoked" });
  await assert.rejects(() => rotateCredential({ ...command, idempotencyKey: "revoked" }, deps), /CREDENTIAL_NOT_ROTATABLE/);
  store.credentials.set("tenant_a:cred_1", credential);
  await assert.rejects(() => rotateCredential({ ...command, idempotencyKey: "same-version" }, {
    ...deps, vault: { rotate: async () => ({ ...reference }) },
  }), /CREDENTIAL_ROTATION_RESULT_INVALID/);
});

test("access review requires an independent authorized reviewer and a reason", async () => {
  const store = new MemoryGovernanceStore();
  const decision = await reviewCredentialAccess({
    tenantId: "tenant_a", grantId: "grant_1", reviewerId: "compliance_reviewer",
    decision: "retain", reasonCode: "BUSINESS_NEED_CONFIRMED",
    rationale: "The read-only integration remains required.", expectedRevision: 2, now,
  }, { store, authorize: async () => true });
  assert.equal(decision.grant.permissions[0], "payment.read");
  assert.equal(decision.reviewerId, "compliance_reviewer");
  assert.equal(store.reviews.length, 1);
  await assert.rejects(() => reviewCredentialAccess({
    tenantId: "tenant_a", grantId: "grant_1", reviewerId: "analyst",
    decision: "retain", reasonCode: "OK", rationale: "Self review", expectedRevision: 3, now,
  }, { store, authorize: async () => true }), /ACCESS_REVIEW_INDEPENDENT_REQUIRED/);
  await assert.rejects(() => reviewCredentialAccess({
    tenantId: "tenant_a", grantId: "grant_1", reviewerId: "compliance_reviewer",
    decision: "retain", reasonCode: " ", rationale: " ", expectedRevision: 3, now,
  }, { store, authorize: async () => true }), /ACCESS_REVIEW_REASON_REQUIRED/);
});

test("access review revocation is explicit, versioned and idempotency-safe", async () => {
  const store = new MemoryGovernanceStore();
  const result = await reviewCredentialAccess({
    tenantId: "tenant_a", grantId: "grant_1", reviewerId: "compliance_reviewer",
    decision: "revoke", reasonCode: "NO_LONGER_REQUIRED",
    rationale: "Integration access is no longer needed.", expectedRevision: 2, now,
  }, { store, authorize: async () => true });
  assert.deepEqual(result.grant.permissions, []);
  assert.equal(result.grant.revokedAt, now.toISOString());
  assert.equal(result.grant.revision, 3);
  assert.equal(result.decision, "revoke");
});

test("rejects cross-tenant access reviews, stale revisions, expired grants and invalid scopes", async () => {
  const store = new MemoryGovernanceStore();
  const command = {
    tenantId: "tenant_a", grantId: "grant_1", reviewerId: "compliance_reviewer",
    decision: "retain" as const, reasonCode: "REVIEWED", rationale: "Still required.",
    expectedRevision: 2, now,
  };
  await assert.rejects(() => reviewCredentialAccess({ ...command, tenantId: "tenant_b" }, { store, authorize: async () => true }), /ACCESS_GRANT_NOT_FOUND/);
  await assert.rejects(() => reviewCredentialAccess({ ...command, expectedRevision: 1 }, { store, authorize: async () => true }), /ACCESS_REVIEW_REVISION_CONFLICT/);
  store.grants.set("tenant_a:grant_1", { ...grant, expiresAt: "2026-01-01T00:00:00.000Z" });
  await assert.rejects(() => reviewCredentialAccess(command, { store, authorize: async () => true }), /ACCESS_GRANT_NOT_RETAINABLE/);
  store.grants.set("tenant_a:grant_1", { ...grant, permissions: ["root.secret.export"] });
  await assert.rejects(() => reviewCredentialAccess(command, { store, authorize: async () => true }), /ACCESS_GRANT_SCOPE_INVALID/);
});

test("authorization denial and CAS conflicts do not mutate credential or grant state", async () => {
  const store = new MemoryGovernanceStore();
  const original = store.credentials.get("tenant_a:cred_1");
  await assert.rejects(() => rotateCredential({
    tenantId: "tenant_a", credentialId: "cred_1", actorId: "actor", expectedRevision: 4,
    idempotencyKey: "denied", now,
  }, { store, vault: { rotate: async () => ({ ...reference, version: "v2" }) }, authorize: async () => false }), /CREDENTIAL_UNAUTHORIZED/);
  assert.equal(store.credentials.get("tenant_a:cred_1"), original);
  assert.equal(store.reviews.length, 0);
});
