import { createHash } from "node:crypto";
import type { SqlDatabase } from "../persistence/sql.ts";

export interface AuditEvent {
  id: string; tenantId: string; actorId: string; action: string; subjectType: string; subjectId: string;
  occurredAt: string; correlationId: string; before?: unknown; after?: unknown;
  metadata?: Readonly<Record<string, unknown>>;
}
export type DecisionOutcome = "approved" | "rejected" | "deferred";
export interface DecisionRecord {
  id: string; tenantId: string; actorId: string; action: string; subjectType: string; subjectId: string;
  outcome: DecisionOutcome; reasonCode: string; rationale: string; policyVersion?: string;
  inputsHash?: string; decidedAt: string; correlationId: string; metadata?: Readonly<Record<string, unknown>>;
}
export interface AuditLedgerEntry<T = AuditEvent | DecisionRecord> {
  tenantId: string; sequence: number; eventId: string; eventType: "audit" | "decision";
  previousHash: string; eventHash: string; payload: T;
}
export interface AuditAppendResult<T = AuditEvent | DecisionRecord> extends AuditLedgerEntry<T> { replayed: boolean }
export interface AuditChainVerification {
  valid: boolean; eventsChecked: number;
  failure?: { sequence: number; code: "SEQUENCE_GAP" | "PREVIOUS_HASH_MISMATCH" | "EVENT_HASH_MISMATCH" };
}
export const AUDIT_GENESIS_HASH = "0".repeat(64);

export function canonicalJson(value: unknown): string {
  const seen = new Set<object>();
  const normalize = (item: unknown): unknown => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) throw new Error("AUDIT_VALUE_NOT_CANONICAL");
      return item;
    }
    if (typeof item !== "object" || item === undefined) throw new Error("AUDIT_VALUE_NOT_CANONICAL");
    if (seen.has(item)) throw new Error("AUDIT_VALUE_CIRCULAR");
    seen.add(item);
    try {
      if (Array.isArray(item)) {
        for (let i = 0; i < item.length; i++) if (!(i in item)) throw new Error("AUDIT_ARRAY_HOLE");
        return item.map(normalize);
      }
      const prototype = Object.getPrototypeOf(item);
      if (prototype !== Object.prototype && prototype !== null) throw new Error("AUDIT_VALUE_NOT_PLAIN_OBJECT");
      const output: Record<string, unknown> = {};
      for (const key of Object.keys(item as Record<string, unknown>).sort()) {
        const child = (item as Record<string, unknown>)[key];
        if (child === undefined) throw new Error("AUDIT_VALUE_UNDEFINED");
        output[key] = normalize(child);
      }
      return output;
    } finally { seen.delete(item); }
  };
  return JSON.stringify(normalize(value));
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
const required = (value: string): boolean => typeof value === "string" && value.trim().length > 0;

export function createAuditEvent(input: Omit<AuditEvent, "occurredAt">, now = new Date()): AuditEvent {
  if (![input.id, input.tenantId, input.actorId, input.action, input.subjectType, input.subjectId, input.correlationId].every(required))
    throw new Error("AUDIT_REQUIRED_FIELDS");
  const event = { ...input, occurredAt: now.toISOString() };
  canonicalJson(event);
  return deepFreeze(event);
}
export function createDecisionRecord(input: Omit<DecisionRecord, "decidedAt">, now = new Date()): DecisionRecord {
  if (![input.id, input.tenantId, input.actorId, input.action, input.subjectType, input.subjectId, input.reasonCode, input.rationale, input.correlationId].every(required)
    || !["approved", "rejected", "deferred"].includes(input.outcome)
    || (input.inputsHash !== undefined && !/^[a-f0-9]{64}$/.test(input.inputsHash)))
    throw new Error("DECISION_RECORD_INVALID");
  const record = { ...input, decidedAt: now.toISOString() };
  canonicalJson(record);
  return deepFreeze(record);
}
interface LedgerRow extends Record<string, unknown> {
  tenant_id: string; sequence: number | string; event_id: string; event_type: "audit" | "decision";
  previous_hash: string; event_hash: string; payload: unknown | string;
}
const decode = <T>(value: T | string): T => typeof value === "string" ? JSON.parse(value) as T : value;
function hashEntry(input: { tenantId: string; sequence: number; previousHash: string; eventType: "audit" | "decision"; eventId: string; payload: unknown }): string {
  return createHash("sha256").update(canonicalJson(input), "utf8").digest("hex");
}

