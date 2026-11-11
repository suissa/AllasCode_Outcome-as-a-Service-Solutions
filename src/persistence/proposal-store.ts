import type { OutcomeProposal } from "../commercial/proposal.ts";

export type PersistedProposalStatus = "draft" | "ready_for_review" | "approved" | "rejected" | "superseded";
export interface PersistedProposal {
  proposal: OutcomeProposal;
  status: PersistedProposalStatus;
  source: { kind: string; missionId?: string; answerCount: number; knownAnswerCount: number };
  createdBy: string;
  updatedBy: string;
  createdAt: string;
  updatedAt: string;
}
export interface ProposalEvent {
  id: string;
  tenantId: string;
  proposalId: string;
  version: number;
  actorId: string;
  kind: "submitted" | "approved" | "rejected" | "superseded";
  reason?: string;
  occurredAt: string;
}
export interface CreateProposalCommand {
  tenantId: string;
  actorId: string;
  idempotencyKey: string;
  fingerprint: string;
  value: PersistedProposal;
  event: ProposalEvent;
}
export interface TransitionProposalCommand {
  tenantId: string;
  proposalId: string;
  actorId: string;
  expectedVersion: number;
  status: Extract<PersistedProposalStatus, "approved" | "rejected" | "superseded">;
  reason?: string;
  event: ProposalEvent;
}
export interface ProposalStore {
  create(command: CreateProposalCommand): Promise<{ value: PersistedProposal; replayed: boolean }>;
  get(tenantId: string, proposalId: string): Promise<PersistedProposal | undefined>;
  list(tenantId: string, limit?: number): Promise<readonly PersistedProposal[]>;
  transition(command: TransitionProposalCommand): Promise<PersistedProposal>;
  events(tenantId: string, proposalId: string): Promise<readonly ProposalEvent[]>;
}
