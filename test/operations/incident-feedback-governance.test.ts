import test from "node:test";
import assert from "node:assert/strict";
import {
  IncidentFeedbackError,
  aggregateTenantFeedback,
  createIncidentPostmortem,
  submitTenantFeedback,
  transitionTenantIncident,
  type IncidentFeedbackStore,
  type GovernedIncident,
  type TenantFeedback,
} from "../../src/operations/incident-feedback-governance.ts";

const now = new Date("2026-11-10T12:00:00.000Z");
const incident: GovernedIncident = {
  id: "inc_1", tenantId: "tenant_a", severity: "sev2", summary: "Checkout failures",
  status: "open", openedAt: "2026-11-10T10:00:00.000Z", updatedAt: "2026-11-10T10:00:00.000Z",
  revision: 1, lessons: [], evidenceIds: [],
};
const feedback: TenantFeedback = {
  id: "fb_1", tenantId: "tenant_a", subjectId: "outcome_1", actorId: "customer_1",
  rating: 1, category: "delivery", comment: "Contact me at person@example.com or +55 11 99999-9999",
  submittedAt: "2026-11-10T11:00:00.000Z",
};

class MemoryIncidentFeedbackStore implements IncidentFeedbackStore {
  incidents = new Map<string, GovernedIncident>([[incident.tenantId + ":" + incident.id, incident]]);
  transitions = new Map<string, GovernedIncident>();
  feedback = new Map<string, TenantFeedback>();
  async getIncident(tenantId: string, id: string) { return this.incidents.get(tenantId + ":" + id); }
  async findTransition(tenantId: string, key: string) { return this.transitions.get(tenantId + ":" + key); }
  async commitIncident(updated: GovernedIncident, expectedRevision: number, key: string) {
    const id = updated.tenantId + ":" + updated.id;
    const current = this.incidents.get(id);
    if (!current || current.revision !== expectedRevision) return false;
    this.incidents.set(id, updated);
    this.transitions.set(updated.tenantId + ":" + key, updated);
    return true;
  }
  async appendFeedback(item: TenantFeedback, key: string) {
    const id = item.tenantId + ":" + key;
    const prior = this.feedback.get(id);
    if (prior) return prior;
    this.feedback.set(id, item);
    return item;
  }
  async listFeedback(tenantId: string) { return [...this.feedback.values()].filter(item => item.tenantId === tenantId); }
}

test("submits tenant feedback with bounded PII redaction and idempotent storage", async () => {
  const store = new MemoryIncidentFeedbackStore();
  const command = { ...feedback, idempotencyKey: "feedback-1", now };
  const first = await submitTenantFeedback(command, { store, authorize: async () => true });
  const replay = await submitTenantFeedback(command, { store, authorize: async () => true });
  assert.equal(first.comment?.includes("person@example.com"), false);
  assert.equal(first.comment?.includes("+55 11 99999-9999"), false);
  assert.equal(first.comment?.includes("[REDACTED]"), true);
  assert.deepEqual(replay, first);
  assert.equal((await store.listFeedback("tenant_a")).length, 1);
});

test("rejects unauthorized, cross-tenant, malformed and duplicate feedback", async () => {
  const store = new MemoryIncidentFeedbackStore();
  await assert.rejects(() => submitTenantFeedback({ ...feedback, idempotencyKey: "denied", now }, { store, authorize: async () => false }), /FEEDBACK_UNAUTHORIZED/);
  await assert.rejects(() => submitTenantFeedback({ ...feedback, tenantId: "tenant_b", idempotencyKey: "cross", now }, { store, authorize: async () => true }), /FEEDBACK_TENANT_MISMATCH/);
  await assert.rejects(() => submitTenantFeedback({ ...feedback, rating: 6, idempotencyKey: "bad-rating", now }, { store, authorize: async () => true }), /FEEDBACK_RATING_INVALID/);
  await assert.rejects(() => submitTenantFeedback({ ...feedback, submittedAt: "yesterday", idempotencyKey: "bad-time", now }, { store, authorize: async () => true }), /FEEDBACK_TIMESTAMP_INVALID/);
  await assert.rejects(() => submitTenantFeedback({ ...feedback, comment: "x".repeat(2001), idempotencyKey: "too-long", now }, { store, authorize: async () => true }), /FEEDBACK_COMMENT_TOO_LARGE/);
});

test("aggregates feedback trends deterministically and isolates tenant data", () => {
  const result = aggregateTenantFeedback("tenant_a", [
    feedback,
    { ...feedback, id: "fb_2", rating: 5, category: "support", submittedAt: "2026-11-10T11:30:00.000Z" },
  ], { start: "2026-11-10T10:00:00.000Z", end: "2026-11-10T12:00:00.000Z" }, now);
  assert.equal(result.sampleSize, 2);
  assert.equal(result.averageRating, 3);
  assert.equal(result.negativeCount, 1);
  assert.deepEqual(result.categoryCounts, { delivery: 1, support: 1 });
  assert.throws(() => aggregateTenantFeedback("tenant_a", [{ ...feedback, tenantId: "tenant_b" }], {
    start: "2026-11-10T10:00:00.000Z", end: "2026-11-10T12:00:00.000Z",
  }, now), /FEEDBACK_TENANT_MISMATCH/);
});

