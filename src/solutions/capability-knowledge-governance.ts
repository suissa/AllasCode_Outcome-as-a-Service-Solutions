import { createHash } from "node:crypto";

export class CapabilityKnowledgeError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "CapabilityKnowledgeError";
  }
}

export interface VerifiedKnowledgeEvidence {
  id: string;
  tenantId: string;
  contentHash: string;
  verifiedBy: string;
  verifiedAt: string;
  classification: "public" | "internal" | "confidential" | "personal";
  validUntil?: string;
}

export interface GovernedCapability {
  id: string;
  tenantId: string;
  version: number;
  revision: number;
  name: string;
  description: string;
  causes: readonly string[];
  outcomes: readonly string[];
  dependencies: readonly string[];
  risk: "low" | "medium" | "high";
  cost: { currency: string; min: number; max: number };
  benefit: { min: number; max: number };
  evidenceIds: readonly string[];
  status: "published";
  updatedBy: string;
  updatedAt: string;
}

export interface GovernedPlaybookStep {
  behaviorId: string;
  inputSchema: string;
  outputSchema: string;
  approvalRequired: boolean;
}

export interface GovernedPlaybook {
  id: string;
  tenantId: string;
  version: number;
  revision: number;
  name: string;
  steps: readonly GovernedPlaybookStep[];
  evidenceIds: readonly string[];
  status: "published";
  updatedBy: string;
  updatedAt: string;
}

export interface CapabilityTemplateRecord {
  id: string;
  tenantId: string;
  version: number;
  revision: number;
  name: string;
  description: string;
  behaviorIds: readonly string[];
  inputSchema: string;
  outputSchema: string;
  schemaHash: string;
  evidenceIds: readonly string[];
  status: "published";
  updatedBy: string;
  updatedAt: string;
}

export interface CapabilityKnowledgeStore {
  getCapability(tenantId: string, id: string): Promise<GovernedCapability | undefined>;
  findCapabilityPublication(tenantId: string, key: string): Promise<GovernedCapability | undefined>;
  commitCapability(record: GovernedCapability, expectedVersion: number, key: string): Promise<boolean>;
  getPlaybook(tenantId: string, id: string): Promise<GovernedPlaybook | undefined>;
  findPlaybookPublication(tenantId: string, key: string): Promise<GovernedPlaybook | undefined>;
  commitPlaybook(record: GovernedPlaybook, expectedVersion: number, key: string): Promise<boolean>;
  findTemplatePublication(tenantId: string, key: string): Promise<CapabilityTemplateRecord | undefined>;
  commitTemplate(record: CapabilityTemplateRecord, expectedVersion: number, key: string): Promise<boolean>;
}

export interface CapabilityKnowledgeDependencies {
  store: CapabilityKnowledgeStore;
  authorize(actorId: string, tenantId: string, action: "capability.update" | "capability.review" | "playbook.update" | "playbook.review" | "template.publish" | "template.review"): Promise<boolean>;
  verifyEvidence(tenantId: string, evidenceId: string): Promise<VerifiedKnowledgeEvidence | undefined>;
}

const required = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 2000;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function fail(code: string, path: string): never {
  throw new CapabilityKnowledgeError(code, path);
}

async function authorizePublication(
  tenantId: string,
  actorId: string,
  reviewerId: string,
  updateAction: Parameters<CapabilityKnowledgeDependencies["authorize"]>[2],
  reviewAction: Parameters<CapabilityKnowledgeDependencies["authorize"]>[2],
  dependencies: CapabilityKnowledgeDependencies,
): Promise<void> {
  if (!required(tenantId) || !required(actorId) || !required(reviewerId)) fail("KNOWLEDGE_INPUT_INVALID", "identity");
  if (actorId === reviewerId) fail("KNOWLEDGE_REVIEW_INDEPENDENT_REQUIRED", "reviewerId");
  if (!await dependencies.authorize(actorId, tenantId, updateAction) ||
      !await dependencies.authorize(reviewerId, tenantId, reviewAction)) {
    fail("KNOWLEDGE_UNAUTHORIZED", "actor/reviewer");
  }
}

