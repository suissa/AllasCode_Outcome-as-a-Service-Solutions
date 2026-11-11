import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { OutcomeCase } from "../application/outcome-case.ts";
import { mapDiscoveryToOutcomeProposal, type DiscoveryProposalOptions, type DiscoverySnapshot } from "../application/discovery-proposal.ts";
import { startOutcomeCase, recordOutcomeEvidence, recordObservation, settleOutcomeCase, disputeOutcomeCase, validateOutcomeCase } from "../application/outcome-case.ts";
import { createAuditEvent } from "../domain/audit.ts";
import type { EvidenceRecord } from "../evidence/evidence.ts";
import type { Observation } from "../measurement/metrics.ts";
import type { OutcomeStore } from "../persistence/outcome-store.ts";
import type { ProposalStore, PersistedProposal } from "../persistence/proposal-store.ts";
import { mapDiscoveryToOutcomeProposal, type DiscoverySnapshot, type DiscoveryProposalOptions } from "../application/discovery-proposal.ts";
import type { ContractRegistryStore, CreateContractRecordInput, ContractRecord } from "../commercial/contract-workflow.ts";
import { createContractRecord, createContractEvent, submitContractForReview, approveContractForSignature, signContract, activateContract, contractCommandFingerprint } from "../commercial/contract-workflow.ts";
import type { SignatureVerifier, AgreementSignature } from "../commercial/agreement.ts";

export interface AuthenticatedActor { tenantId: string; actorId: string; roles: readonly string[] }
export type Authenticate = (request: IncomingMessage) => Promise<AuthenticatedActor | undefined>;
export type Authorize = (actor: AuthenticatedActor, action: string, resource?: OutcomeCase | PersistedProposal) => boolean | Promise<boolean>;
export interface OutcomeHttpOptions { store: OutcomeStore; proposalStore?: ProposalStore; authenticate: Authenticate; authorize: Authorize; contracts?: ContractRegistryStore; verifyContractSignature?: SignatureVerifier; now?: () => Date }
type JsonObject = Record<string, unknown>;

async function readBody(request: IncomingMessage): Promise<JsonObject> {
  const chunks: Buffer[] = []; let size = 0;
  for await (const chunk of request) {
    const part = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk); size += part.length;
    if (size > 1_048_576) throw Object.assign(new Error("PAYLOAD_TOO_LARGE"), { statusCode: 413 });
    chunks.push(part);
  }
  if (!chunks.length) return {};
  let parsed: unknown;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw Object.assign(new Error("JSON_INVALID"), { statusCode: 400 }); }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw Object.assign(new Error("OBJECT_REQUIRED"), { statusCode: 400 });
  return parsed as JsonObject;
}
function send(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}
function requiredString(value: unknown, code: string): string {
  if (typeof value !== "string" || !value.trim()) throw Object.assign(new Error(code), { statusCode: 400 });
  return value;
}
function fingerprint(action: string, payload: unknown): string { return JSON.stringify([action, payload]); }

