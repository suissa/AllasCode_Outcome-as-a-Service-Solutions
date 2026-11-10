import test from "node:test";
import assert from "node:assert/strict";
import {
  ObservabilityError,
  aggregateTenantHealth,
  createTelemetryEvent,
  evaluateTenantSlo,
  validateTraceContext,
} from "../../src/operations/observability.ts";

const policy = {
  id: "slo_api",
  tenantId: "tenant_a",
  name: "API availability",
  availabilityTarget: 0.99,
  errorRateTarget: 0.01,
  latencyP95TargetMs: 250,
  windowSeconds: 600,
  minimumSamples: 3,
};

const observations = [
  { id: "e1", tenantId: "tenant_a", occurredAt: "2026-11-10T11:59:00.000Z", latencyMs: 100, outcome: "success" as const },
  { id: "e2", tenantId: "tenant_a", occurredAt: "2026-11-10T11:58:00.000Z", latencyMs: 150, outcome: "success" as const },
  { id: "e3", tenantId: "tenant_a", occurredAt: "2026-11-10T11:57:00.000Z", latencyMs: 500, outcome: "error" as const },
];

test("tenant SLO evaluation is deterministic and reports target breaches", () => {
  const result = evaluateTenantSlo(policy, observations, new Date("2026-11-10T12:00:00.000Z"));
  assert.equal(result.sampleSize, 3);
  assert.equal(result.availability, 2 / 3);
  assert.equal(result.errorRate, 1 / 3);
  assert.equal(result.latencyP95Ms, 500);
  assert.equal(result.status, "breached");
  assert.deepEqual(result.breaches.map(item => item.metric), ["availability", "errorRate", "latencyP95Ms"]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.breaches));
});

test("SLO evaluation distinguishes insufficient data and excludes observations outside the window", () => {
  const result = evaluateTenantSlo(policy, [
    { ...observations[0]!, occurredAt: "2026-11-10T11:40:00.000Z" },
    observations[1]!,
    observations[2]!,
  ], new Date("2026-11-10T12:00:00.000Z"));
  assert.equal(result.sampleSize, 2);
  assert.equal(result.status, "insufficient_data");
  assert.deepEqual(result.breaches, []);
});

test("SLO rejects invalid policies, malformed events, duplicate IDs and cross-tenant data", () => {
  assert.throws(() => evaluateTenantSlo({ ...policy, availabilityTarget: 2 }, observations), (error: unknown) =>
    error instanceof ObservabilityError && error.code === "SLO_POLICY_INVALID" && error.path === "availabilityTarget");
  assert.throws(() => evaluateTenantSlo(policy, [{ ...observations[0]!, tenantId: "tenant_b" }]), /OBSERVATION_TENANT_MISMATCH/);
  assert.throws(() => evaluateTenantSlo(policy, [{ ...observations[0]!, occurredAt: "yesterday" }]), /OBSERVATION_TIMESTAMP_INVALID/);
  assert.throws(() => evaluateTenantSlo(policy, [observations[0]!, observations[0]!]), /OBSERVATION_ID_DUPLICATE/);
  assert.throws(() => evaluateTenantSlo(policy, [{ ...observations[0]!, latencyMs: -1 }]), /OBSERVATION_LATENCY_INVALID/);
  assert.throws(() => evaluateTenantSlo(policy, [{ ...observations[0]!, occurredAt: "2026-11-10T12:01:00.000Z" }], new Date("2026-11-10T12:00:00.000Z")), /OBSERVATION_FROM_FUTURE/);
});

test("health aggregation is tenant isolated and treats stale critical probes as unhealthy", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  assert.equal(aggregateTenantHealth("tenant_a", [
    { id: "db", tenantId: "tenant_a", name: "database", critical: true, status: "healthy", checkedAt: now.toISOString(), latencyMs: 2 },
    { id: "cache", tenantId: "tenant_a", name: "cache", critical: false, status: "degraded", checkedAt: now.toISOString(), latencyMs: 50 },
  ], now).status, "degraded");
  assert.equal(aggregateTenantHealth("tenant_a", [
    { id: "db", tenantId: "tenant_a", name: "database", critical: true, status: "healthy", checkedAt: "2026-11-10T11:00:00.000Z", latencyMs: 2 },
  ], now, 30_000).status, "unhealthy");
  assert.throws(() => aggregateTenantHealth("tenant_a", [
    { id: "db", tenantId: "tenant_b", name: "database", critical: true, status: "healthy", checkedAt: now.toISOString(), latencyMs: 2 },
  ], now), /HEALTH_TENANT_MISMATCH/);
});

test("trace context requires valid W3C identifiers and complete tenant actor correlation", () => {
  const valid = { traceId: "a".repeat(32), spanId: "b".repeat(16), tenantId: "tenant_a", actorId: "actor_1", requestId: "req_1" };
  assert.equal(validateTraceContext(valid).tenantId, "tenant_a");
  assert.throws(() => validateTraceContext({ ...valid, traceId: "0".repeat(32) }), /TRACE_ID_INVALID/);
  assert.throws(() => validateTraceContext({ ...valid, tenantId: " " }), /TRACE_CONTEXT_INVALID/);
});

test("telemetry event freezes safe attributes and redacts sensitive keys", () => {
  const context = validateTraceContext({
    traceId: "a".repeat(32), spanId: "b".repeat(16), tenantId: "tenant_a", actorId: "actor_1", requestId: "req_1",
  });
  const event = createTelemetryEvent(context, {
    name: "workflow.completed",
    occurredAt: "2026-11-10T12:00:00.000Z",
    attributes: { outcome: "success", durationMs: 42, accessToken: "secret", customerEmail: "private@example.com" },
  });
  assert.equal(event.attributes.outcome, "success");
  assert.equal(event.attributes.durationMs, 42);
  assert.equal(event.attributes.accessToken, "[REDACTED]");
  assert.equal(event.attributes.customerEmail, "[REDACTED]");
  assert.ok(Object.isFrozen(event));
  assert.throws(() => createTelemetryEvent(context, { name: " ", occurredAt: "invalid", attributes: {} }), /TELEMETRY_EVENT_INVALID/);
});

test("health aggregation rejects unknown statuses and empty probe sets fail closed", () => {
  const now = new Date("2026-11-10T12:00:00.000Z");
  assert.equal(aggregateTenantHealth("tenant_a", [], now).status, "unhealthy");
  assert.throws(() => aggregateTenantHealth("tenant_a", [
    { id: "db", tenantId: "tenant_a", name: "database", critical: true, status: "unknown" as never, checkedAt: now.toISOString(), latencyMs: 2 },
  ], now), /HEALTH_STATUS_INVALID/);
});
