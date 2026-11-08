import type { OutcomeCase } from "../application/outcome-case.ts";
import type { SqlDatabase, SqlExecutor } from "./sql.ts";
import type { CommitCommand, CommitResult, OutcomeStore } from "./outcome-store.ts";
interface CaseRow extends Record<string, unknown> { payload: OutcomeCase; version: number }
interface IdempotencyRow extends Record<string, unknown> { fingerprint: string; result: OutcomeCase }
interface AuditRow extends Record<string, unknown> { payload: import("../domain/audit.ts").AuditEvent }

export class PostgresOutcomeStore implements OutcomeStore {
  constructor(private readonly db: SqlDatabase) {}
  async getCase(tenantId: string, caseId: string): Promise<OutcomeCase | undefined> {
    const result = await this.db.query<CaseRow>("select payload, version from outcome_cases where tenant_id = $1 and case_id = $2", [tenantId, caseId]);
    return result.rows[0]?.payload;
  }
  async createCase(value: OutcomeCase): Promise<void> {
    await this.db.query("insert into outcome_cases (tenant_id, case_id, payload, version) values ($1, $2, $3::jsonb, 1)", [value.tenantId, value.id, JSON.stringify(value)]);
  }
  async commit(command: CommitCommand): Promise<CommitResult> {
    return this.db.transaction(async (tx) => {
      const prior = await tx.query<IdempotencyRow>("select fingerprint, result from outcome_idempotency where tenant_id = $1 and idempotency_key = $2 for update", [command.tenantId, command.idempotencyKey]);
      const replay = prior.rows[0];
      if (replay) {
        if (replay.fingerprint !== command.fingerprint) throw new Error("IDEMPOTENCY_CONFLICT");
        return { value: replay.result, replayed: true };
      }
      const current = await tx.query<CaseRow>("select payload, version from outcome_cases where tenant_id = $1 and case_id = $2 for update", [command.tenantId, command.caseId]);
      if (!current.rows[0]) throw new Error("CASE_NOT_FOUND");
      await tx.query("update outcome_cases set payload = $3::jsonb, version = version + 1, updated_at = now() where tenant_id = $1 and case_id = $2", [command.tenantId, command.caseId, JSON.stringify(command.value)]);
      await tx.query("insert into outcome_audit_events (tenant_id, case_id, event_id, payload) values ($1, $2, $3, $4::jsonb)", [command.tenantId, command.caseId, command.audit.id, JSON.stringify(command.audit)]);
      await tx.query("insert into outcome_idempotency (tenant_id, idempotency_key, fingerprint, result) values ($1, $2, $3, $4::jsonb)", [command.tenantId, command.idempotencyKey, command.fingerprint, JSON.stringify(command.value)]);
      return { value: command.value, replayed: false };
    });
  }
  async auditTrail(tenantId: string, caseId?: string): Promise<readonly import("../domain/audit.ts").AuditEvent[]> {
    const result = caseId
      ? await this.db.query<AuditRow>("select payload from outcome_audit_events where tenant_id = $1 and case_id = $2 order by created_at, event_id", [tenantId, caseId])
      : await this.db.query<AuditRow>("select payload from outcome_audit_events where tenant_id = $1 order by created_at, event_id", [tenantId]);
    return Object.freeze(result.rows.map((row) => row.payload));
  }
}
export interface PostgresQueryClient {
  unsafe<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<readonly T[]>;
  begin<T>(work: (sql: PostgresTransactionClient) => Promise<T>): Promise<T>;
}
export interface PostgresTransactionClient { unsafe<T extends Record<string, unknown> = Record<string, unknown>>(sql: string, params?: readonly unknown[]): Promise<readonly T[]> }
export class PostgresJsDatabase implements SqlDatabase {
  constructor(private readonly client: PostgresQueryClient) {}
  async query<T extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []): Promise<{ rows: T[]; rowCount: number }> {
    const rows = await this.client.unsafe<T>(sql, params); return { rows: [...rows], rowCount: rows.length };
  }
  async transaction<T>(work: (tx: SqlExecutor) => Promise<T>): Promise<T> {
    return this.client.begin((client) => work({ query: async <R extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) => {
      const rows = await client.unsafe<R>(sql, params); return { rows: [...rows], rowCount: rows.length };
    } }));
  }
}
