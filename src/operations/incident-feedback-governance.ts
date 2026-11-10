import { createHash } from "node:crypto";

export class IncidentFeedbackError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "IncidentFeedbackError";
  }
}

export type IncidentSeverity = "sev1" | "sev2" | "sev3" | "sev4";
export type IncidentStatus = "open" | "acknowledged" | "investigating" | "mitigated" | "resolved" | "closed";

export interface GovernedIncident {
  id: string;
  tenantId: string;
  severity: IncidentSeverity;
  summary: string;
  status: IncidentStatus;
  openedAt: string;
  updatedAt: string;
  revision: number;
  assignedTo?: string;
  acknowledgedAt?: string;
  mitigatedAt?: string;
  resolvedAt?: string;
  closedAt?: string;
  resolutionSummary?: string;
  lessons: readonly string[];
  evidenceIds: readonly string[];
}

export interface TenantFeedback {
  id: string;
  tenantId: string;
  subjectId: string;
  actorId: string;
  rating: number;
  category: string;
  comment?: string;
  submittedAt: string;
}

export interface IncidentTransitionEvent {
  idempotencyKey: string;
  tenantId: string;
  incidentId: string;
  actorId: string;
  from: IncidentStatus;
  to: IncidentStatus;
  reason: string;
  occurredAt: string;
  revision: number;
}

export interface IncidentFeedbackStore {
  getIncident(tenantId: string, id: string): Promise<GovernedIncident | undefined>;
  findTransition(tenantId: string, idempotencyKey: string): Promise<GovernedIncident | undefined>;
  commitIncident(updated: GovernedIncident, expectedRevision: number, event: IncidentTransitionEvent, idempotencyKey: string): Promise<boolean>;
  appendFeedback(feedback: TenantFeedback, idempotencyKey: string): Promise<TenantFeedback>;
  listFeedback(tenantId: string): Promise<readonly TenantFeedback[]>;
}

export interface IncidentPostmortemAction {
  id: string;
  description: string;
  ownerId: string;
  dueAt: string;
}

export interface IncidentPostmortem {
  id: string;
  tenantId: string;
  incidentId: string;
  incidentRevision: number;
  preparedBy: string;
  reviewerId: string;
  rootCause: string;
  impactSummary: string;
  evidenceIds: readonly string[];
  actionItems: readonly IncidentPostmortemAction[];
  generatedAt: string;
  snapshotHash: string;
}

const required = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 2000;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function fail(code: string, path: string): never {
  throw new IncidentFeedbackError(code, path);
}

export function validateGovernedIncident(incident: GovernedIncident): void {
  if (!incident || !required(incident.id) || !required(incident.tenantId) || !required(incident.summary) ||
      !["sev1", "sev2", "sev3", "sev4"].includes(incident.severity) ||
      !["open", "acknowledged", "investigating", "mitigated", "resolved", "closed"].includes(incident.status) ||
      !validTimestamp(incident.openedAt) || !validTimestamp(incident.updatedAt) ||
      !Number.isInteger(incident.revision) || incident.revision < 1 ||
      !Array.isArray(incident.lessons) || !Array.isArray(incident.evidenceIds)) {
    fail("INCIDENT_INVALID", "incident");
  }
  for (const key of ["acknowledgedAt", "mitigatedAt", "resolvedAt", "closedAt"] as const) {
    if (incident[key] !== undefined && !validTimestamp(incident[key])) fail("INCIDENT_TIMESTAMP_INVALID", key);
  }
  if (incident.resolutionSummary !== undefined && !required(incident.resolutionSummary)) {
    fail("INCIDENT_RESOLUTION_INVALID", "resolutionSummary");
  }
}

