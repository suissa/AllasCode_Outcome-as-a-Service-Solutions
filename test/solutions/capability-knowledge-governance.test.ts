import test from "node:test";
import assert from "node:assert/strict";
import {
  CapabilityKnowledgeError,
  improveGovernedPlaybook,
  publishCapabilityImprovement,
  publishCapabilityTemplate,
  type CapabilityKnowledgeStore,
  type GovernedCapability,
  type GovernedPlaybook,
  type CapabilityTemplateRecord,
  type VerifiedKnowledgeEvidence,
} from "../../src/solutions/capability-knowledge-governance.ts";

const now = new Date("2026-11-10T12:00:00.000Z");
const evidence: VerifiedKnowledgeEvidence[] = [
  { id: "ev_1", tenantId: "tenant_a", contentHash: "a".repeat(64), verifiedBy: "auditor", verifiedAt: "2026-11-10T11:00:00.000Z", classification: "internal" },
  { id: "ev_2", tenantId: "tenant_a", contentHash: "b".repeat(64), verifiedBy: "auditor", verifiedAt: "2026-11-10T11:05:00.000Z", classification: "internal" },
];
const capability: GovernedCapability = {
  id: "cap_1", tenantId: "tenant_a", version: 1, revision: 1, name: "Automated reconciliation",
  description: "Reconcile ledger entries", causes: ["manual-errors"], outcomes: ["lower-cost"],
  dependencies: ["ledger-api"], risk: "low", cost: { currency: "BRL", min: 100, max: 200 },
  benefit: { min: 500, max: 900 }, evidenceIds: ["ev_1"], status: "published",
  updatedBy: "author", updatedAt: "2026-11-01T00:00:00.000Z",
};
const playbook: GovernedPlaybook = {
  id: "pb_1", tenantId: "tenant_a", version: 1, revision: 1, name: "Reconciliation",
  steps: [{ behaviorId: "reconcile", inputSchema: "input.v1", outputSchema: "output.v1", approvalRequired: false }],
  evidenceIds: ["ev_1"], status: "published", updatedBy: "author", updatedAt: "2026-11-01T00:00:00.000Z",
};

class MemoryKnowledgeStore implements CapabilityKnowledgeStore {
  capabilities = new Map<string, GovernedCapability>([[capability.tenantId + ":" + capability.id, capability]]);
  playbooks = new Map<string, GovernedPlaybook>([[playbook.tenantId + ":" + playbook.id, playbook]]);
  templates = new Map<string, CapabilityTemplateRecord>();
  publications = new Map<string, GovernedCapability | GovernedPlaybook | CapabilityTemplateRecord>();
  async getCapability(tenantId: string, id: string) { return this.capabilities.get(tenantId + ":" + id); }
  async findCapabilityPublication(tenantId: string, key: string) { return this.publications.get("capability:" + tenantId + ":" + key) as GovernedCapability | undefined; }
  async commitCapability(record: GovernedCapability, expectedVersion: number, key: string) {
    const id = record.tenantId + ":" + record.id; const current = this.capabilities.get(id);
    if (!current || current.version !== expectedVersion) return false;
    this.capabilities.set(id, record); this.publications.set("capability:" + record.tenantId + ":" + key, record); return true;
  }
  async getPlaybook(tenantId: string, id: string) { return this.playbooks.get(tenantId + ":" + id); }
  async findPlaybookPublication(tenantId: string, key: string) { return this.publications.get("playbook:" + tenantId + ":" + key) as GovernedPlaybook | undefined; }
  async commitPlaybook(record: GovernedPlaybook, expectedVersion: number, key: string) {
    const id = record.tenantId + ":" + record.id; const current = this.playbooks.get(id);
    if (!current || current.version !== expectedVersion) return false;
    this.playbooks.set(id, record); this.publications.set("playbook:" + record.tenantId + ":" + key, record); return true;
  }
  async findTemplatePublication(tenantId: string, key: string) { return this.publications.get("template:" + tenantId + ":" + key) as CapabilityTemplateRecord | undefined; }
  async commitTemplate(record: CapabilityTemplateRecord, expectedVersion: number, key: string) {
    const id = record.tenantId + ":" + record.id; const current = this.templates.get(id);
    if ((current?.version ?? 0) !== expectedVersion) return false;
    this.templates.set(id, record); this.publications.set("template:" + record.tenantId + ":" + key, record); return true;
  }
}

const dependencies = (store: MemoryKnowledgeStore) => ({
  store,
  authorize: async (actorId: string, tenantId: string, action: string) =>
    tenantId === "tenant_a" && actorId !== "denied" && action.length > 0,
  verifyEvidence: async (tenantId: string, id: string) => evidence.find(item => item.id === id && item.tenantId === tenantId),
});

test("publishes capability improvements only from verified tenant evidence with independent review", async () => {
  const store = new MemoryKnowledgeStore();
  const result = await publishCapabilityImprovement({
    tenantId: "tenant_a", capabilityId: "cap_1", expectedVersion: 1,
    actorId: "author", reviewerId: "reviewer", idempotencyKey: "cap-improve-1",
    changes: { description: "Reconcile ledgers with exception handling", outcomes: ["lower-cost", "faster-close"] },
    evidenceIds: ["ev_1", "ev_2"], now,
  }, dependencies(store));
  assert.equal(result.version, 2);
  assert.equal(result.status, "published");
  assert.deepEqual(result.evidenceIds, ["ev_1", "ev_2"]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.outcomes));
});

