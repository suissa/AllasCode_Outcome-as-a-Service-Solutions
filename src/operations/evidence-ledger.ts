import { createHash } from "node:crypto";

export interface LedgerEvent<T> {
  readonly sequence: number; readonly tenantId: string; readonly eventId: string;
  readonly eventType: string; readonly occurredAt: string; readonly payload: T;
  readonly previousHash: string; readonly hash: string;
}
export interface LedgerAppend<T> {
  readonly tenantId: string; readonly eventId: string; readonly eventType: string;
  readonly occurredAt: string; readonly payload: T;
}
export interface AppendOnlyLedger<T> {
  append(input: LedgerAppend<T>): Promise<LedgerEvent<T>>;
  readTenant(tenantId: string, afterSequence?: number): Promise<readonly LedgerEvent<T>[]>;
  verifyTenant(tenantId: string): Promise<{ valid: boolean; checked: number; failureSequence?: number }>;
}
const GENESIS = "0".repeat(64);
function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const record = value as Record<string, unknown>;
  return "{" + Object.keys(record).sort().map(k => JSON.stringify(k)+":"+canonical(record[k])).join(",") + "}";
}
function digest(value: unknown): string { return createHash("sha256").update(canonical(value)).digest("hex"); }

/** In-memory reference only. Production must use a durable transactional append-only adapter. */
export class MemoryAppendOnlyLedger<T> implements AppendOnlyLedger<T> {
  private readonly events = new Map<string, LedgerEvent<T>[]>();
  private readonly eventIds = new Map<string, Set<string>>();
  async append(input: LedgerAppend<T>): Promise<LedgerEvent<T>> {
    if (!input.tenantId.trim() || !input.eventId.trim() || !input.eventType.trim()) throw new Error("LEDGER-REQUIRED-FIELD");
    if (!Number.isFinite(Date.parse(input.occurredAt))) throw new Error("LEDGER-INVALID-TIMESTAMP");
    const events = this.events.get(input.tenantId) ?? [];
    const ids = this.eventIds.get(input.tenantId) ?? new Set<string>();
    if (ids.has(input.eventId)) throw new Error("LEDGER-DUPLICATE-EVENT");
    const previousHash = events.at(-1)?.hash ?? GENESIS;
    const base = Object.freeze({ sequence: events.length + 1, ...input, payload: structuredClone(input.payload), previousHash });
    const event = Object.freeze({ ...base, hash: digest(base) });
    events.push(event); ids.add(input.eventId);
    this.events.set(input.tenantId, events); this.eventIds.set(input.tenantId, ids);
    return structuredClone(event);
  }
  async readTenant(tenantId: string, afterSequence = 0): Promise<readonly LedgerEvent<T>[]> {
    return structuredClone((this.events.get(tenantId) ?? []).filter(e => e.sequence > afterSequence));
  }
  async verifyTenant(tenantId: string): Promise<{ valid: boolean; checked: number; failureSequence?: number }> {
    const events = this.events.get(tenantId) ?? []; let previousHash = GENESIS;
    for (let i=0;i<events.length;i++) {
      const event=events[i]!;
      const { hash, ...base } = event;
      if (event.sequence !== i+1 || event.previousHash !== previousHash || digest(base) !== hash)
        return { valid:false, checked:i+1, failureSequence:event.sequence };
      previousHash=hash;
    }
    return { valid:true, checked:events.length };
  }
}
