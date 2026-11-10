import { createHash, randomUUID } from "node:crypto";
import type { Agreement, AgreementSignature, SignatureVerifier } from "./agreement.ts";
import { activateSignedAgreement, recordAgreementSignature } from "./agreement.ts";
import type { OutcomeProposal, ProposalContractDraftInput } from "./proposal.ts";
import { composeContractFromOutcomeProposal } from "./proposal.ts";
import type { ContractPackage, ContractParty } from "./contract-composer.ts";

export type ContractLifecycleState = "draft" | "in_review" | "approved" | "active" | "cancelled";
export interface ContractRecord {
  tenantId: string;
  id: string;
  proposalId: string;
  proposalVersion: number;
  agreement: Agreement;
  document: ContractPackage;
  requiredSigners: readonly string[];
  state: ContractLifecycleState;
  revision: number;
  createdAt: string;
  updatedAt: string;
  activatedAt?: string;
}
export interface ContractEvent {
  tenantId: string;
  contractId: string;
  eventId: string;
  revision: number;
  actorId: string;
  correlationId: string;
  action: "created" | "submitted_for_review" | "approved_for_signature" | "signature_recorded" | "activated";
  fromState: ContractLifecycleState | null;
  toState: ContractLifecycleState;
  occurredAt: string;
  metadata: Readonly<Record<string, unknown>>;
}
export interface CreateContractRecordInput {
  proposal: OutcomeProposal;
  agreement: Agreement;
  parties: readonly ContractParty[];
  effectiveDate: string;
  expiryDate?: string;
  jurisdiction: string;
  approvedBy: string;
  requiredSigners: readonly string[];
  deliveryPlan?: Readonly<Record<string, unknown>>;
  sla?: Readonly<Record<string, unknown>>;
  security?: Readonly<Record<string, unknown>>;
  dataProcessing?: Readonly<Record<string, unknown>>;
  sectorTerms?: Readonly<Record<string, unknown>>;
}
export interface ContractCommandContext { tenantId: string; actorId: string; correlationId: string }
export interface ContractCommitCommand {
  tenantId: string; contractId: string; expectedRevision: number;
  idempotencyKey: string; fingerprint: string; value: ContractRecord; event: ContractEvent;
}
export interface ContractCommitResult { value: ContractRecord; replayed: boolean }
export interface ContractRegistryStore {
  createDraft(value: ContractRecord, event: ContractEvent, idempotencyKey: string, fingerprint: string): Promise<ContractCommitResult>;
  get(tenantId: string, contractId: string): Promise<ContractRecord | undefined>;
  commit(command: ContractCommitCommand): Promise<ContractCommitResult>;
  events(tenantId: string, contractId: string): Promise<readonly ContractEvent[]>;
}
const required = (value: string): boolean => typeof value === "string" && value.trim().length > 0;
const deepFreeze = <T>(value: T): T => {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
};
export function createContractRecord(input: CreateContractRecordInput, tenantId: string, now = new Date()): ContractRecord {
  if (!required(tenantId) || input.agreement.tenantId !== tenantId || input.proposal.tenantId !== tenantId) throw new Error("CONTRACT_TENANT_MISMATCH");
  if (!required(input.approvedBy)) throw new Error("CONTRACT_APPROVAL_REFERENCE_REQUIRED");
  if (!input.requiredSigners.length || input.requiredSigners.some(s => !required(s)) || new Set(input.requiredSigners).size !== input.requiredSigners.length) throw new Error("CONTRACT_REQUIRED_SIGNERS_INVALID");
  if (!Number.isFinite(now.getTime())) throw new Error("CONTRACT_GENERATION_DATE_INVALID");
  const draftInput: ProposalContractDraftInput = {
    proposal: input.proposal, agreement: input.agreement, parties: input.parties,
    effectiveDate: input.effectiveDate, ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
    jurisdiction: input.jurisdiction, approvedBy: input.approvedBy,
    ...(input.deliveryPlan ? { deliveryPlan: input.deliveryPlan } : {}),
    ...(input.sla ? { sla: input.sla } : {}),
    ...(input.security ? { security: input.security } : {}),
    ...(input.dataProcessing ? { dataProcessing: input.dataProcessing } : {}),
    ...(input.sectorTerms ? { sectorTerms: input.sectorTerms } : {}),
  };
  const document = composeContractFromOutcomeProposal(draftInput, now);
  const timestamp = now.toISOString();
  return deepFreeze({
    tenantId, id: document.id, proposalId: input.proposal.id, proposalVersion: input.proposal.version,
    agreement: { ...input.agreement }, document, requiredSigners: [...input.requiredSigners],
    state: "draft", revision: 1, createdAt: timestamp, updatedAt: timestamp,
  });
}
function nextRecord(record: ContractRecord, state: ContractLifecycleState, now: Date, changes: Partial<ContractRecord> = {}): ContractRecord {
  if (!Number.isFinite(now.getTime())) throw new Error("CONTRACT_TRANSITION_TIMESTAMP_INVALID");
  return deepFreeze({ ...record, ...changes, state, revision: record.revision + 1, updatedAt: now.toISOString() });
}
export function submitContractForReview(record: ContractRecord, actorId: string, now = new Date()): ContractRecord {
  if (!required(actorId)) throw new Error("CONTRACT_ACTOR_REQUIRED");
  if (record.state !== "draft") throw new Error("CONTRACT_REVIEW_TRANSITION_INVALID");
  return nextRecord(record, "in_review", now);
}
export function approveContractForSignature(record: ContractRecord, actorId: string, now = new Date()): ContractRecord {
  if (!required(actorId)) throw new Error("CONTRACT_ACTOR_REQUIRED");
  if (record.state !== "in_review") throw new Error("CONTRACT_APPROVAL_TRANSITION_INVALID");
  const agreement: Agreement = { ...record.agreement, status: "pending_approval", approvedBy: actorId };
  return nextRecord(record, "approved", now, { agreement });
}
export async function signContract(record: ContractRecord, signature: AgreementSignature, verifier: SignatureVerifier, now = new Date()): Promise<ContractRecord> {
  if (record.state !== "approved") throw new Error("CONTRACT_NOT_APPROVED_FOR_SIGNATURE");
  if (!record.requiredSigners.includes(signature.signerId)) throw new Error("CONTRACT_SIGNER_NOT_REQUIRED");
  const agreement = await recordAgreementSignature(record.agreement, signature, verifier);
  return nextRecord(record, "approved", now, { agreement });
}
export function activateContract(record: ContractRecord, actorId: string, now = new Date()): ContractRecord {
  if (!required(actorId)) throw new Error("CONTRACT_ACTOR_REQUIRED");
  if (record.state !== "approved") throw new Error("CONTRACT_NOT_APPROVED");
  const agreement = activateSignedAgreement(record.agreement, record.requiredSigners, now);
  return nextRecord(record, "active", now, { agreement, activatedAt: now.toISOString() });
}
export function createContractEvent(input: {
  record: ContractRecord; actorId: string; correlationId: string;
  action: ContractEvent["action"]; fromState: ContractLifecycleState | null; now?: Date;
  metadata?: Readonly<Record<string, unknown>>;
}): ContractEvent {
  const now = input.now ?? new Date();
  if (!required(input.actorId) || !required(input.correlationId) || !Number.isFinite(now.getTime())) throw new Error("CONTRACT_EVENT_CONTEXT_INVALID");
  return deepFreeze({
    tenantId: input.record.tenantId, contractId: input.record.id, eventId: randomUUID(),
    revision: input.record.revision, actorId: input.actorId, correlationId: input.correlationId,
    action: input.action, fromState: input.fromState, toState: input.record.state,
    occurredAt: now.toISOString(), metadata: { ...(input.metadata ?? {}), documentFingerprint: input.record.document.fingerprint },
  });
}
export function contractCommandFingerprint(action: string, payload: unknown): string {
  return createHash("sha256").update(JSON.stringify([action, payload]), "utf8").digest("hex");
}