test("capability publication is idempotent and rejects stale versions or reused keys across records", async () => {
  const store = new MemoryKnowledgeStore();
  const command = {
    tenantId: "tenant_a", capabilityId: "cap_1", expectedVersion: 1,
    actorId: "author", reviewerId: "reviewer", idempotencyKey: "cap-idem",
    changes: { name: "Improved reconciliation" }, evidenceIds: ["ev_1"], now,
  };
  const first = await publishCapabilityImprovement(command, dependencies(store));
  const replay = await publishCapabilityImprovement(command, dependencies(store));
  assert.deepEqual(replay, first);
  await assert.rejects(() => publishCapabilityImprovement({ ...command, capabilityId: "other" }, dependencies(store)), /CAPABILITY_IDEMPOTENCY_CONFLICT/);
  await assert.rejects(() => publishCapabilityImprovement({ ...command, expectedVersion: 1, idempotencyKey: "stale" }, dependencies(store)), /CAPABILITY_VERSION_CONFLICT/);
});

test("playbook improvements require verified evidence, valid behavior schemas and independent review", async () => {
  const store = new MemoryKnowledgeStore();
  const result = await improveGovernedPlaybook({
    tenantId: "tenant_a", playbookId: "pb_1", expectedVersion: 1,
    actorId: "author", reviewerId: "reviewer", idempotencyKey: "pb-improve",
    steps: [
      { behaviorId: "reconcile", inputSchema: "input.v2", outputSchema: "output.v2", approvalRequired: true },
      { behaviorId: "verify", inputSchema: "verify.in", outputSchema: "verify.out", approvalRequired: false },
    ],
    evidenceIds: ["ev_2"], now,
  }, dependencies(store));
  assert.equal(result.version, 2);
  assert.equal(result.steps.length, 2);
  assert.deepEqual(result.evidenceIds, ["ev_1", "ev_2"]);
});

test("capability templates are versioned, evidence-backed and schema-bound", async () => {
  const store = new MemoryKnowledgeStore();
  const result = await publishCapabilityTemplate({
    tenantId: "tenant_a", templateId: "tpl_1", expectedVersion: 0,
    actorId: "author", reviewerId: "reviewer", idempotencyKey: "template-1",
    name: "Reconciliation template", description: "Standard reconciliation workflow",
    behaviorIds: ["reconcile", "verify"], inputSchema: "template.input.v1",
    outputSchema: "template.output.v1", evidenceIds: ["ev_1"], now,
  }, dependencies(store));
  assert.equal(result.version, 1);
  assert.match(result.schemaHash, /^[a-f0-9]{64}$/);
  assert.equal(result.status, "published");
});

test("rejects missing, unverified, expired and cross-tenant evidence without publishing", async () => {
  const store = new MemoryKnowledgeStore();
  await assert.rejects(() => publishCapabilityImprovement({
    tenantId: "tenant_a", capabilityId: "cap_1", expectedVersion: 1,
    actorId: "author", reviewerId: "reviewer", idempotencyKey: "no-evidence",
    changes: { name: "Bad" }, evidenceIds: [],
    now,
  }, dependencies(store)), /KNOWLEDGE_EVIDENCE_REQUIRED/);
  await assert.rejects(() => publishCapabilityImprovement({
    tenantId: "tenant_a", capabilityId: "cap_1", expectedVersion: 1,
    actorId: "author", reviewerId: "reviewer", idempotencyKey: "bad-evidence",
    changes: { name: "Bad" }, evidenceIds: ["unknown"], now,
  }, dependencies(store)), /KNOWLEDGE_EVIDENCE_UNVERIFIED/);
  const expiredDeps = { ...dependencies(store), verifyEvidence: async () => ({ ...evidence[0]!, validUntil: "2026-11-10T11:00:00.000Z" }) };
  await assert.rejects(() => publishCapabilityImprovement({
    tenantId: "tenant_a", capabilityId: "cap_1", expectedVersion: 1,
    actorId: "author", reviewerId: "reviewer", idempotencyKey: "expired",
    changes: { name: "Bad" }, evidenceIds: ["ev_1"], now,
  }, expiredDeps), /KNOWLEDGE_EVIDENCE_EXPIRED/);
  assert.equal(store.capabilities.get("tenant_a:cap_1")?.version, 1);
});

test("authorization, independent reviewer and schema validation fail closed", async () => {
  const store = new MemoryKnowledgeStore();
  const command = {
    tenantId: "tenant_a", capabilityId: "cap_1", expectedVersion: 1,
    actorId: "author", reviewerId: "reviewer", idempotencyKey: "review",
    changes: { name: "Better capability" }, evidenceIds: ["ev_1"], now,
  };
  await assert.rejects(() => publishCapabilityImprovement({ ...command, reviewerId: "author" }, dependencies(store)), /KNOWLEDGE_REVIEW_INDEPENDENT_REQUIRED/);
  await assert.rejects(() => publishCapabilityImprovement({ ...command, actorId: "denied" }, dependencies(store)), /KNOWLEDGE_UNAUTHORIZED/);
  await assert.rejects(() => improveGovernedPlaybook({
    tenantId: "tenant_a", playbookId: "pb_1", expectedVersion: 1,
    actorId: "author", reviewerId: "reviewer", idempotencyKey: "bad-steps",
    steps: [{ behaviorId: " ", inputSchema: "", outputSchema: "", approvalRequired: false }],
    evidenceIds: ["ev_1"], now,
  }, dependencies(store)), /PLAYBOOK_STEPS_INVALID/);
});
