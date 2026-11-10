/** Language-neutral ABI envelope for the Zig runtime adapter. No arbitrary code or shell execution. */
export type RuntimeCommand = "validate-contract" | "evaluate-policy" | "execute-approved-behavior" | "verify-invariant";
export interface ZigRuntimeRequest {
  readonly protocolVersion: "1";
  readonly tenantId: string;
  readonly executionId: string;
  readonly behaviorId: string;
  readonly command: RuntimeCommand;
  readonly inputDigest: string;
  readonly policyDigest: string;
  readonly proofRefs: readonly string[];
}
export interface ZigRuntimeResponse {
  readonly protocolVersion: "1";
  readonly executionId: string;
  readonly status: "accepted" | "rejected" | "completed" | "failed";
  readonly outputDigest?: string;
  readonly evidenceRefs: readonly string[];
  readonly errorCode?: string;
}
export interface ZigRuntimeTransport {
  invoke(request: ZigRuntimeRequest, signal: AbortSignal): Promise<ZigRuntimeResponse>;
}

const COMMANDS: ReadonlySet<string> = new Set(["validate-contract", "evaluate-policy", "execute-approved-behavior", "verify-invariant"]);
const STATUSES: ReadonlySet<string> = new Set(["accepted", "rejected", "completed", "failed"]);
export const ZIG_RUNTIME_MAX_FRAME_BYTES = 65_536;
const MAX_REFERENCES = 128;
const MAX_REFERENCE_LENGTH = 512;

function record(value: unknown, code: string): Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) throw new Error(code);
  return value as Record<string, unknown>;
}
function exactKeys(value: Record<string, unknown>, required: readonly string[], optional: readonly string[], code: string): void {
  const allowed = new Set([...required, ...optional]);
  if (required.some(key => !(key in value)) || Object.keys(value).some(key => !allowed.has(key))) throw new Error(code);
}
function nonEmptyString(value: unknown, code: string): asserts value is string {
  if (typeof value !== "string" || !value.trim() || value.length > MAX_REFERENCE_LENGTH) throw new Error(code);
}
function references(value: unknown, code: string): readonly string[] {
  if (!Array.isArray(value) || value.length > MAX_REFERENCES) throw new Error(code);
  for (const item of value) nonEmptyString(item, code);
  return Object.freeze([...value]);
}

export function validateZigRuntimeRequest(value: unknown): ZigRuntimeRequest {
  const input = record(value, "ZIG-CONTRACT-INVALID-REQUEST");
  exactKeys(input, ["protocolVersion", "tenantId", "executionId", "behaviorId", "command", "inputDigest", "policyDigest", "proofRefs"], [], "ZIG-CONTRACT-REQUEST-FIELDS");
  if (input.protocolVersion !== "1") throw new Error("ZIG-CONTRACT-VERSION");
  for (const key of ["tenantId", "executionId", "behaviorId", "inputDigest", "policyDigest"] as const) nonEmptyString(input[key], "ZIG-CONTRACT-EMPTY-" + key.toUpperCase());
  if (typeof input.command !== "string" || !COMMANDS.has(input.command)) throw new Error("ZIG-CONTRACT-UNKNOWN-COMMAND");
  return Object.freeze({
    protocolVersion: "1",
    tenantId: input.tenantId as string,
    executionId: input.executionId as string,
    behaviorId: input.behaviorId as string,
    command: input.command as RuntimeCommand,
    inputDigest: input.inputDigest as string,
    policyDigest: input.policyDigest as string,
    proofRefs: references(input.proofRefs, "ZIG-CONTRACT-INVALID-PROOF-REFS")
  });
}

export function validateZigRuntimeResponse(value: unknown, request?: ZigRuntimeRequest): ZigRuntimeResponse {
  const input = record(value, "ZIG-CONTRACT-INVALID-RESPONSE");
  exactKeys(input, ["protocolVersion", "executionId", "status", "evidenceRefs"], ["outputDigest", "errorCode"], "ZIG-CONTRACT-RESPONSE-FIELDS");
  if (input.protocolVersion !== "1") throw new Error("ZIG-CONTRACT-VERSION");
  nonEmptyString(input.executionId, "ZIG-CONTRACT-EMPTY-EXECUTIONID");
  if (request && input.executionId !== request.executionId) throw new Error("ZIG-CONTRACT-CORRELATION-MISMATCH");
  if (typeof input.status !== "string" || !STATUSES.has(input.status)) throw new Error("ZIG-CONTRACT-UNKNOWN-STATUS");
  const evidenceRefs = references(input.evidenceRefs, "ZIG-CONTRACT-INVALID-EVIDENCE-REFS");
  if (input.outputDigest !== undefined) nonEmptyString(input.outputDigest, "ZIG-CONTRACT-OUTPUT-DIGEST-INVALID");
  if (input.errorCode !== undefined) nonEmptyString(input.errorCode, "ZIG-CONTRACT-ERROR-CODE-INVALID");
  if (input.status === "completed" && input.outputDigest === undefined) throw new Error("ZIG-CONTRACT-OUTPUT-DIGEST-REQUIRED");
  if (input.status === "failed" && input.errorCode === undefined) throw new Error("ZIG-CONTRACT-ERROR-CODE-REQUIRED");
  const response: ZigRuntimeResponse = {
    protocolVersion: "1",
    executionId: input.executionId,
    status: input.status as ZigRuntimeResponse["status"],
    evidenceRefs,
    ...(input.outputDigest === undefined ? {} : { outputDigest: input.outputDigest as string }),
    ...(input.errorCode === undefined ? {} : { errorCode: input.errorCode as string })
  };
  return Object.freeze(response);
}

function assertFrameSize(value: string): void {
  if (new TextEncoder().encode(value).byteLength > ZIG_RUNTIME_MAX_FRAME_BYTES) throw new Error("ZIG-CONTRACT-FRAME-TOO-LARGE");
}
export function encodeZigRuntimeRequest(request: ZigRuntimeRequest): string {
  const encoded = JSON.stringify(validateZigRuntimeRequest(request));
  assertFrameSize(encoded);
  return encoded;
}
export function decodeZigRuntimeRequest(frame: string): ZigRuntimeRequest {
  assertFrameSize(frame);
  let parsed: unknown;
  try { parsed = JSON.parse(frame); } catch { throw new Error("ZIG-CONTRACT-INVALID-JSON"); }
  return validateZigRuntimeRequest(parsed);
}
export function encodeZigRuntimeResponse(response: ZigRuntimeResponse, request?: ZigRuntimeRequest): string {
  const encoded = JSON.stringify(validateZigRuntimeResponse(response, request));
  assertFrameSize(encoded);
  return encoded;
}
export function decodeZigRuntimeResponse(frame: string, request?: ZigRuntimeRequest): ZigRuntimeResponse {
  assertFrameSize(frame);
  let parsed: unknown;
  try { parsed = JSON.parse(frame); } catch { throw new Error("ZIG-CONTRACT-INVALID-JSON"); }
  return validateZigRuntimeResponse(parsed, request);
}

export async function invokeZigRuntime(transport: ZigRuntimeTransport, request: ZigRuntimeRequest, signal: AbortSignal): Promise<ZigRuntimeResponse> {
  const safeRequest = validateZigRuntimeRequest(request);
  if (signal.aborted) throw new Error("ZIG-CONTRACT-CANCELLED");
  const response = await transport.invoke(safeRequest, signal);
  return validateZigRuntimeResponse(response, safeRequest);
}
