export type IntentStatus = "draft" | "needs_clarification" | "qualified" | "rejected" | "discovery";
export type IntentChannel = "web" | "api" | "conversation" | "import";

export interface OutcomeIntent {
  id: string;
  tenantId: string;
  actorId: string;
  statement: string;
  desiredOutcome: string;
  scope: readonly string[];
  constraints: readonly string[];
  deadline?: string;
  status: IntentStatus;
  version: number;
  provenance: IntentProvenance;
  createdAt: string;
}

export interface IntentProvenance {
  channel: IntentChannel;
  sourceId: string;
  capturedAt: string;
  rawHash?: string;
}

const INTENT_CHANNELS = new Set<IntentChannel>(["web", "api", "conversation", "import"]);
const INTENT_STATUSES = new Set<IntentStatus>(["draft", "needs_clarification", "qualified", "rejected", "discovery"]);

function parsedTimestamp(value: unknown): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateIntent(i: OutcomeIntent): string[] {
  const errors: string[] = [];
  if (!i || typeof i !== "object") return ["intent:REQUIRED"];
  if (!nonEmpty(i.id)) errors.push("id:REQUIRED");
  if (!nonEmpty(i.statement)) errors.push("statement:REQUIRED");
  if (!nonEmpty(i.desiredOutcome)) errors.push("desiredOutcome:REQUIRED");
  if (!nonEmpty(i.tenantId)) errors.push("tenantId:REQUIRED");
  if (!nonEmpty(i.actorId)) errors.push("actorId:REQUIRED");
  if (!Number.isInteger(i.version) || i.version < 1) errors.push("version:INVALID");
  if (!INTENT_STATUSES.has(i.status)) errors.push("status:INVALID");
  if (!Array.isArray(i.scope) || i.scope.some((value) => !nonEmpty(value))) errors.push("scope:INVALID");
  if (!Array.isArray(i.constraints) || i.constraints.some((value) => !nonEmpty(value))) errors.push("constraints:INVALID");
  if (i.deadline !== undefined && parsedTimestamp(i.deadline) === undefined) errors.push("deadline:INVALID");
  if (!i.provenance || typeof i.provenance !== "object") {
    errors.push("provenance:REQUIRED");
  } else {
    if (!INTENT_CHANNELS.has(i.provenance.channel)) errors.push("provenance.channel:INVALID");
    if (!nonEmpty(i.provenance.sourceId)) errors.push("provenance.sourceId:REQUIRED");
    if (parsedTimestamp(i.provenance.capturedAt) === undefined) errors.push("provenance.capturedAt:INVALID");
  }
  if (parsedTimestamp(i.createdAt) === undefined) errors.push("createdAt:INVALID");
  return errors;
}

export function qualifyIntent(i: OutcomeIntent): OutcomeIntent {
  const errors = validateIntent(i);
  return Object.freeze({ ...i, status: errors.length ? "needs_clarification" : "qualified" });
}

export interface IntentCaptureInput {
  id: string;
  tenantId: string;
  actorId: string;
  statement: string;
  desiredOutcome: string;
  scope?: readonly string[];
  constraints?: readonly string[];
  deadline?: string;
  channel: IntentChannel;
  sourceId: string;
  capturedAt: string;
  createdAt: string;
}

function normalizeList(values: readonly string[] | undefined, errorCode: string): readonly string[] {
  if (values === undefined) return Object.freeze([]);
  if (!Array.isArray(values) || values.some((value) => !nonEmpty(value))) throw new Error(errorCode);
  return Object.freeze([...new Set(values.map((value) => value.trim()))]);
}

export function normalizeIntentEnvelope(input: IntentCaptureInput): IntentCaptureInput {
  if (!input || typeof input !== "object") throw new Error("INTENT_CAPTURE_INPUT_INVALID");
  if (!INTENT_CHANNELS.has(input.channel)) throw new Error("INTENT_CHANNEL_INVALID");
  return Object.freeze({
    ...input,
    statement: typeof input.statement === "string" ? input.statement.trim() : "",
    desiredOutcome: typeof input.desiredOutcome === "string" ? input.desiredOutcome.trim() : "",
    scope: normalizeList(input.scope, "INTENT_SCOPE_INVALID"),
    constraints: normalizeList(input.constraints, "INTENT_CONSTRAINTS_INVALID"),
    sourceId: typeof input.sourceId === "string" ? input.sourceId.trim() : "",
  });
}

