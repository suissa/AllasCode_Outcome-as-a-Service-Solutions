import test from "node:test";
import assert from "node:assert/strict";
import { PostgresProposalStore } from "../../src/persistence/postgres-proposal-store.ts";
import type { SqlDatabase, SqlExecutor } from "../../src/persistence/sql.ts";
import type { PersistedProposal, ProposalEvent } from "../../src/persistence/proposal-store.ts";

function fixture(): PersistedProposal {
  const now = "2026-11-10T12:00:00.000Z";
  return {
    proposal: {
      id: "proposal_demo_001", version: 1, tenantId: "tenant_demo_001", status: "draft", generatedAt: now,
      customer: { name: "Cliente", sector: "Serviços" }, context: "Contexto", problem: "Problema", desiredOutcome: "Resultado",
      diagnosisConfidence: 0, evidence: [], metric: { id: "revenue", name: "Receita", unit: "BRL", direction: "increase", attribution: "pending", guardrails: [], exclusions: [] },
      scenario: { id: "scenario", rationale: "Piloto", confidence: 0, assumptions: [], risks: [] }, scope: [], deliverables: [], exclusions: [],
      dependencies: [], responsibilities: [], acceptanceCriteria: [], pricing: { lines: [] },
      readiness: { status: "ready_for_review", blockers: [], warnings: [] }, commercialNotice: "Revisão humana",
    },
    status: "ready_for_review", source: { kind: "guilda", missionId: "mission_001", answerCount: 2, knownAnswerCount: 2 },
    createdBy: "actor_001", updatedBy: "actor_001", createdAt: now, updatedAt: now,
  };
}
function event(kind: ProposalEvent["kind"] = "submitted", version = 1): ProposalEvent {
  return { id: "event_" + version, tenantId: "tenant_demo_001", proposalId: "proposal_demo_001", version, actorId: "actor_001", kind, occurredAt: "2026-11-10T12:00:00.000Z" };
}

test("proposal store persists records, source traceability, and idempotency atomically", async () => {
  const statements: string[] = [];
  const tx: SqlExecutor = { query: async <T extends Record<string, unknown>>(sql: string) => {
    statements.push(sql);
    if (sql.includes("select fingerprint")) return { rows: [] as T[], rowCount: 0 };
    return { rows: [] as T[], rowCount: 1 };
  } };
  const db: SqlDatabase = { query: tx.query, transaction: async work => work(tx) };
  const value = fixture();
  const result = await new PostgresProposalStore(db).create({
    tenantId: "tenant_demo_001", actorId: "actor_001", idempotencyKey: "idem_001", fingerprint: "payload_hash",
    value, event: event(),
  });
  assert.equal(result.replayed, false);
  assert.equal(result.value.source.missionId, "mission_001");
  assert.equal(statements.length, 4);
  assert.match(statements[1]!, /outcome_proposals/);
  assert.match(statements[2]!, /outcome_proposal_events/);
  assert.match(statements[3]!, /outcome_proposal_idempotency/);
});

test("proposal store rejects reuse of an idempotency key with a different payload", async () => {
  const tx: SqlExecutor = { query: async <T extends Record<string, unknown>>(sql: string) => sql.includes("select fingerprint")
    ? { rows: [{ fingerprint: "original", proposal_id: "proposal_demo_001" }] as unknown as T[], rowCount: 1 }
    : { rows: [], rowCount: 0 } };
  const db: SqlDatabase = { query: tx.query, transaction: async work => work(tx) };
  await assert.rejects(() => new PostgresProposalStore(db).create({
    tenantId: "tenant_demo_001", actorId: "actor_001", idempotencyKey: "idem_001", fingerprint: "different",
    value: fixture(), event: event(),
  }), /PROPOSAL_IDEMPOTENCY_CONFLICT/);
});

test("proposal transition checks tenant, current version, and review boundary", async () => {
  const value = fixture();
  const tx: SqlExecutor = { query: async <T extends Record<string, unknown>>(sql: string) => sql.includes("select payload")
    ? { rows: [{ payload: value }] as unknown as T[], rowCount: 1 }
    : { rows: [], rowCount: 1 } };
  const db: SqlDatabase = { query: tx.query, transaction: async work => work(tx) };
  const store = new PostgresProposalStore(db);
  const approved = await store.transition({
    tenantId: "tenant_demo_001", proposalId: "proposal_demo_001", actorId: "reviewer_001", expectedVersion: 1,
    status: "approved", event: { ...event("approved", 2), actorId: "reviewer_001" },
  });
  assert.equal(approved.status, "approved");
  assert.equal(approved.proposal.version, 2);
  await assert.rejects(() => store.transition({
    tenantId: "tenant_demo_001", proposalId: "proposal_demo_001", actorId: "reviewer_001", expectedVersion: 2,
    status: "rejected", reason: "Revisão", event: event("rejected", 3),
  }), /PROPOSAL_TRANSITION_NOT_ALLOWED/);
});

test("proposal rejection requires a reason", async () => {
  const value = fixture();
  const tx: SqlExecutor = { query: async <T extends Record<string, unknown>>(sql: string) => sql.includes("select payload")
    ? { rows: [{ payload: value }] as unknown as T[], rowCount: 1 }
    : { rows: [], rowCount: 1 } };
  const db: SqlDatabase = { query: tx.query, transaction: async work => work(tx) };
  await assert.rejects(() => new PostgresProposalStore(db).transition({
    tenantId: "tenant_demo_001", proposalId: "proposal_demo_001", actorId: "reviewer_001", expectedVersion: 1,
    status: "rejected", event: event("rejected", 2),
  }), /PROPOSAL_REJECTION_REASON_REQUIRED/);
});