export async function submitTenantFeedback(
  input: {
    id: string;
    tenantId: string;
    subjectId: string;
    actorId: string;
    rating: number;
    category: string;
    comment?: string;
    submittedAt: string;
    idempotencyKey: string;
    now?: Date;
  },
  dependencies: {
    store: IncidentFeedbackStore;
    authorize(actorId: string, tenantId: string): Promise<boolean>;
  },
): Promise<Readonly<TenantFeedback>> {
  if (!input || !required(input.id) || !required(input.tenantId) || !required(input.subjectId) ||
      !required(input.actorId) || !required(input.category) || !required(input.idempotencyKey)) {
    fail("FEEDBACK_ENVELOPE_INVALID", "input");
  }
  if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) fail("FEEDBACK_RATING_INVALID", "rating");
  if (input.comment !== undefined && (typeof input.comment !== "string" || input.comment.length > 2000)) {
    fail("FEEDBACK_COMMENT_TOO_LARGE", "comment");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("FEEDBACK_CLOCK_INVALID", "now");
  if (!validTimestamp(input.submittedAt)) fail("FEEDBACK_TIMESTAMP_INVALID", "submittedAt");
  if (Date.parse(input.submittedAt) > now.getTime()) fail("FEEDBACK_TIMESTAMP_FUTURE", "submittedAt");
  if (!await dependencies.authorize(input.actorId, input.tenantId)) fail("FEEDBACK_UNAUTHORIZED", "actorId");

  const comment = input.comment?.replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, "[REDACTED]")
    .replace(/\bBearer\s+[A-Za-z0-9._~-]+/gi, "[REDACTED]")
    .replace(/\+?\d[\d\s().-]{7,}\d/g, "[REDACTED]");
  const item: TenantFeedback = Object.freeze({
    id: input.id, tenantId: input.tenantId, subjectId: input.subjectId, actorId: input.actorId,
    rating: input.rating, category: input.category, ...(comment !== undefined ? { comment } : {}),
    submittedAt: input.submittedAt,
  });
  const stored = await dependencies.store.appendFeedback(item, input.idempotencyKey);
  if (stored.tenantId !== input.tenantId) fail("FEEDBACK_TENANT_MISMATCH", "stored.tenantId");
  return Object.freeze({ ...stored });
}

export function aggregateTenantFeedback(
  tenantId: string,
  feedback: readonly TenantFeedback[],
  window: { start: string; end: string },
  now = new Date(),
): Readonly<{
  tenantId: string;
  windowStart: string;
  windowEnd: string;
  sampleSize: number;
  averageRating: number | null;
  negativeCount: number;
  categoryCounts: Readonly<Record<string, number>>;
}> {
  if (!required(tenantId) || !window || !validTimestamp(window.start) || !validTimestamp(window.end) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime()) || !Array.isArray(feedback)) {
    fail("FEEDBACK_AGGREGATION_INPUT_INVALID", "input");
  }
  if (Date.parse(window.start) > Date.parse(window.end) || Date.parse(window.end) > now.getTime()) {
    fail("FEEDBACK_WINDOW_INVALID", "window");
  }
  const seen = new Set<string>();
  const active: TenantFeedback[] = [];
  for (let index = 0; index < feedback.length; index += 1) {
    const item = feedback[index]!;
    const path = `feedback[${index}]`;
    if (!item || !required(item.id) || !required(item.subjectId) || !required(item.actorId) ||
        !required(item.category) || !Number.isInteger(item.rating) || item.rating < 1 || item.rating > 5 ||
        !validTimestamp(item.submittedAt)) fail("FEEDBACK_INVALID", path);
    if (item.tenantId !== tenantId) fail("FEEDBACK_TENANT_MISMATCH", `${path}.tenantId`);
    if (seen.has(item.id)) fail("FEEDBACK_DUPLICATE", `${path}.id`);
    seen.add(item.id);
    const at = Date.parse(item.submittedAt);
    if (at > now.getTime()) fail("FEEDBACK_TIMESTAMP_FUTURE", `${path}.submittedAt`);
    if (at >= Date.parse(window.start) && at <= Date.parse(window.end)) active.push(item);
  }
  const categoryCounts: Record<string, number> = {};
  for (const item of active) categoryCounts[item.category] = (categoryCounts[item.category] ?? 0) + 1;
  const sampleSize = active.length;
  return Object.freeze({
    tenantId, windowStart: window.start, windowEnd: window.end, sampleSize,
    averageRating: sampleSize ? active.reduce((sum, item) => sum + item.rating, 0) / sampleSize : null,
    negativeCount: active.filter(item => item.rating <= 2).length,
    categoryCounts: Object.freeze(Object.fromEntries(Object.entries(categoryCounts).sort(([a], [b]) => a.localeCompare(b)))),
  });
}