async function verifyEvidenceSet(
  tenantId: string,
  actorId: string,
  evidenceIds: readonly string[],
  now: Date,
  verify: CapabilityKnowledgeDependencies["verifyEvidence"],
): Promise<readonly string[]> {
  if (!Array.isArray(evidenceIds) || evidenceIds.length === 0) fail("KNOWLEDGE_EVIDENCE_REQUIRED", "evidenceIds");
  if (evidenceIds.some(id => !required(id)) || new Set(evidenceIds).size !== evidenceIds.length) {
    fail("KNOWLEDGE_EVIDENCE_INVALID", "evidenceIds");
  }
  for (const id of evidenceIds) {
    const evidence = await verify(tenantId, id);
    if (!evidence || evidence.id !== id) fail("KNOWLEDGE_EVIDENCE_UNVERIFIED", `evidenceIds.${id}`);
    if (evidence.tenantId !== tenantId) fail("KNOWLEDGE_EVIDENCE_TENANT_MISMATCH", `evidenceIds.${id}.tenantId`);
    if (!/^[a-f0-9]{64}$/i.test(evidence.contentHash) || !required(evidence.verifiedBy) ||
        !validTimestamp(evidence.verifiedAt) || Date.parse(evidence.verifiedAt) > now.getTime()) {
      fail("KNOWLEDGE_EVIDENCE_UNVERIFIED", `evidenceIds.${id}`);
    }
    if (evidence.verifiedBy === actorId) fail("KNOWLEDGE_EVIDENCE_REVIEW_REQUIRED", `evidenceIds.${id}.verifiedBy`);
    if (evidence.validUntil !== undefined &&
        (!validTimestamp(evidence.validUntil) || Date.parse(evidence.validUntil) <= now.getTime())) {
      fail("KNOWLEDGE_EVIDENCE_EXPIRED", `evidenceIds.${id}.validUntil`);
    }
  }
  return Object.freeze([...evidenceIds].sort());
}

function validateRange(value: { min: number; max: number }, path: string): void {
  if (!value || !Number.isFinite(value.min) || !Number.isFinite(value.max) || value.min < 0 || value.max < value.min) {
    fail("CAPABILITY_RANGE_INVALID", path);
  }
}

export async function publishCapabilityImprovement(
  input: {
    tenantId: string;
    capabilityId: string;
    expectedVersion: number;
    actorId: string;
    reviewerId: string;
    idempotencyKey: string;
    changes: Partial<Pick<GovernedCapability, "name" | "description" | "causes" | "outcomes" | "dependencies" | "risk" | "cost" | "benefit">>;
    evidenceIds: readonly string[];
    now?: Date;
  },
  dependencies: CapabilityKnowledgeDependencies,
): Promise<Readonly<GovernedCapability>> {
  if (!input || !required(input.capabilityId) || !required(input.idempotencyKey) ||
      !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      !input.changes || Object.keys(input.changes).length === 0) fail("CAPABILITY_IMPROVEMENT_INPUT_INVALID", "input");
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("KNOWLEDGE_CLOCK_INVALID", "now");
  await authorizePublication(input.tenantId, input.actorId, input.reviewerId, "capability.update", "capability.review", dependencies);
  const replay = await dependencies.store.findCapabilityPublication(input.tenantId, input.idempotencyKey);
  if (replay) {
    if (replay.id !== input.capabilityId) fail("CAPABILITY_IDEMPOTENCY_CONFLICT", "idempotencyKey");
    return replay;
  }
  const current = await dependencies.store.getCapability(input.tenantId, input.capabilityId);
  if (!current) fail("CAPABILITY_NOT_FOUND", "capabilityId");
  if (current.tenantId !== input.tenantId) fail("CAPABILITY_TENANT_MISMATCH", "capability.tenantId");
  if (current.version !== input.expectedVersion) fail("CAPABILITY_VERSION_CONFLICT", "expectedVersion");
  const evidenceIds = await verifyEvidenceSet(input.tenantId, input.actorId, input.evidenceIds, now, dependencies.verifyEvidence);
  const changes = input.changes;
  const next = {
    ...current,
    ...changes,
    causes: Object.freeze([...(changes.causes ?? current.causes)]),
    outcomes: Object.freeze([...(changes.outcomes ?? current.outcomes)]),
    dependencies: Object.freeze([...(changes.dependencies ?? current.dependencies)]),
    cost: Object.freeze({ ...(changes.cost ?? current.cost) }),
    benefit: Object.freeze({ ...(changes.benefit ?? current.benefit) }),
    evidenceIds: Object.freeze([...new Set([...current.evidenceIds, ...evidenceIds])].sort()),
    version: current.version + 1,
    revision: current.revision + 1,
    status: "published" as const,
    updatedBy: input.actorId,
    updatedAt: now.toISOString(),
  };
  if (!required(next.name) || !required(next.description) ||
      next.causes.some(item => !required(item)) || next.outcomes.some(item => !required(item)) ||
      next.dependencies.some(item => !required(item)) ||
      !["low", "medium", "high"].includes(next.risk) || !required(next.cost.currency)) {
    fail("CAPABILITY_IMPROVEMENT_INVALID", "changes");
  }
  validateRange(next.cost, "cost");
  validateRange(next.benefit, "benefit");
  if (!await dependencies.store.commitCapability(Object.freeze(next), current.version, input.idempotencyKey)) {
    fail("CAPABILITY_VERSION_CONFLICT", "capability.version");
  }
  return Object.freeze(next);
}

