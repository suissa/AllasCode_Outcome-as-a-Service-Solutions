import type { SqlDatabase } from "./sql.ts";
import type { CreateProposalCommand, PersistedProposal, ProposalEvent, ProposalStore, TransitionProposalCommand } from "./proposal-store.ts";

interface ProposalRow extends Record<string, unknown> { payload: PersistedProposal | string }
interface IdempotencyRow extends Record<string, unknown> { fingerprint: string; proposal_id: string }
interface EventRow extends Record<string, unknown> { payload: ProposalEvent | string }
const decode = <T>(value: T | string): T => typeof value === "string" ? JSON.parse(value) as T : value;

export class PostgresProposalStore implements ProposalStore {
  constructor(private readonly db: SqlDatabase) {}

  async create(command: CreateProposalCommand): Promise<{ value: PersistedProposal; replayed: boolean }> {
    if (!command.tenantId.trim() || !command.actorId.trim() || !command.idempotencyKey.trim() || !command.fingerprint.trim()
      || command.value.proposal.tenantId !== command.tenantId || command.value.proposal.status !== "draft"
      || command.value.status !== "ready_for_review" || command.value.proposal.readiness.status !== "ready_for_review"
      || command.event.tenantId !== command.tenantId || command.event.proposalId !== command.value.proposal.id
      || command.event.version !== command.value.proposal.version || command.event.actorId !== command.actorId
      || command.event.kind !== "submitted") throw new Error("PROPOSAL_CREATE_COMMAND_INVALID");
    return this.db.transaction(async tx => {
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1, 0))", [command.tenantId + ":proposal:" + command.idempotencyKey]);
      const prior = await tx.query<IdempotencyRow>(
        "select fingerprint, proposal_id from outcome_proposal_idempotency where tenant_id = $1 and idempotency_key = $2 for update",
        [command.tenantId, command.idempotencyKey],
      );
      if (prior.rows[0]) {
        if (prior.rows[0].fingerprint !== command.fingerprint) throw new Error("PROPOSAL_IDEMPOTENCY_CONFLICT");
        const existing = await tx.query<ProposalRow>(
          "select payload from outcome_proposals where tenant_id = $1 and proposal_id = $2",
          [command.tenantId, prior.rows[0].proposal_id],
        );
        if (!existing.rows[0]) throw new Error("PROPOSAL_IDEMPOTENCY_ORPHANED");
        return { value: decode(existing.rows[0].payload), replayed: true };
      }
      await tx.query(
        "insert into outcome_proposals (tenant_id, proposal_id, version, status, payload, source, created_by, updated_by) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb,$7,$7)",
        [command.tenantId, command.value.proposal.id, command.value.proposal.version, command.value.status, JSON.stringify(command.value), JSON.stringify(command.value.source), command.actorId],
      );
      await tx.query(
        "insert into outcome_proposal_events (tenant_id, proposal_id, event_id, version, actor_id, event_type, payload) values ($1,$2,$3,$4,$5,$6,$7::jsonb)",
        [command.event.tenantId, command.event.proposalId, command.event.id, command.event.version, command.event.actorId, command.event.kind, JSON.stringify(command.event)],
      );
      await tx.query(
        "insert into outcome_proposal_idempotency (tenant_id, idempotency_key, fingerprint, proposal_id) values ($1,$2,$3,$4)",
        [command.tenantId, command.idempotencyKey, command.fingerprint, command.value.proposal.id],
      );
      return { value: command.value, replayed: false };
    });
  }

  async get(tenantId: string, proposalId: string): Promise<PersistedProposal | undefined> {
    const result = await this.db.query<ProposalRow>(
      "select payload from outcome_proposals where tenant_id = $1 and proposal_id = $2",
      [tenantId, proposalId],
    );
    return result.rows[0] ? decode(result.rows[0].payload) : undefined;
  }

  async list(tenantId: string, limit = 50): Promise<readonly PersistedProposal[]> {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw new Error("PROPOSAL_LIST_LIMIT_INVALID");
    const result = await this.db.query<ProposalRow>(
      "select payload from outcome_proposals where tenant_id = $1 order by updated_at desc, proposal_id limit $2",
      [tenantId, limit],
    );
    return Object.freeze(result.rows.map(row => decode(row.payload)));
  }

  async transition(command: TransitionProposalCommand): Promise<PersistedProposal> {
    const expectedEventKind = command.status === "approved" ? "approved" : command.status === "rejected" ? "rejected" : "superseded";
    if (!command.tenantId.trim() || !command.proposalId.trim() || !command.actorId.trim()
      || !Number.isInteger(command.expectedVersion) || command.expectedVersion < 1
      || command.event.tenantId !== command.tenantId || command.event.proposalId !== command.proposalId
      || command.event.version !== command.expectedVersion + 1 || command.event.actorId !== command.actorId
      || command.event.kind !== expectedEventKind) throw new Error("PROPOSAL_TRANSITION_COMMAND_INVALID");
    return this.db.transaction(async tx => {
      const current = await tx.query<ProposalRow>(
        "select payload from outcome_proposals where tenant_id = $1 and proposal_id = $2 for update",
        [command.tenantId, command.proposalId],
      );
      if (!current.rows[0]) throw new Error("PROPOSAL_NOT_FOUND");
      const value = decode(current.rows[0].payload);
      if (value.proposal.version !== command.expectedVersion) throw new Error("PROPOSAL_VERSION_CONFLICT");
      if (value.status !== "ready_for_review" || !["approved", "rejected", "superseded"].includes(command.status)) {
        throw new Error("PROPOSAL_TRANSITION_NOT_ALLOWED");
      }
      if (command.status === "rejected" && !command.reason?.trim()) throw new Error("PROPOSAL_REJECTION_REASON_REQUIRED");
      const next: PersistedProposal = {
        ...value,
        status: command.status,
        proposal: { ...value.proposal, version: value.proposal.version + 1 },
        updatedBy: command.actorId,
        updatedAt: command.event.occurredAt,
      };
      await tx.query(
        "update outcome_proposals set version = $3, status = $4, payload = $5::jsonb, updated_by = $6, updated_at = $7 where tenant_id = $1 and proposal_id = $2",
        [command.tenantId, command.proposalId, next.proposal.version, next.status, JSON.stringify(next), command.actorId, next.updatedAt],
      );
      await tx.query(
        "insert into outcome_proposal_events (tenant_id, proposal_id, event_id, version, actor_id, event_type, payload) values ($1,$2,$3,$4,$5,$6,$7::jsonb)",
        [command.event.tenantId, command.event.proposalId, command.event.id, command.event.version, command.event.actorId, command.event.kind, JSON.stringify(command.event)],
      );
      return next;
    });
  }

  async events(tenantId: string, proposalId: string): Promise<readonly ProposalEvent[]> {
    const result = await this.db.query<EventRow>(
      "select payload from outcome_proposal_events where tenant_id = $1 and proposal_id = $2 order by created_at, event_id",
      [tenantId, proposalId],
    );
    return Object.freeze(result.rows.map(row => decode(row.payload)));
  }
}
