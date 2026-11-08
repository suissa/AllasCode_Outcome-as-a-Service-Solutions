import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { PostgresJsDatabase, PostgresOutcomeStore, type PostgresQueryClient } from "../../src/persistence/postgres-outcome-store.ts";
import type { OutcomeCase } from "../../src/application/outcome-case.ts";
const databaseUrl = process.env.DATABASE_URL;
test("PostgreSQL migration and transactional outcome persistence", { skip: !databaseUrl }, async () => {
  const client = postgres(databaseUrl!, { max: 1 });
  const db = new PostgresJsDatabase(client as unknown as PostgresQueryClient);
  const store = new PostgresOutcomeStore(db);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 12);
  const tenantId = "tenant_it_" + suffix;
  const caseId = "outcome_it_" + suffix;
  try {
    const migration = await readFile(new URL("../../migrations/0001_outcome_platform.sql", import.meta.url), "utf8");
    await client.unsafe(migration);
    const initial: OutcomeCase = {
      id: caseId, tenantId, stage: "specified",
      spec: { metric: { id: "metric_it_001", name: "Revenue", unit: "BRL" } as never, baseline: 100, target: 150, direction: "increase", periodStart: "2026-01-01", periodEnd: "2026-02-01", attribution: "direct", approvedBy: "actor_it_001" },
      evidence: [], observations: [],
    };
    await store.createCase(initial);
    assert.equal((await store.getCase(tenantId, caseId))?.id, caseId);
    const next: OutcomeCase = { ...initial, stage: "active" };
    const audit = { id: "audit_" + suffix, tenantId, actorId: "actor_it_001", action: "case.start", subjectType: "OutcomeCase", subjectId: caseId, occurredAt: new Date().toISOString(), correlationId: "corr_" + suffix };
    const command = { tenantId, caseId, idempotencyKey: "idem_" + suffix, fingerprint: "case.start:" + caseId, value: next, audit };
    const first = await store.commit(command);
    assert.equal(first.replayed, false);
    assert.equal((await store.commit(command)).replayed, true);
    assert.equal((await store.auditTrail(tenantId, caseId)).length, 1);
    await assert.rejects(() => store.commit({ ...command, fingerprint: "different" }), /IDEMPOTENCY_CONFLICT/);
  } finally {
    await client.unsafe("delete from outcome_idempotency where tenant_id = $1", [tenantId]);
    await client.unsafe("delete from outcome_audit_events where tenant_id = $1", [tenantId]);
    await client.unsafe("delete from outcome_cases where tenant_id = $1", [tenantId]);
    await client.end();
  }
});