export async function improveGovernedPlaybook(
  input: {
    tenantId: string;
    playbookId: string;
    expectedVersion: number;
    actorId: string;
    reviewerId: string;
    idempotencyKey: string;
    steps: readonly GovernedPlaybookStep[];
    evidenceIds: readonly string[];
    now?: Date;
  },
  dependencies: CapabilityKnowledgeDependencies,
): Promise<Readonly<GovernedPlaybook>> {
  if (!input || !required(input.playbookId) || !required(input.idempotencyKey) ||
      !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1 ||
      !Array.isArray(input.steps) || input.steps.length === 0) fail("PLAYBOOK_IMPROVEMENT_INPUT_INVALID", "input");
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("KNOWLEDGE_CLOCK_INVALID", "now");
  await authorizePublication(input.tenantId, input.actorId, input.reviewerId, "playbook.update", "playbook.review", dependencies);
  const replay = await dependencies.store.findPlaybookPublication(input.tenantId, input.idempotencyKey);
  if (replay) {
    if (replay.id !== input.playbookId) fail("PLAYBOOK_IDEMPOTENCY_CONFLICT", "idempotencyKey");
    return replay;
  }
  const current = await dependencies.store.getPlaybook(input.tenantId, input.playbookId);
  if (!current) fail("PLAYBOOK_NOT_FOUND", "playbookId");
  if (current.tenantId !== input.tenantId) fail("PLAYBOOK_TENANT_MISMATCH", "playbook.tenantId");
  if (current.version !== input.expectedVersion) fail("PLAYBOOK_VERSION_CONFLICT", "expectedVersion");
  const evidenceIds = await verifyEvidenceSet(input.tenantId, input.actorId, input.evidenceIds, now, dependencies.verifyEvidence);
  const behaviorIds = new Set<string>();
  for (const [index, step] of input.steps.entries()) {
    if (!step || !required(step.behaviorId) || !required(step.inputSchema) || !required(step.outputSchema) ||
        typeof step.approvalRequired !== "boolean" || behaviorIds.has(step.behaviorId)) {
      fail("PLAYBOOK_STEPS_INVALID", `steps[${index}]`);
    }
    behaviorIds.add(step.behaviorId);
  }
  const next: GovernedPlaybook = Object.freeze({
    ...current,
    steps: Object.freeze(input.steps.map(step => Object.freeze({ ...step }))),
    evidenceIds: Object.freeze([...new Set([...current.evidenceIds, ...evidenceIds])].sort()),
    version: current.version + 1,
    revision: current.revision + 1,
    status: "published",
    updatedBy: input.actorId,
    updatedAt: now.toISOString(),
  });
  if (!await dependencies.store.commitPlaybook(next, current.version, input.idempotencyKey)) {
    fail("PLAYBOOK_VERSION_CONFLICT", "playbook.version");
  }
  return next;
}

export async function publishCapabilityTemplate(
  input: {
    tenantId: string;
    templateId: string;
    expectedVersion: number;
    actorId: string;
    reviewerId: string;
    idempotencyKey: string;
    name: string;
    description: string;
    behaviorIds: readonly string[];
    inputSchema: string;
    outputSchema: string;
    evidenceIds: readonly string[];
    now?: Date;
  },
  dependencies: CapabilityKnowledgeDependencies,
): Promise<Readonly<CapabilityTemplateRecord>> {
  if (!input || !required(input.templateId) || !required(input.idempotencyKey) ||
      !Number.isInteger(input.expectedVersion) || input.expectedVersion < 0 ||
      !required(input.name) || !required(input.description) || !required(input.inputSchema) ||
      !required(input.outputSchema) || !Array.isArray(input.behaviorIds) || input.behaviorIds.length === 0 ||
      input.behaviorIds.some(id => !required(id)) || new Set(input.behaviorIds).size !== input.behaviorIds.length) {
    fail("CAPABILITY_TEMPLATE_INVALID", "input");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("KNOWLEDGE_CLOCK_INVALID", "now");
  await authorizePublication(input.tenantId, input.actorId, input.reviewerId, "template.publish", "template.review", dependencies);
  const replay = await dependencies.store.findTemplatePublication(input.tenantId, input.idempotencyKey);
  if (replay) {
    if (replay.id !== input.templateId) fail("TEMPLATE_IDEMPOTENCY_CONFLICT", "idempotencyKey");
    return replay;
  }
  const evidenceIds = await verifyEvidenceSet(input.tenantId, input.actorId, input.evidenceIds, now, dependencies.verifyEvidence);
  const schemaHash = createHash("sha256").update(JSON.stringify({ inputSchema: input.inputSchema, outputSchema: input.outputSchema }), "utf8").digest("hex");
  const next: CapabilityTemplateRecord = Object.freeze({
    id: input.templateId, tenantId: input.tenantId, version: input.expectedVersion + 1,
    revision: input.expectedVersion + 1, name: input.name, description: input.description,
    behaviorIds: Object.freeze([...input.behaviorIds]), inputSchema: input.inputSchema,
    outputSchema: input.outputSchema, schemaHash, evidenceIds,
    status: "published", updatedBy: input.actorId, updatedAt: now.toISOString(),
  });
  if (!await dependencies.store.commitTemplate(next, input.expectedVersion, input.idempotencyKey)) {
    fail("CAPABILITY_TEMPLATE_VERSION_CONFLICT", "expectedVersion");
  }
  return next;
}
