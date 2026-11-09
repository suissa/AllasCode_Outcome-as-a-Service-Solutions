import test from "node:test";
import assert from "node:assert/strict";
import { createAuditEvent, createDecisionRecord, canonicalJson, PostgresAuditLedger, AUDIT_GENESIS_HASH, type AuditLedgerEntry } from "../../src/domain/audit.ts";
import type { SqlDatabase, SqlExecutor } from "../../src/persistence/sql.ts";

test("audit event validates required identity and freezes nested payload", () => {
  const event = createAuditEvent({ id:"evt_1", tenantId:"tenant_1", actorId:"actor_1", action:"case.approve", subjectType:"case", subjectId:"case_1", correlationId:"corr_1", metadata:{ nested:{ safe:true } } }, new Date("2026-01-01T00:00:00Z"));
  assert.equal(event.occurredAt, "2026-01-01T00:00:00.000Z");
  assert.ok(Object.isFrozen(event.metadata?.nested));
  assert.throws(() => createAuditEvent({ ...event, id:"" }), /AUDIT_REQUIRED_FIELDS/);
});
test("decision records require a stable reason and valid input digest", () => {
  const record = createDecisionRecord({ id:"decision_1", tenantId:"tenant_1", actorId:"actor_1", action:"contract.approve", subjectType:"contract", subjectId:"contract_1", outcome:"approved", reasonCode:"POLICY_SATISFIED", rationale:"All required checks passed", correlationId:"corr_1" });
  assert.equal(record.outcome, "approved");
  assert.throws(() => createDecisionRecord({ ...record, inputsHash:"not-a-digest" }), /DECISION_RECORD_INVALID/);
});
test("canonical serialization is stable and rejects ambiguous values", () => {
  assert.equal(canonicalJson({ z:1, a:{ y:2, x:1 } }), '{"a":{"x":1,"y":2},"z":1}');
  assert.throws(() => canonicalJson({ missing:undefined }), /AUDIT_VALUE_UNDEFINED/);
  assert.throws(() => canonicalJson([, 1]), /AUDIT_ARRAY_HOLE/);
  const circular:Record<string,unknown> = {}; circular.self = circular;
  assert.throws(() => canonicalJson(circular), /AUDIT_VALUE_CIRCULAR/);
  assert.throws(() => canonicalJson({ n:Number.NaN }), /AUDIT_VALUE_NOT_CANONICAL/);
});
class MemoryDb implements SqlDatabase {
  readonly tenants = new Map<string, AuditLedgerEntry[]>();
  async query<T extends Record<string,unknown>>(sql:string,p:readonly unknown[]=[]): Promise<{rows:T[];rowCount:number}> {
    const tenant=String(p[0]??""); const rows=this.tenants.get(tenant)??[];
    const selected=sql.includes("event_type='decision'")?rows.filter(entry=>entry.eventType==="decision"):rows;
    return { rows:selected.map(toRow) as T[], rowCount:selected.length };
  }
  async transaction<T>(work:(tx:SqlExecutor)=>Promise<T>):Promise<T> {
    const tx:SqlExecutor = { query:async<R extends Record<string,unknown>>(sql:string,p:readonly unknown[]=[]):Promise<{rows:R[];rowCount:number}> => {
      const tenant = String(p[0] ?? "");
      if (sql.includes("pg_advisory_xact_lock")) return { rows:[], rowCount:1 };
      if (sql.includes("where tenant_id=$1 and event_id=$2")) {
        const row = (this.tenants.get(tenant) ?? []).find(entry => entry.eventId === p[1]);
        return { rows:(row ? [toRow(row)] : []) as R[], rowCount:row ? 1 : 0 };
      }
      if (sql.includes("order by sequence desc limit 1")) {
        const rows = this.tenants.get(tenant) ?? []; const row = rows.at(-1);
        return { rows:(row ? [toRow(row)] : []) as R[], rowCount:row ? 1 : 0 };
      }
      if (sql.startsWith("insert into audit_event_ledger")) {
        const row:AuditLedgerEntry = { tenantId:tenant, sequence:Number(p[1]), eventId:String(p[2]), eventType:p[3] as "audit"|"decision", previousHash:String(p[4]), eventHash:String(p[5]), payload:JSON.parse(String(p[6])) };
        const rows = this.tenants.get(tenant) ?? []; rows.push(row); this.tenants.set(tenant, rows);
        return { rows:[toRow(row)] as R[], rowCount:1 };
      }
      throw new Error("UNEXPECTED_SQL:" + sql);
    }};
    return work(tx);
  }
}
function toRow(entry:AuditLedgerEntry):Record<string,unknown> {
  return { tenant_id:entry.tenantId, sequence:entry.sequence, event_id:entry.eventId, event_type:entry.eventType, previous_hash:entry.previousHash, event_hash:entry.eventHash, payload:entry.payload };
}
const makeEvent = (id:string, tenantId="tenant_1") => createAuditEvent({ id, tenantId, actorId:"actor_1", action:"case.updated", subjectType:"case", subjectId:"case_1", correlationId:"corr_1" });
test("ledger chains entries, handles idempotent retries and isolates tenants", async () => {
  const ledger = new PostgresAuditLedger(new MemoryDb());
  const firstEvent = makeEvent("event_1");
  const first = await ledger.append(firstEvent);
  assert.equal(first.sequence, 1); assert.equal(first.previousHash, AUDIT_GENESIS_HASH);
  assert.equal((await ledger.append(firstEvent)).replayed, true);
  await assert.rejects(() => ledger.append(createAuditEvent({ ...firstEvent, action:"different" })), /AUDIT_IDEMPOTENCY_CONFLICT/);
  const second = await ledger.append(makeEvent("event_2"));
  assert.equal(second.sequence, 2); assert.equal(second.previousHash, first.eventHash);
  await ledger.append(makeEvent("event_other", "tenant_2"));
  assert.deepEqual(await ledger.verify("tenant_1"), { valid:true, eventsChecked:2 });
  assert.equal((await ledger.history("tenant_2")).length, 1);
});
test("decision history shares the tamper-evident tenant sequence", async () => {
  const ledger = new PostgresAuditLedger(new MemoryDb());
  const decision = createDecisionRecord({ id:"decision_1", tenantId:"tenant_1", actorId:"actor_1", action:"proposal.accept", subjectType:"proposal", subjectId:"proposal_1", outcome:"rejected", reasonCode:"EVIDENCE_MISSING", rationale:"Acceptance evidence is incomplete", correlationId:"corr_1" });
  await ledger.appendDecision(decision);
  assert.deepEqual(await ledger.decisionHistory("tenant_1", "proposal", "proposal_1"), [decision]);
  assert.deepEqual(await ledger.verify("tenant_1"), { valid:true, eventsChecked:1 });
});
