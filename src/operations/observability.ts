export class ObservabilityError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "ObservabilityError";
  }
}

export interface TenantSloPolicy {
  id: string;
  tenantId: string;
  name: string;
  availabilityTarget: number;
  errorRateTarget: number;
  latencyP95TargetMs: number;
  windowSeconds: number;
  minimumSamples: number;
}

export interface SloObservation {
  id: string;
  tenantId: string;
  occurredAt: string;
  latencyMs: number;
  outcome: "success" | "error";
}

export interface TenantSloResult {
  policyId: string;
  tenantId: string;
  status: "healthy" | "breached" | "insufficient_data";
  sampleSize: number;
  availability: number | null;
  errorRate: number | null;
  latencyP95Ms: number | null;
  windowStart: string;
  windowEnd: string;
  breaches: readonly { metric: "availability" | "errorRate" | "latencyP95Ms"; observed: number; target: number }[];
}

function requiredText(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= 256;
}

function validTimestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
}

function validatePolicy(policy: TenantSloPolicy): void {
  if (!policy || !requiredText(policy.id) || !requiredText(policy.tenantId) || !requiredText(policy.name)) {
    throw new ObservabilityError("SLO_POLICY_INVALID", "policy");
  }
  for (const [path, value] of [
    ["availabilityTarget", policy.availabilityTarget],
    ["errorRateTarget", policy.errorRateTarget],
  ] as const) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new ObservabilityError("SLO_POLICY_INVALID", path);
    }
  }
  if (!Number.isFinite(policy.latencyP95TargetMs) || policy.latencyP95TargetMs <= 0) {
    throw new ObservabilityError("SLO_POLICY_INVALID", "latencyP95TargetMs");
  }
  if (!Number.isInteger(policy.windowSeconds) || policy.windowSeconds < 1 || policy.windowSeconds > 31 * 24 * 60 * 60) {
    throw new ObservabilityError("SLO_POLICY_INVALID", "windowSeconds");
  }
  if (!Number.isInteger(policy.minimumSamples) || policy.minimumSamples < 1 || policy.minimumSamples > 1_000_000) {
    throw new ObservabilityError("SLO_POLICY_INVALID", "minimumSamples");
  }
}

export function evaluateTenantSlo(
  policy: TenantSloPolicy,
  observations: readonly SloObservation[],
  now = new Date(),
): TenantSloResult {
  validatePolicy(policy);
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    throw new ObservabilityError("SLO_CLOCK_INVALID", "now");
  }

  const seen = new Set<string>();
  const startMs = now.getTime() - policy.windowSeconds * 1000;
  const current = now.getTime();
  const inWindow: SloObservation[] = [];

  for (let index = 0; index < observations.length; index += 1) {
    const item = observations[index];
    const path = `observations[${index}]`;
    if (!item || !requiredText(item.id) || !requiredText(item.tenantId)) {
      throw new ObservabilityError("OBSERVATION_INVALID", path);
    }
    if (item.tenantId !== policy.tenantId) {
      throw new ObservabilityError("OBSERVATION_TENANT_MISMATCH", `${path}.tenantId`);
    }
    if (seen.has(item.id)) {
      throw new ObservabilityError("OBSERVATION_ID_DUPLICATE", `${path}.id`);
    }
    seen.add(item.id);
    if (!validTimestamp(item.occurredAt)) {
      throw new ObservabilityError("OBSERVATION_TIMESTAMP_INVALID", `${path}.occurredAt`);
    }
    const timestamp = Date.parse(item.occurredAt);
    if (timestamp > current) {
      throw new ObservabilityError("OBSERVATION_FROM_FUTURE", `${path}.occurredAt`);
    }
    if (!Number.isFinite(item.latencyMs) || item.latencyMs < 0 || item.latencyMs > 86_400_000) {
      throw new ObservabilityError("OBSERVATION_LATENCY_INVALID", `${path}.latencyMs`);
    }
    if (item.outcome !== "success" && item.outcome !== "error") {
      throw new ObservabilityError("OBSERVATION_OUTCOME_INVALID", `${path}.outcome`);
    }
    if (timestamp >= startMs && timestamp <= current) inWindow.push(item);
  }

  if (inWindow.length < policy.minimumSamples) {
    return Object.freeze({
      policyId: policy.id,
      tenantId: policy.tenantId,
      status: "insufficient_data",
      sampleSize: inWindow.length,
      availability: null,
      errorRate: null,
      latencyP95Ms: null,
      windowStart: new Date(startMs).toISOString(),
      windowEnd: now.toISOString(),
      breaches: Object.freeze([]),
    });
  }

  const failures = inWindow.filter(item => item.outcome === "error").length;
  const availability = (inWindow.length - failures) / inWindow.length;
  const errorRate = failures / inWindow.length;
  const latencies = inWindow.map(item => item.latencyMs).sort((a, b) => a - b);
  const latencyP95Ms = latencies[Math.ceil(latencies.length * 0.95) - 1]!;
  const breaches: TenantSloResult["breaches"][number][] = [];
  if (availability < policy.availabilityTarget) breaches.push({ metric: "availability", observed: availability, target: policy.availabilityTarget });
  if (errorRate > policy.errorRateTarget) breaches.push({ metric: "errorRate", observed: errorRate, target: policy.errorRateTarget });
  if (latencyP95Ms > policy.latencyP95TargetMs) breaches.push({ metric: "latencyP95Ms", observed: latencyP95Ms, target: policy.latencyP95TargetMs });

  return Object.freeze({
    policyId: policy.id,
    tenantId: policy.tenantId,
    status: breaches.length ? "breached" : "healthy",
    sampleSize: inWindow.length,
    availability,
    errorRate,
    latencyP95Ms,
    windowStart: new Date(startMs).toISOString(),
    windowEnd: now.toISOString(),
    breaches: Object.freeze(breaches.map(breach => Object.freeze(breach))),
  });
}