export function createOutcomeHttpServer(options: OutcomeHttpOptions): Server {
  const now = options.now ?? (() => new Date());
  return createServer(async (request, response) => {
    const correlationId = request.headers["x-correlation-id"]?.toString() || randomUUID();
    try {
      const url = new URL(request.url ?? "/", "http://localhost");
      if (request.method === "GET" && url.pathname === "/health") {
        send(response, 200, { status: "ok", service: "outcome-platform", timestamp: now().toISOString() }); return;
      }
      const actor = await options.authenticate(request);
      if (!actor || !actor.tenantId || !actor.actorId) { send(response, 401, { error: "AUTHENTICATION_REQUIRED", correlationId }); return; }
      if (request.method === "POST" && url.pathname === "/v1/proposals/preview") {
        if (!(await options.authorize(actor, "proposal.preview"))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
        const input = await readBody(request);
        const snapshot = input.snapshot;
        const proposalOptions = input.options;
        if (!snapshot || typeof snapshot !== "object" || Array.isArray(snapshot)) throw Object.assign(new Error("DISCOVERY_SNAPSHOT_REQUIRED"), { statusCode: 400 });
        if (!proposalOptions || typeof proposalOptions !== "object" || Array.isArray(proposalOptions)) throw Object.assign(new Error("PROPOSAL_OPTIONS_REQUIRED"), { statusCode: 400 });
        const safeOptions = {
          ...(proposalOptions as Partial<DiscoveryProposalOptions>),
          tenantId: actor.tenantId,
          proposalId: "proposal_preview_" + randomUUID(),
          version: 1,
        } as DiscoveryProposalOptions;
        const preview = mapDiscoveryToOutcomeProposal(snapshot as DiscoverySnapshot, safeOptions, now());
        send(response, 200, { value: preview.proposal, source: preview.source, unmapped: preview.unmapped, correlationId });
        return;
      }
      const proposalParts = url.pathname.split("/").filter(Boolean);
      if (proposalParts[0] === "v1" && proposalParts[1] === "proposals") {
        const proposalStore = options.proposalStore;
        if (!proposalStore) { send(response, 503, { error: "PROPOSAL_STORAGE_UNAVAILABLE", correlationId }); return; }
        if (proposalParts.length === 2 && request.method === "POST") {
          if (!(await options.authorize(actor, "proposal.create"))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
          const idempotencyKey = requiredString(request.headers["idempotency-key"], "IDEMPOTENCY_KEY_REQUIRED");
          const input = await readBody(request);
          if (!input.snapshot || typeof input.snapshot !== "object" || Array.isArray(input.snapshot)) throw Object.assign(new Error("DISCOVERY_SNAPSHOT_REQUIRED"), { statusCode: 400 });
          if (!input.options || typeof input.options !== "object" || Array.isArray(input.options)) throw Object.assign(new Error("PROPOSAL_OPTIONS_REQUIRED"), { statusCode: 400 });
          const safeOptions = { ...(input.options as Partial<DiscoveryProposalOptions>), tenantId: actor.tenantId, proposalId: "proposal_" + randomUUID(), version: 1 } as DiscoveryProposalOptions;
          const composed = mapDiscoveryToOutcomeProposal(input.snapshot as DiscoverySnapshot, safeOptions, now());
          const timestamp = now().toISOString();
          const persistedStatus = composed.proposal.readiness.status === "ready_for_review" ? "ready_for_review" : "draft";
          const value: PersistedProposal = { proposal: composed.proposal, status: persistedStatus, source: composed.source, createdBy: actor.actorId, updatedBy: actor.actorId, createdAt: timestamp, updatedAt: timestamp };
          const result = await proposalStore.create({ tenantId: actor.tenantId, actorId: actor.actorId, idempotencyKey, fingerprint: fingerprint("proposal.submit", { snapshot: input.snapshot, options: input.options }), value, event: { id: randomUUID(), tenantId: actor.tenantId, proposalId: value.proposal.id, version: 1, actorId: actor.actorId, kind: "submitted", occurredAt: timestamp } });
          send(response, result.replayed ? 200 : 201, { value: result.value, replayed: result.replayed, unmapped: composed.unmapped, correlationId }); return;
        }
        if (proposalParts.length === 2 && request.method === "GET") {
          if (!(await options.authorize(actor, "proposal.list"))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
          const limit = Number(url.searchParams.get("limit") ?? "50");
          if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Object.assign(new Error("PROPOSAL_LIST_LIMIT_INVALID"), { statusCode: 400 });
          send(response, 200, { value: await proposalStore.list(actor.tenantId, limit), correlationId }); return;
        }
        const proposalId = proposalParts[2];
        if (!proposalId) { send(response, 404, { error: "ROUTE_NOT_FOUND", correlationId }); return; }
        const currentProposal = await proposalStore.get(actor.tenantId, proposalId);
        if (!currentProposal) { send(response, 404, { error: "PROPOSAL_NOT_FOUND", correlationId }); return; }
        if (proposalParts.length === 3 && request.method === "GET") {
          if (!(await options.authorize(actor, "proposal.read", currentProposal))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
          send(response, 200, { value: currentProposal, correlationId }); return;
        }
        if (proposalParts[3] === "events" && request.method === "GET") {
          if (!(await options.authorize(actor, "proposal.audit.read", currentProposal))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
          send(response, 200, { value: await proposalStore.events(actor.tenantId, proposalId), correlationId }); return;
        }
        if (proposalParts[3] === "review" && request.method === "POST" && proposalParts.length === 4) {
          const input = await readBody(request);
          if (input.decision !== "approve" && input.decision !== "reject") throw Object.assign(new Error("PROPOSAL_REVIEW_DECISION_INVALID"), { statusCode: 400 });
          const action = input.decision === "approve" ? "proposal.approve" : "proposal.reject";
          if (!(await options.authorize(actor, action, currentProposal))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
          if (typeof input.expectedVersion !== "number" || !Number.isInteger(input.expectedVersion) || input.expectedVersion < 1) throw Object.assign(new Error("PROPOSAL_EXPECTED_VERSION_REQUIRED"), { statusCode: 400 });
          const reason = input.decision === "reject" ? requiredString(input.reason, "PROPOSAL_REJECTION_REASON_REQUIRED") : undefined;
          const timestamp = now().toISOString();
          const next = await proposalStore.transition({ tenantId: actor.tenantId, proposalId, actorId: actor.actorId, expectedVersion: input.expectedVersion, status: input.decision === "approve" ? "approved" : "rejected", ...(reason ? { reason } : {}), event: { id: randomUUID(), tenantId: actor.tenantId, proposalId, version: input.expectedVersion + 1, actorId: actor.actorId, kind: input.decision === "approve" ? "approved" : "rejected", ...(reason ? { reason } : {}), occurredAt: timestamp } });
          send(response, 200, { value: next, correlationId }); return;
        }
        send(response, 404, { error: "ROUTE_NOT_FOUND", correlationId }); return;
      }
      const parts = url.pathname.split("/").filter(Boolean);
      if (parts[0] === "v1" && parts[1] === "contracts") {
        const registry = options.contracts;
        if (!registry) { send(response, 503, { error: "CONTRACT_REGISTRY_UNAVAILABLE", correlationId }); return; }
        if (parts.length === 3 && parts[2] === "drafts" && request.method === "POST") {
          if (!(await options.authorize(actor, "contract.create")) || !(await options.authorize(actor, "proposal.approve"))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
          const input = await readBody(request);
          const idempotencyKey = requiredString(request.headers["idempotency-key"], "IDEMPOTENCY_KEY_REQUIRED");
          if (!Array.isArray(input.requiredSigners) || input.requiredSigners.some(s => typeof s !== "string")) throw Object.assign(new Error("CONTRACT_REQUIRED_SIGNERS_INVALID"), { statusCode: 400 });
          const createInput: CreateContractRecordInput = {
            proposal: input.proposal as CreateContractRecordInput["proposal"], agreement: input.agreement as CreateContractRecordInput["agreement"],
            parties: input.parties as CreateContractRecordInput["parties"], effectiveDate: requiredString(input.effectiveDate, "CONTRACT_EFFECTIVE_DATE_REQUIRED"),
            jurisdiction: requiredString(input.jurisdiction, "CONTRACT_JURISDICTION_REQUIRED"), approvedBy: actor.actorId, requiredSigners: input.requiredSigners as string[],
            ...(typeof input.expiryDate === "string" ? { expiryDate: input.expiryDate } : {}),
            ...(input.deliveryPlan && typeof input.deliveryPlan === "object" ? { deliveryPlan: input.deliveryPlan as Record<string, unknown> } : {}),
            ...(input.sla && typeof input.sla === "object" ? { sla: input.sla as Record<string, unknown> } : {}),
            ...(input.security && typeof input.security === "object" ? { security: input.security as Record<string, unknown> } : {}),
            ...(input.dataProcessing && typeof input.dataProcessing === "object" ? { dataProcessing: input.dataProcessing as Record<string, unknown> } : {}),
            ...(input.sectorTerms && typeof input.sectorTerms === "object" ? { sectorTerms: input.sectorTerms as Record<string, unknown> } : {}),
          };
          const value = createContractRecord(createInput, actor.tenantId, now());
          const event = createContractEvent({ record: value, actorId: actor.actorId, correlationId, action: "created", fromState: null, now: now(), metadata: { proposalId: value.proposalId, proposalVersion: value.proposalVersion, proposalApprovedBy: value.proposalApproval.approvedBy } });
          const result = await registry.createDraft(value, event, idempotencyKey, contractCommandFingerprint("create", createInput));
          send(response, result.replayed ? 200 : 201, { value: result.value, replayed: result.replayed, correlationId }); return;
        }
        const contractId = decodeURIComponent(parts[2] ?? "");
        if (!contractId) { send(response, 404, { error: "ROUTE_NOT_FOUND", correlationId }); return; }
        const current = await registry.get(actor.tenantId, contractId);
        if (!current) { send(response, 404, { error: "CONTRACT_NOT_FOUND", correlationId }); return; }
        if (parts.length === 3 && request.method === "GET") {
          if (!(await options.authorize(actor, "contract.read"))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
          send(response, 200, { value: current, correlationId }); return;
        }
        if (parts.length === 4 && parts[3] === "events" && request.method === "GET") {
          if (!(await options.authorize(actor, "contract.events.read"))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
          send(response, 200, { value: await registry.events(actor.tenantId, contractId), correlationId }); return;
        }
        if (request.method !== "POST" || parts.length !== 4) { send(response, 404, { error: "ROUTE_NOT_FOUND", correlationId }); return; }
        const action = parts[3]!;
        if (!(await options.authorize(actor, "contract." + action))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
        const input = await readBody(request);
        const idempotencyKey = requiredString(request.headers["idempotency-key"], "IDEMPOTENCY_KEY_REQUIRED");
        const commandFingerprint = contractCommandFingerprint(action + ":" + contractId, input);
        const replay = await registry.getIdempotentResult(actor.tenantId, idempotencyKey, commandFingerprint);
        if (replay) { send(response, 200, { value: replay, replayed: true, correlationId }); return; }
        const at = now(); let next: ContractRecord;
        let eventAction: import("../commercial/contract-workflow.ts").ContractEvent["action"];
        let metadata: Record<string, unknown> = {};
        switch (action) {
          case "submit-review": next = submitContractForReview(current, actor.actorId, at); eventAction = "submitted_for_review"; break;
          case "approve": next = approveContractForSignature(current, actor.actorId, at); eventAction = "approved_for_signature"; break;
          case "signatures": {
            if (!options.verifyContractSignature) { send(response, 503, { error: "SIGNATURE_VERIFIER_NOT_CONFIGURED", correlationId }); return; }
            const signature = input.signature as AgreementSignature;
            if (!signature || typeof signature !== "object") throw Object.assign(new Error("CONTRACT_SIGNATURE_REQUIRED"), { statusCode: 400 });
            next = await signContract(current, signature, options.verifyContractSignature, at);
            eventAction = "signature_recorded"; metadata = { signerId: signature.signerId, provider: signature.provider }; break;
          }
          case "activate": next = activateContract(current, actor.actorId, at); eventAction = "activated"; break;
          default: send(response, 404, { error: "ROUTE_NOT_FOUND", correlationId }); return;
        }
        const event = createContractEvent({ record: next, actorId: actor.actorId, correlationId, action: eventAction, fromState: current.state, now: at, metadata });
        const result = await registry.commit({ tenantId: actor.tenantId, contractId, expectedRevision: current.revision, idempotencyKey, fingerprint: commandFingerprint, value: next, event });
        send(response, 200, { value: result.value, replayed: result.replayed, correlationId }); return;
      }
      if (parts[0] !== "v1" || parts[1] !== "cases") { send(response, 404, { error: "ROUTE_NOT_FOUND", correlationId }); return; }
      if (parts.length === 2 && request.method === "POST") {
        if (!(await options.authorize(actor, "case.create"))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
        const input = await readBody(request); const value = input as unknown as OutcomeCase;
        if (value.tenantId && value.tenantId !== actor.tenantId) { send(response, 403, { error: "TENANT_MISMATCH", correlationId }); return; }
        const safe = Object.freeze({ ...value, tenantId: actor.tenantId });
        const errors = validateOutcomeCase(safe);
        if (errors.length) { send(response, 400, { error: "CASE_PAYLOAD_INVALID", issues: errors, correlationId }); return; }
        await options.store.createCase(safe); send(response, 201, { value: safe, correlationId }); return;
      }
      const caseId = parts[2];
      if (!caseId) { send(response, 404, { error: "ROUTE_NOT_FOUND", correlationId }); return; }
      const current = await options.store.getCase(actor.tenantId, caseId);
      if (!current) { send(response, 404, { error: "CASE_NOT_FOUND", correlationId }); return; }
      if (parts.length === 3 && request.method === "GET") {
        if (!(await options.authorize(actor, "case.read", current))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
        send(response, 200, { value: current, correlationId }); return;
      }
      if (parts[3] === "audit" && request.method === "GET") {
        if (!(await options.authorize(actor, "case.audit.read", current))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
        send(response, 200, { value: await options.store.auditTrail(actor.tenantId, caseId), correlationId }); return;
      }
      if (request.method !== "POST" || parts.length !== 4) { send(response, 404, { error: "ROUTE_NOT_FOUND", correlationId }); return; }
      const action = parts[3]!;
      if (!(await options.authorize(actor, "case." + action, current))) { send(response, 403, { error: "FORBIDDEN", correlationId }); return; }
      const input = await readBody(request);
      const idempotencyKey = requiredString(request.headers["idempotency-key"], "IDEMPOTENCY_KEY_REQUIRED");
      let next: OutcomeCase;
      switch (action) {
        case "start": next = startOutcomeCase(current); break;
        case "evidence": next = recordOutcomeEvidence(current, input.evidence as EvidenceRecord, requiredString(input.expectedHash, "EXPECTED_HASH_REQUIRED")); break;
        case "observations": next = recordObservation(current, input.observation as Observation); break;
        case "settle":
          if (typeof input.observationIndex !== "number" || !Number.isInteger(input.observationIndex)) throw Object.assign(new Error("OBSERVATION_INDEX_REQUIRED"), { statusCode: 400 });
          next = settleOutcomeCase(current, input.observationIndex, requiredString(input.methodology, "METHODOLOGY_REQUIRED"), requiredString(input.reportId, "REPORT_ID_REQUIRED"), now()); break;
        case "disputes": next = disputeOutcomeCase(current, requiredString(input.reason, "DISPUTE_REASON_REQUIRED")); break;
        default: send(response, 404, { error: "ROUTE_NOT_FOUND", correlationId }); return;
      }
      const audit = createAuditEvent({ id: randomUUID(), tenantId: actor.tenantId, actorId: actor.actorId, action: "case." + action, subjectType: "OutcomeCase", subjectId: caseId, correlationId, before: current.stage, after: next.stage });
      const result = await options.store.commit({ tenantId: actor.tenantId, caseId, idempotencyKey, fingerprint: fingerprint(action + ":" + caseId, input), value: next, audit });
      send(response, 200, { value: result.value, replayed: result.replayed, correlationId });
    } catch (error) {
      const err = error as Error & { statusCode?: number };
      const code = err.message || "INTERNAL_ERROR";
      const status = err.statusCode ?? (code === "CASE_NOT_FOUND" ? 404 : code === "IDEMPOTENCY_CONFLICT" ? 409 : 422);
      send(response, status, { error: code, correlationId });
    }
  });
}