test("transitions incidents through authorized, revisioned states and records idempotent events", async () => {
  const store = new MemoryIncidentFeedbackStore();
  const command = {
    tenantId: "tenant_a", incidentId: "inc_1", actorId: "oncall_1", to: "acknowledged" as const,
    expectedRevision: 1, idempotencyKey: "ack-1", reason: "On-call accepted incident", now,
  };
  const first = await transitionTenantIncident(command, { store, authorize: async () => true });
  const replay = await transitionTenantIncident(command, { store, authorize: async () => true });
  assert.equal(first.status, "acknowledged");
  assert.deepEqual(replay, first);
  assert.equal(first.revision, 2);
  const next = await transitionTenantIncident({
    ...command, to: "investigating", expectedRevision: 2, idempotencyKey: "investigate-1",
    reason: "Investigating payment provider",
  }, { store, authorize: async () => true });
  assert.equal(next.status, "investigating");
});

test("incident transitions reject invalid paths, stale revisions and unauthorized actors", async () => {
  const store = new MemoryIncidentFeedbackStore();
  const base = {
    tenantId: "tenant_a", incidentId: "inc_1", actorId: "oncall_1",
    expectedRevision: 1, idempotencyKey: "bad-transition", reason: "Test", now,
  };
  await assert.rejects(() => transitionTenantIncident({ ...base, to: "closed" }, { store, authorize: async () => true }), /INCIDENT_TRANSITION_INVALID/);
  await assert.rejects(() => transitionTenantIncident({ ...base, to: "acknowledged" }, { store, authorize: async () => false }), /INCIDENT_UNAUTHORIZED/);
  await assert.rejects(() => transitionTenantIncident({ ...base, tenantId: "tenant_b", to: "acknowledged" }, { store, authorize: async () => true }), /INCIDENT_NOT_FOUND/);
  await assert.rejects(() => transitionTenantIncident({ ...base, expectedRevision: 9, to: "acknowledged" }, { store, authorize: async () => true }), /INCIDENT_REVISION_CONFLICT/);
});

test("resolved incident requires evidence-backed independent postmortem and action owners", async () => {
  const resolved: GovernedIncident = {
    ...incident, status: "resolved", revision: 4, updatedAt: now.toISOString(),
    resolvedAt: now.toISOString(), resolutionSummary: "Checkout recovered", lessons: ["Retry storm was amplified"],
    evidenceIds: ["ev_1"],
  };
  const postmortem = await createIncidentPostmortem({
    incident: resolved, preparedBy: "incident_commander", reviewerId: "independent_reviewer",
    rootCause: "Provider timeout and retry amplification", impactSummary: "Checkout unavailable for 12 minutes",
    evidenceIds: ["ev_1"], actionItems: [{ id: "act_1", description: "Add retry budget", ownerId: "platform_team", dueAt: "2026-11-20T00:00:00.000Z" }],
    now,
  }, { authorize: async () => true, verifyEvidence: async id => id === "ev_1" });
  assert.equal(postmortem.incidentId, "inc_1");
  assert.equal(postmortem.actionItems.length, 1);
  assert.ok(Object.isFrozen(postmortem));
  await assert.rejects(() => createIncidentPostmortem({
    incident: resolved, preparedBy: "incident_commander", reviewerId: "incident_commander",
    rootCause: "cause", impactSummary: "impact", evidenceIds: ["ev_1"], actionItems: [], now,
  }, { authorize: async () => true, verifyEvidence: async () => true }), /POSTMORTEM_INDEPENDENT_REVIEW_REQUIRED/);
});

test("postmortem rejects missing or unverified evidence and malformed action items", async () => {
  const resolved: GovernedIncident = {
    ...incident, status: "resolved", revision: 4, updatedAt: now.toISOString(),
    resolvedAt: now.toISOString(), resolutionSummary: "Recovered", lessons: [], evidenceIds: ["ev_1"],
  };
  const input = {
    incident: resolved, preparedBy: "commander", reviewerId: "auditor",
    rootCause: "root cause", impactSummary: "impact", evidenceIds: ["ev_1"], actionItems: [], now,
  };
  await assert.rejects(() => createIncidentPostmortem(input, { authorize: async () => true, verifyEvidence: async () => false }), /POSTMORTEM_EVIDENCE_UNVERIFIED/);
  await assert.rejects(() => createIncidentPostmortem({ ...input, evidenceIds: [] }, { authorize: async () => true, verifyEvidence: async () => true }), /POSTMORTEM_EVIDENCE_REQUIRED/);
  await assert.rejects(() => createIncidentPostmortem({
    ...input, actionItems: [{ id: "act_1", description: "fix", ownerId: "owner", dueAt: "invalid" }],
  }, { authorize: async () => true, verifyEvidence: async () => true }), /POSTMORTEM_ACTION_INVALID/);
});

test("incident severity, timestamps and feedback windows fail closed", () => {
  const invalid = { ...incident, severity: "sev0" as never };
  assert.throws(() => transitionTenantIncident({ tenantId: "tenant_a", incidentId: "inc_1", actorId: "x", to: "acknowledged", expectedRevision: 1, idempotencyKey: "x", reason: "x", now }, {
    store: new MemoryIncidentFeedbackStore(), authorize: async () => true,
  }), /INCIDENT_TIMESTAMP_INVALID|INCIDENT_INVALID/);
  assert.throws(() => aggregateTenantFeedback("tenant_a", [feedback, feedback], {
    start: "2026-11-10T10:00:00.000Z", end: "2026-11-10T12:00:00.000Z",
  }, now), /FEEDBACK_DUPLICATE/);
  assert.ok(invalid);
});