export interface TenantHealthProbe {
  id: string;
  tenantId: string;
  name: string;
  critical: boolean;
  status: "healthy" | "degraded" | "unhealthy";
  checkedAt: string;
  latencyMs: number;
}

export interface TenantHealthResult {
  tenantId: string;
  status: "healthy" | "degraded" | "unhealthy";
  checkedCount: number;
  staleProbeIds: readonly string[];
  unhealthyProbeIds: readonly string[];
  degradedProbeIds: readonly string[];
}

export function aggregateTenantHealth(
  tenantId: string,
  probes: readonly TenantHealthProbe[],
  now = new Date(),
  staleAfterMs = 60_000,
): TenantHealthResult {
  if (!requiredText(tenantId)) throw new ObservabilityError("HEALTH_TENANT_INVALID", "tenantId");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime()) || !Number.isFinite(staleAfterMs) || staleAfterMs < 1) {
    throw new ObservabilityError("HEALTH_CONFIG_INVALID", "config");
  }
  const seen = new Set<string>();
  const stale: string[] = [];
  const unhealthy: string[] = [];
  const degraded: string[] = [];
  for (let index = 0; index < probes.length; index += 1) {
    const probe = probes[index]!;
    const path = `probes[${index}]`;
    if (!requiredText(probe.id) || !requiredText(probe.name) || !requiredText(probe.tenantId)) {
      throw new ObservabilityError("HEALTH_PROBE_INVALID", path);
    }
    if (probe.tenantId !== tenantId) throw new ObservabilityError("HEALTH_TENANT_MISMATCH", `${path}.tenantId`);
    if (seen.has(probe.id)) throw new ObservabilityError("HEALTH_PROBE_DUPLICATE", `${path}.id`);
    seen.add(probe.id);
    if (!validTimestamp(probe.checkedAt) || Date.parse(probe.checkedAt) > now.getTime()) {
      throw new ObservabilityError("HEALTH_TIMESTAMP_INVALID", `${path}.checkedAt`);
    }
    if (!Number.isFinite(probe.latencyMs) || probe.latencyMs < 0 || typeof probe.critical !== "boolean") {
      throw new ObservabilityError("HEALTH_PROBE_INVALID", path);
    }
    const isStale = now.getTime() - Date.parse(probe.checkedAt) > staleAfterMs;
    if (isStale) stale.push(probe.id);
    if (probe.status === "unhealthy" || (isStale && probe.critical)) unhealthy.push(probe.id);
    else if (probe.status === "degraded" || isStale) degraded.push(probe.id);
    else if (probe.status !== "healthy") throw new ObservabilityError("HEALTH_STATUS_INVALID", `${path}.status`);
  }
  const status = !probes.length || unhealthy.length ? "unhealthy" : degraded.length ? "degraded" : "healthy";
  return Object.freeze({
    tenantId,
    status,
    checkedCount: probes.length,
    staleProbeIds: Object.freeze(stale),
    unhealthyProbeIds: Object.freeze(unhealthy),
    degradedProbeIds: Object.freeze(degraded),
  });
}

