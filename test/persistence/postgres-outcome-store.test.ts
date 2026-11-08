import test from "node:test";
import assert from "node:assert/strict";
import { PostgresOutcomeStore } from "../../src/persistence/postgres-outcome-store.ts";
import type { SqlDatabase, SqlExecutor } from "../../src/persistence/sql.ts";
import type { OutcomeCase } from "../../src/application/outcome-case.ts";
import type { AuditEvent } from "../../src/domain/audit.ts";
function makeCase(): OutcomeCase {
  return { id: "outcome_demo_001", tenantId: "tenant_demo_001", stage: "active", spec: { metric: { id: "metric_demo_001", name: "Revenue", unit: "BRL" } as never, baseline: 10, target: 20, direction: "increase", periodStart: "2026-01-01", periodEnd: "2026-02-01", attribution: "direct", approvedBy: "actor_owner_001" }, evidence: [], observations: [] };
}
function makeAudit(): AuditEvent {
  return { id: "audit_demo_001", tenantId: "tenant_demo_001", actorId: "actor_owner_001", action: "case.start", subjectType: "OutcomeCase", subjectId: "outcome_demo_001", occurredAt: "2026-11-08T00:00:00.000Z", correlationId: "corr_demo_001" };
}
test("Postgres store scopes reads by tenant and case", async () => {
  let sql = "";
  const db: SqlDatabase = {
    query: async <T extends Record<string, unknown>>(statement: string) => { sql = statement; return { rows: [{ payload: makeCase(), version: 1 }] as unknown as unknown as T[], rowCount: 1 }; },
    transaction: async <T>(work: (tx: SqlExecutor) => Promise<T>) => work(db),
  };
  const store = new PostgresOutcomeStore(db);
  assert.equal((await store.getCase("tenant_demo_001", "outcome_demo_001"))?.id, "outcome_demo_001");
  assert.match(sql, /tenant_id = \$1 and case_id = \$2/);
});
test("Postgres store commits state, audit and idempotency in one transaction", async () => {
  const statements: string[] = [];
  const tx: SqlExecutor = { query: async <T extends Record<string, unknown>>(statement: string) => {
    statements.push(statement);
    if (statement.includes("select fingerprint")) return { rows: [] as unknown as T[], rowCount: 0 };
    if (statement.includes("select payload, version")) return { rows: [{ payload: makeCase(), version: 1 }] as unknown as T[], rowCount: 1 };
    return { rows: [] as unknown as T[], rowCount: 1 };
  } };
  const db: SqlDatabase = { query: tx.query, transaction: async <T>(work: (executor: SqlExecutor) => Promise<T>) => work(tx) };
  const store = new PostgresOutcomeStore(db); const value = makeCase();
  const result = await store.commit({ tenantId: value.tenantId, caseId: value.id, idempotencyKey: "idem_demo_001", fingerprint: "start", value, audit: makeAudit() });
  assert.equal(result.replayed, false); assert.equal(statements.length, 5);
  assert.match(statements[3]!, /outcome_audit_events/); assert.match(statements[4]!, /outcome_idempotency/);
});
test("Postgres store rejects idempotency key reuse with a different fingerprint", async () => {
  const tx: SqlExecutor = { query: async <T extends Record<string, unknown>>(statement: string) => statement.includes("select fingerprint")
    ? { rows: [{ fingerprint: "original", result: makeCase() }] as unknown as T[], rowCount: 1 }
    : { rows: [] as unknown as T[], rowCount: 0 } };
  const db: SqlDatabase = { query: tx.query, transaction: async <T>(work: (executor: SqlExecutor) => Promise<T>) => work(tx) };
  const store = new PostgresOutcomeStore(db);
  await assert.rejects(() => store.commit({ tenantId: "tenant_demo_001", caseId: "outcome_demo_001", idempotencyKey: "idem_demo_001", fingerprint: "different", value: makeCase(), audit: makeAudit() }), /IDEMPOTENCY_CONFLICT/);
});
