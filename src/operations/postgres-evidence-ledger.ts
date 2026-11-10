import { createHash } from "node:crypto";
import type { Sql } from "postgres";
import type { AppendOnlyLedger, LedgerAppend, LedgerEvent } from "./evidence-ledger.js";

const GENESIS = "0".repeat(64);

function canonical(value: unknown): string {
  if (value === null || typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("LEDGER-NON-FINITE-NUMBER");
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (typeof value === "object") {
    if (Object.getPrototypeOf(value) !== Object.prototype && Object.getPrototypeOf(value) !== null)
      throw new Error("LEDGER-NON-JSON-PAYLOAD");
    const record = value as Record<string, unknown>;
    return "{" + Object.keys(record).sort().map(key => {
      if (record[key] === undefined) throw new Error("LEDGER-UNDEFINED-PAYLOAD");
      return JSON.stringify(key) + ":" + canonical(record[key]);
    }).join(",") + "}";
  }
  throw new Error("LEDGER-NON-JSON-PAYLOAD");
}

export function ledgerDigest(value: unknown): string {
  return createHash("sha256").update(canonical(value)).digest("hex");
}

type LedgerRow<T> = {
  sequence: string | number;
  tenant_id: string;
  event_id: string;
  event_type: string;
  occurred_at: Date | string;
  payload: T;
  previous_hash: string;
  event_hash: string;
};

function fromRow<T>(row: LedgerRow<T>): LedgerEvent<T> {
  return {
    sequence: Number(row.sequence),
    tenantId: row.tenant_id,
    eventId: row.event_id,
    eventType: row.event_type,
    occurredAt: new Date(row.occurred_at).toISOString(),
    payload: row.payload,
    previousHash: row.previous_hash,
    hash: row.event_hash
  };
}

/**
 * Durable PostgreSQL adapter. Each tenant is serialized with a transaction-scoped
 * advisory lock, so sequence allocation and previous-hash selection are atomic.
 * The caller owns the postgres.js Sql instance and its lifecycle.
 */
export class PostgresAppendOnlyLedger<T> implements AppendOnlyLedger<T> {
  constructor(private readonly sql: Sql) {}

  async append(input: LedgerAppend<T>): Promise<LedgerEvent<T>> {
    if (!input.tenantId.trim() || !input.eventId.trim() || !input.eventType.trim())
      throw new Error("LEDGER-REQUIRED-FIELD");
    const occurredAt = new Date(input.occurredAt);
    if (!Number.isFinite(occurredAt.getTime())) throw new Error("LEDGER-INVALID-TIMESTAMP");
    const payload = JSON.parse(canonical(input.payload)) as T;

    return this.sql.begin(async tx => {
      await tx`SELECT pg_advisory_xact_lock(hashtextextended(${input.tenantId}, 0))`;
      const duplicate = await tx`
        SELECT 1 FROM syntropic_ledger_events
        WHERE tenant_id = ${input.tenantId} AND event_id = ${input.eventId}
        LIMIT 1
      `;
      if (duplicate.length) throw new Error("LEDGER-DUPLICATE-EVENT");

      const previous = await tx`
        SELECT sequence, event_hash FROM syntropic_ledger_events
        WHERE tenant_id = ${input.tenantId}
        ORDER BY sequence DESC LIMIT 1
      `;
      const sequence = previous.length ? Number(previous[0]!.sequence) + 1 : 1;
      const previousHash = previous.length ? String(previous[0]!.event_hash) : GENESIS;
      const base = {
        sequence, tenantId: input.tenantId, eventId: input.eventId,
        eventType: input.eventType, occurredAt: occurredAt.toISOString(),
        payload, previousHash
      };
      const hash = ledgerDigest(base);
      const rows = await tx`
        INSERT INTO syntropic_ledger_events
          (tenant_id, sequence, event_id, event_type, occurred_at, payload, previous_hash, event_hash)
        VALUES
          (${input.tenantId}, ${sequence}, ${input.eventId}, ${input.eventType},
           ${occurredAt.toISOString()}, ${tx.json(payload as never)}, ${previousHash}, ${hash})
        RETURNING sequence, tenant_id, event_id, event_type, occurred_at, payload, previous_hash, event_hash
      `;
      return fromRow<T>(rows[0] as unknown as LedgerRow<T>);
    });
  }

  async readTenant(tenantId: string, afterSequence = 0): Promise<readonly LedgerEvent<T>[]> {
    const rows = await this.sql<LedgerRow<T>[]>`
      SELECT sequence, tenant_id, event_id, event_type, occurred_at, payload, previous_hash, event_hash
      FROM syntropic_ledger_events
      WHERE tenant_id = ${tenantId} AND sequence > ${afterSequence}
      ORDER BY sequence ASC
    `;
    return rows.map(fromRow);
  }

  async verifyTenant(tenantId: string): Promise<{ valid: boolean; checked: number; failureSequence?: number }> {
    const events = await this.readTenant(tenantId);
    let previousHash = GENESIS;
    for (let index = 0; index < events.length; index++) {
      const event = events[index]!;
      const { hash, ...base } = event;
      if (event.sequence !== index + 1 || event.previousHash !== previousHash || ledgerDigest(base) !== hash)
        return { valid: false, checked: index + 1, failureSequence: event.sequence };
      previousHash = hash;
    }
    return { valid: true, checked: events.length };
  }
}