export interface TraceContext {
  traceId: string;
  spanId: string;
  tenantId: string;
  actorId: string;
  requestId: string;
  outcomeId?: string;
  executionId?: string;
  behaviorId?: string;
}

export function validateTraceContext(context: TraceContext): Readonly<TraceContext> {
  if (!context || !/^(?!0{32})[a-f0-9]{32}$/i.test(context.traceId) ||
      !/^(?!0{16})[a-f0-9]{16}$/i.test(context.spanId)) {
    throw new ObservabilityError("TRACE_ID_INVALID", "traceId/spanId");
  }
  for (const key of ["tenantId", "actorId", "requestId"] as const) {
    if (!requiredText(context[key])) throw new ObservabilityError("TRACE_CONTEXT_INVALID", key);
  }
  for (const key of ["outcomeId", "executionId", "behaviorId"] as const) {
    if (context[key] !== undefined && !requiredText(context[key])) {
      throw new ObservabilityError("TRACE_CONTEXT_INVALID", key);
    }
  }
  return Object.freeze({ ...context });
}

export interface TelemetryEventInput {
  name: string;
  occurredAt: string;
  attributes: Readonly<Record<string, string | number | boolean | null>>;
}

export interface CorrelatedTelemetryEvent extends TraceContext {
  name: string;
  occurredAt: string;
  attributes: Readonly<Record<string, string | number | boolean | null>>;
}

const SENSITIVE_ATTRIBUTE = /(token|secret|password|authorization|cookie|email|phone|address|document|cpf|cnpj|prompt|payload|credential)/i;

export function createTelemetryEvent(
  context: TraceContext,
  input: TelemetryEventInput,
): Readonly<CorrelatedTelemetryEvent> {
  const safeContext = validateTraceContext(context);
  if (!input || !requiredText(input.name) || !validTimestamp(input.occurredAt) ||
      !input.attributes || typeof input.attributes !== "object" || Array.isArray(input.attributes)) {
    throw new ObservabilityError("TELEMETRY_EVENT_INVALID", "event");
  }
  const entries = Object.entries(input.attributes);
  if (entries.length > 32) throw new ObservabilityError("TELEMETRY_ATTRIBUTES_LIMIT", "attributes");
  const attributes: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of entries) {
    if (!/^[a-zA-Z][a-zA-Z0-9_.-]{0,63}$/.test(key)) {
      throw new ObservabilityError("TELEMETRY_ATTRIBUTE_INVALID", `attributes.${key}`);
    }
    if (SENSITIVE_ATTRIBUTE.test(key)) {
      attributes[key] = "[REDACTED]";
      continue;
    }
    if (typeof value === "string") {
      if (value.length > 256) throw new ObservabilityError("TELEMETRY_ATTRIBUTE_TOO_LARGE", `attributes.${key}`);
      attributes[key] = value;
    } else if (typeof value === "number" && Number.isFinite(value) || typeof value === "boolean" || value === null) {
      attributes[key] = value;
    } else {
      throw new ObservabilityError("TELEMETRY_ATTRIBUTE_INVALID", `attributes.${key}`);
    }
  }
  return Object.freeze({ ...safeContext, name: input.name, occurredAt: input.occurredAt, attributes: Object.freeze(attributes) });
}
