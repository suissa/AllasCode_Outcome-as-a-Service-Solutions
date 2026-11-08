import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import postgres from "postgres";
import { PostgresJsDatabase, PostgresOutcomeStore, type PostgresQueryClient } from "../../src/persistence/postgres-outcome-store.ts";
import type { OutcomeCase } from "../../src/application/outcome-case.ts";
import { PostgresWorkflowTaskStore, type DurableTask } from "../../src/execution/durable-runtime.ts";
import { PostgresApiKeyStore, hashApiKeySecret } from "../../src/security/api-key-auth.ts";
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
    const workflowMigration = await readFile(new URL("../../migrations/0002_workflow_tasks.sql", import.meta.url), "utf8");
    await client.unsafe(workflowMigration);
    const apiKeyMigration = await readFile(new URL("../../migrations/0003_api_keys.sql", import.meta.url), "utf8");
    await client.unsafe(apiKeyMigration);
    const initial: OutcomeCase = {
      id: caseId, tenantId, stage: "specified",
      spec: { metric: { id: "metric_it_001", name: "Revenue", unit: "BRL" } as never, baseline: 100, target: 150, direction: "increase", periodStart: "2026-01-01", periodEnd: "2026-02-01", attribution: "direct", approvedBy: "actor_it_001" },
      evidence: [], observations: [],
    };
    await store.createCase(initial);
    const rawCaseRows = await client.unsafe("select tenant_id, case_id, payload from outcome_cases where tenant_id = $1 and case_id = $2", [tenantId, caseId]);
    assert.equal(rawCaseRows.length, 1, "raw PostgreSQL insert must be visible");
    assert.equal((await store.getCase(tenantId, caseId))?.id, caseId);
    const next: OutcomeCase = { ...initial, stage: "active" };
    const audit = { id: "audit_" + suffix, tenantId, actorId: "actor_it_001", action: "case.start", subjectType: "OutcomeCase", subjectId: caseId, occurredAt: new Date().toISOString(), correlationId: "corr_" + suffix };
    const command = { tenantId, caseId, idempotencyKey: "idem_" + suffix, fingerprint: "case.start:" + caseId, value: next, audit };
    const first = await store.commit(command);
    assert.equal(first.replayed, false);
    assert.equal((await store.commit(command)).replayed, true);
    assert.equal((await store.auditTrail(tenantId, caseId)).length, 1);
    await assert.rejects(() => store.commit({ ...command, fingerprint: "different" }), /IDEMPOTENCY_CONFLICT/);
    const taskStore = new PostgresWorkflowTaskStore(db);
    const workflowId = "workflow_it_" + suffix;
    const taskId = "task_it_" + suffix;
    const task: DurableTask = { id: taskId, tenantId, workflowId, dependencies: [], state: "ready", attempt: 0, maxAttempts: 2, timeoutMs: 1000, idempotencyKey: "task_idem_" + suffix, approvalRequired: false, input: {}, version: 1 };
    await taskStore.createTask(task);
    assert.equal((await taskStore.getTask(tenantId, taskId))?.state, "ready");
    const running = { ...task, state: "running" as const, attempt: 1, version: 2 };
    assert.equal(await taskStore.transition(tenantId, taskId, "ready", running), true);
    await taskStore.appendEvent({ id: "task_event_" + suffix, tenantId, taskId, kind: "started", actorId: "actor_it_001", occurredAt: new Date().toISOString() });
    assert.equal((await taskStore.listTasks(tenantId, workflowId)).length, 1);
    const apiKeys = new PostgresApiKeyStore(db);
    const keyId = "key_it_" + suffix;
    await apiKeys.createKey({ keyId, tenantId, actorId:"actor_it_001", secretHash:hashApiKeySecret("secret_for_integration"), scopes:["case.read"] });
    assert.equal((await apiKeys.getKey(keyId))?.tenantId,tenantId);
    assert.equal(await apiKeys.revokeKey(tenantId,keyId),true);
    assert.ok((await apiKeys.getKey(keyId))?.revokedAt);
  } finally {
    await client.unsafe("delete from api_keys where tenant_id = $1", [tenantId]);
    await client.unsafe("delete from workflow_task_events where tenant_id = $1", [tenantId]);
    await client.unsafe("delete from workflow_tasks where tenant_id = $1", [tenantId]);
    await client.unsafe("delete from outcome_idempotency where tenant_id = $1", [tenantId]);
    await client.unsafe("delete from outcome_audit_events where tenant_id = $1", [tenantId]);
    await client.unsafe("delete from outcome_cases where tenant_id = $1", [tenantId]);
    await client.end();
  }
});
