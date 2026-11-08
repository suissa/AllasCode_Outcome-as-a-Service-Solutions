import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import type { OutcomeCase } from "../application/outcome-case.ts";
import { startOutcomeCase, recordOutcomeEvidence, recordObservation, settleOutcomeCase, disputeOutcomeCase, validateOutcomeCase } from "../application/outcome-case.ts";
import { createAuditEvent } from "../domain/audit.ts";
import type { EvidenceRecord } from "../evidence/evidence.ts";
import type { Observation } from "../measurement/metrics.ts";
import type { OutcomeStore } from "../persistence/outcome-store.ts";

export interface AuthenticatedActor { tenantId: string; actorId: string; roles: readonly string[] }
export type Authenticate = (request: IncomingMessage) => Promise<AuthenticatedActor | undefined>;
export type Authorize = (actor: AuthenticatedActor, action: string, resource?: OutcomeCase) => boolean | Promise<boolean>;
export interface OutcomeHttpOptions { store: OutcomeStore; authenticate: Authenticate; authorize: Authorize; now?: () => Date }
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
      const parts = url.pathname.split("/").filter(Boolean);
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