const transitions: Record<IncidentStatus, readonly IncidentStatus[]> = {
  open: ["acknowledged"],
  acknowledged: ["investigating", "mitigated"],
  investigating: ["mitigated", "resolved"],
  mitigated: ["investigating", "resolved"],
  resolved: ["closed"],
  closed: [],
};

export async function transitionTenantIncident(
  input: {
    tenantId: string;
    incidentId: string;
    actorId: string;
    to: IncidentStatus;
    expectedRevision: number;
    idempotencyKey: string;
    reason: string;
    now?: Date;
    resolutionSummary?: string;
    evidenceIds?: readonly string[];
  },
  dependencies: {
    store: IncidentFeedbackStore;
    authorize(actorId: string, tenantId: string): Promise<boolean>;
  },
): Promise<Readonly<GovernedIncident>> {
  if (!input || !required(input.tenantId) || !required(input.incidentId) || !required(input.actorId) ||
      !required(input.idempotencyKey) || !required(input.reason) ||
      !Number.isInteger(input.expectedRevision) || input.expectedRevision < 1 ||
      !["open", "acknowledged", "investigating", "mitigated", "resolved", "closed"].includes(input.to)) {
    fail("INCIDENT_TRANSITION_INPUT_INVALID", "input");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("INCIDENT_TIMESTAMP_INVALID", "now");
  if (!await dependencies.authorize(input.actorId, input.tenantId)) fail("INCIDENT_UNAUTHORIZED", "actorId");
  const replay = await dependencies.store.findTransition(input.tenantId, input.idempotencyKey);
  if (replay) {
    if (replay.id !== input.incidentId) fail("INCIDENT_IDEMPOTENCY_CONFLICT", "idempotencyKey");
    return Object.freeze({ ...replay });
  }
  const current = await dependencies.store.getIncident(input.tenantId, input.incidentId);
  if (!current) fail("INCIDENT_NOT_FOUND", "incidentId");
  validateGovernedIncident(current);
  if (current.tenantId !== input.tenantId) fail("INCIDENT_TENANT_MISMATCH", "incident.tenantId");
  if (current.revision !== input.expectedRevision) fail("INCIDENT_REVISION_CONFLICT", "expectedRevision");
  if (!transitions[current.status].includes(input.to)) fail("INCIDENT_TRANSITION_INVALID", "to");
  if (input.to === "resolved" && (!required(input.resolutionSummary) || !input.evidenceIds?.length)) {
    fail("INCIDENT_RESOLUTION_EVIDENCE_REQUIRED", "resolutionSummary/evidenceIds");
  }
  if (input.to === "closed" && current.status !== "resolved") fail("INCIDENT_NOT_RESOLVED", "status");
  const updated: GovernedIncident = Object.freeze({
    ...current,
    status: input.to,
    updatedAt: now.toISOString(),
    revision: current.revision + 1,
    ...(input.to === "acknowledged" ? { acknowledgedAt: now.toISOString(), assignedTo: input.actorId } : {}),
    ...(input.to === "mitigated" ? { mitigatedAt: now.toISOString() } : {}),
    ...(input.to === "resolved" ? {
      resolvedAt: now.toISOString(), resolutionSummary: input.resolutionSummary!,
      evidenceIds: Object.freeze([...new Set([...(current.evidenceIds ?? []), ...(input.evidenceIds ?? [])])]),
    } : {}),
    ...(input.to === "closed" ? { closedAt: now.toISOString() } : {}),
  });
  const event: IncidentTransitionEvent = Object.freeze({
    idempotencyKey: input.idempotencyKey, tenantId: input.tenantId, incidentId: input.incidentId,
    actorId: input.actorId, from: current.status, to: input.to, reason: input.reason,
    occurredAt: now.toISOString(), revision: updated.revision,
  });
  if (!await dependencies.store.commitIncident(updated, current.revision, event, input.idempotencyKey)) {
    fail("INCIDENT_REVISION_CONFLICT", "incident.revision");
  }
  return Object.freeze({ ...updated });
}

export async function createIncidentPostmortem(
  input: {
    incident: GovernedIncident;
    preparedBy: string;
    reviewerId: string;
    rootCause: string;
    impactSummary: string;
    evidenceIds: readonly string[];
    actionItems: readonly IncidentPostmortemAction[];
    now?: Date;
  },
  dependencies: {
    authorize(actorId: string, tenantId: string, action: "incident.postmortem.create" | "incident.postmortem.review"): Promise<boolean>;
    verifyEvidence(evidenceId: string): Promise<boolean>;
  },
): Promise<Readonly<IncidentPostmortem>> {
  if (!input || !required(input.preparedBy) || !required(input.reviewerId) ||
      !required(input.rootCause) || !required(input.impactSummary) ||
      !Array.isArray(input.evidenceIds) || !Array.isArray(input.actionItems)) {
    fail("POSTMORTEM_INPUT_INVALID", "input");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("POSTMORTEM_TIMESTAMP_INVALID", "now");
  validateGovernedIncident(input.incident);
  if (input.incident.status !== "resolved" && input.incident.status !== "closed") fail("POSTMORTEM_INCIDENT_NOT_RESOLVED", "incident.status");
  if (input.preparedBy === input.reviewerId) fail("POSTMORTEM_INDEPENDENT_REVIEW_REQUIRED", "reviewerId");
  if (!await dependencies.authorize(input.preparedBy, input.incident.tenantId, "incident.postmortem.create") ||
      !await dependencies.authorize(input.reviewerId, input.incident.tenantId, "incident.postmortem.review")) {
    fail("POSTMORTEM_UNAUTHORIZED", "actor");
  }
  if (!input.evidenceIds.length || new Set(input.evidenceIds).size !== input.evidenceIds.length) {
    fail("POSTMORTEM_EVIDENCE_REQUIRED", "evidenceIds");
  }
  for (const id of input.evidenceIds) {
    if (!required(id) || !await dependencies.verifyEvidence(id)) fail("POSTMORTEM_EVIDENCE_UNVERIFIED", `evidenceIds.${id}`);
  }
  const actionIds = new Set<string>();
  const actions = input.actionItems.map((item, index) => {
    const path = `actionItems[${index}]`;
    if (!item || !required(item.id) || !required(item.description) || !required(item.ownerId) ||
        !validTimestamp(item.dueAt) || Date.parse(item.dueAt) <= now.getTime() || actionIds.has(item.id)) {
      fail("POSTMORTEM_ACTION_INVALID", path);
    }
    actionIds.add(item.id);
    return Object.freeze({ ...item });
  });
  const payload = {
    tenantId: input.incident.tenantId, incidentId: input.incident.id, incidentRevision: input.incident.revision,
    preparedBy: input.preparedBy, reviewerId: input.reviewerId, rootCause: input.rootCause,
    impactSummary: input.impactSummary, evidenceIds: [...input.evidenceIds].sort(), actionItems: actions,
    generatedAt: now.toISOString(),
  };
  const snapshotHash = createHash("sha256").update(JSON.stringify(payload), "utf8").digest("hex");
  return Object.freeze({
    id: `postmortem:${encodeURIComponent(input.incident.tenantId)}:${encodeURIComponent(input.incident.id)}:${input.incident.revision}`,
    ...payload,
    evidenceIds: Object.freeze(payload.evidenceIds),
    actionItems: Object.freeze(actions),
    snapshotHash,
  });
}