export function captureIntent(input: IntentCaptureInput): OutcomeIntent {
  const normalized = normalizeIntentEnvelope(input);
  const intent: OutcomeIntent = {
    id: normalized.id,
    tenantId: normalized.tenantId,
    actorId: normalized.actorId,
    statement: normalized.statement,
    desiredOutcome: normalized.desiredOutcome,
    scope: normalized.scope ?? [],
    constraints: normalized.constraints ?? [],
    ...(normalized.deadline ? { deadline: normalized.deadline } : {}),
    status: "draft",
    version: 1,
    provenance: Object.freeze({
      channel: normalized.channel,
      sourceId: normalized.sourceId,
      capturedAt: normalized.capturedAt,
    }),
    createdAt: normalized.createdAt,
  };
  const capturedAt = parsedTimestamp(intent.provenance.capturedAt);
  const createdAt = parsedTimestamp(intent.createdAt);
  if (!intent.provenance.sourceId || capturedAt === undefined || createdAt === undefined || capturedAt > createdAt) {
    throw new Error("INTENT_PROVENANCE_INVALID");
  }

  const errors = validateIntent(intent);
  if (errors.length) throw new Error("INTENT_INVALID:" + errors.join(","));

  return Object.freeze({
    ...intent,
    scope: Object.freeze([...intent.scope]),
    constraints: Object.freeze([...intent.constraints]),
    provenance: Object.freeze({ ...intent.provenance }),
  });
}

export interface IntentExtractionResult {
  desiredOutcome?: string;
  scope?: readonly string[];
  constraints?: readonly string[];
  deadline?: string;
  domain?: string;
  confidence: number;
  ambiguities: readonly string[];
}
export type IntentExtractor = (statement: string, signal?: AbortSignal) => Promise<IntentExtractionResult>;
export type IntentExtractionOutcome =
  | { status: "captured"; intent: OutcomeIntent; extraction: IntentExtractionResult }
  | { status: "needs_clarification"; questions: readonly string[]; extraction: IntentExtractionResult };

export async function extractIntentFields(
  input: IntentCaptureInput,
  extractor: IntentExtractor,
  minConfidence = 0.75,
  signal?: AbortSignal,
): Promise<IntentExtractionOutcome> {
  if (!Number.isFinite(minConfidence) || minConfidence < 0 || minConfidence > 1) {
    throw new Error("INTENT_CONFIDENCE_THRESHOLD_INVALID");
  }
  const extracted = await extractor(input.statement, signal);
  if (!extracted || !Number.isFinite(extracted.confidence) || extracted.confidence < 0 || extracted.confidence > 1) {
    throw new Error("INTENT_EXTRACTION_CONFIDENCE_INVALID");
  }

  const desiredOutcome = input.desiredOutcome.trim() || extracted.desiredOutcome?.trim() || "";
  const scope = input.scope?.length ? input.scope : extracted.scope ?? [];
  const questions: string[] = [];
  if (extracted.confidence < minConfidence) questions.push("Please confirm the interpretation of the requested outcome.");
  if (!desiredOutcome) questions.push("What measurable result should change?");
  if (!scope.length) questions.push("Which process, team or customer segment is in scope?");
  if (!input.deadline && !extracted.deadline) questions.push("By when should this result be achieved?");
  for (const ambiguity of extracted.ambiguities ?? []) questions.push("Clarify: " + ambiguity);

  if (questions.length) {
    return Object.freeze({
      status: "needs_clarification",
      questions: Object.freeze([...new Set(questions)]),
      extraction: extracted,
    });
  }
  const deadline = input.deadline ?? extracted.deadline;
  const intent = captureIntent({
    ...input,
    desiredOutcome,
    scope,
    constraints: [...(input.constraints ?? []), ...(extracted.constraints ?? [])],
    ...(deadline !== undefined ? { deadline } : {}),
  });
  return Object.freeze({ status: "captured", intent, extraction: extracted });
}