export class PostgresAuditLedger {
  constructor(private readonly db: SqlDatabase) {}
  append(event: AuditEvent): Promise<AuditAppendResult<AuditEvent>> {
    if (!required(event.id) || !required(event.tenantId) || !required(event.actorId)) throw new Error("AUDIT_REQUIRED_FIELDS");
    return this.appendEntry(event.tenantId, event.id, "audit", event);
  }
  appendDecision(decision: DecisionRecord): Promise<AuditAppendResult<DecisionRecord>> {
    if (!required(decision.id) || !required(decision.tenantId) || !required(decision.actorId)) throw new Error("DECISION_RECORD_INVALID");
    return this.appendEntry(decision.tenantId, decision.id, "decision", decision);
  }
  private async appendEntry<T extends AuditEvent | DecisionRecord>(tenantId: string, eventId: string, eventType: "audit" | "decision", payload: T): Promise<AuditAppendResult<T>> {
    const serialized = canonicalJson(payload);
    return this.db.transaction(async tx => {
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))", ["audit-ledger:" + tenantId]);
      const existing = await tx.query<LedgerRow>(
        "select tenant_id,sequence,event_id,event_type,previous_hash,event_hash,payload from audit_event_ledger where tenant_id=$1 and event_id=$2", [tenantId, eventId]);
      if (existing.rows[0]) {
        const row = existing.rows[0];
        if (row.event_type !== eventType || canonicalJson(decode(row.payload)) !== serialized) throw new Error("AUDIT_IDEMPOTENCY_CONFLICT");
        return { ...this.toEntry<T>(row), replayed: true };
      }
      const head = await tx.query<LedgerRow>(
        "select tenant_id,sequence,event_id,event_type,previous_hash,event_hash,payload from audit_event_ledger where tenant_id=$1 order by sequence desc limit 1", [tenantId]);
      const sequence = Number(head.rows[0]?.sequence ?? 0) + 1;
      const previousHash = head.rows[0]?.event_hash ?? AUDIT_GENESIS_HASH;
      const eventHash = hashEntry({ tenantId, sequence, previousHash, eventType, eventId, payload });
      const inserted = await tx.query<LedgerRow>(
        "insert into audit_event_ledger (tenant_id,sequence,event_id,event_type,previous_hash,event_hash,payload) values ($1,$2,$3,$4,$5,$6,$7::jsonb) returning tenant_id,sequence,event_id,event_type,previous_hash,event_hash,payload",
        [tenantId, sequence, eventId, eventType, previousHash, eventHash, serialized]);
      if (!inserted.rows[0]) throw new Error("AUDIT_APPEND_FAILED");
      return { ...this.toEntry<T>(inserted.rows[0]), replayed: false };
    });
  }
  async history(tenantId: string): Promise<readonly AuditLedgerEntry[]> {
    const result = await this.db.query<LedgerRow>(
      "select tenant_id,sequence,event_id,event_type,previous_hash,event_hash,payload from audit_event_ledger where tenant_id=$1 order by sequence", [tenantId]);
    return Object.freeze(result.rows.map(row => this.toEntry(row)));
  }
  async decisionHistory(tenantId: string, subjectType?: string, subjectId?: string): Promise<readonly DecisionRecord[]> {
    const result = await this.db.query<LedgerRow>(
      "select tenant_id,sequence,event_id,event_type,previous_hash,event_hash,payload from audit_event_ledger where tenant_id=$1 and event_type='decision' order by sequence", [tenantId]);
    return Object.freeze(result.rows.map(row => this.toEntry<DecisionRecord>(row))
      .filter(entry => (!subjectType || entry.payload.subjectType === subjectType) && (!subjectId || entry.payload.subjectId === subjectId))
      .map(entry => entry.payload));
  }
  async verify(tenantId: string): Promise<AuditChainVerification> {
    const entries = await this.history(tenantId);
    let previousHash = AUDIT_GENESIS_HASH;
    let expectedSequence = 1;
    for (const entry of entries) {
      if (entry.sequence !== expectedSequence) return { valid: false, eventsChecked: expectedSequence - 1, failure: { sequence: entry.sequence, code: "SEQUENCE_GAP" } };
      if (entry.previousHash !== previousHash) return { valid: false, eventsChecked: expectedSequence - 1, failure: { sequence: entry.sequence, code: "PREVIOUS_HASH_MISMATCH" } };
      const actual = hashEntry({ tenantId: entry.tenantId, sequence: entry.sequence, previousHash: entry.previousHash, eventType: entry.eventType, eventId: entry.eventId, payload: entry.payload });
      if (actual !== entry.eventHash) return { valid: false, eventsChecked: expectedSequence - 1, failure: { sequence: entry.sequence, code: "EVENT_HASH_MISMATCH" } };
      previousHash = entry.eventHash;
      expectedSequence++;
    }
    return { valid: true, eventsChecked: entries.length };
  }
  private toEntry<T = AuditEvent | DecisionRecord>(row: LedgerRow): AuditLedgerEntry<T> {
    return Object.freeze({
      tenantId: row.tenant_id, sequence: Number(row.sequence), eventId: row.event_id, eventType: row.event_type,
      previousHash: row.previous_hash, eventHash: row.event_hash, payload: decode(row.payload) as T
    });
  }
}
