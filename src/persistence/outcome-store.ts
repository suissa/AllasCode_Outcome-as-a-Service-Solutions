import type { AuditEvent } from "../domain/audit.ts";
import type { OutcomeCase } from "../application/outcome-case.ts";
export interface CommitCommand { tenantId: string; caseId: string; idempotencyKey: string; fingerprint: string; value: OutcomeCase; audit: AuditEvent }
export interface CommitResult { value: OutcomeCase; replayed: boolean }
export interface OutcomeStore {
  getCase(tenantId: string, caseId: string): Promise<OutcomeCase | undefined>;
  createCase(value: OutcomeCase): Promise<void>;
  commit(command: CommitCommand): Promise<CommitResult>;
  auditTrail(tenantId: string, caseId?: string): Promise<readonly AuditEvent[]>;
}
