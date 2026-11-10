import test from "node:test";
import assert from "node:assert/strict";
import {
  CorrelationError,
  correlateOutcomeSignals,
  type OutcomeSignal,
} from "../../src/operations/trace-correlation.ts";

const context = {
  tenantId: "tenant_a",
  actorId: "actor_1",
  requestId: "request_1",
  outcomeId: "outcome_1",
  executionId: "execution_1",
  traceId: "a".repeat(32),
  spanId: "b".repeat(16),
};

const signals: OutcomeSignal[] = [
  { kind: "metric", id: "m1", occurredAt: "2026-11-10T12:00:03.000Z", context, name: "workflow.duration_ms", value: 120, unit: "ms", attributes: { stage: "settlement" } },
  { kind: "log", id: "l1", occurredAt: "2026-11-10T12:00:02.000Z", context, level: "info", event: "workflow.task.completed", attributes: { task: "settlement", customerEmail: "private@example.com" } },
  { kind: "trace", id: "t1", occurredAt: "2026-11-10T12:00:01.000Z", context, name: "outcome.execute" },
];
const traceSignal = signals[2]! as Extract<OutcomeSignal, { kind: "trace" }>;
const metricSignal = signals[0]! as Extract<OutcomeSignal, { kind: "metric" }>;

test("correlates trace, log and metric signals by tenant, outcome, execution and W3C trace", () => {
  const result = correlateOutcomeSignals({
    tenantId: "tenant_a",
    outcomeId: "outcome_1",
    executionId: "execution_1",
    signals,
    now: new Date("2026-11-10T12:01:00.000Z"),
  });
  assert.deepEqual(result.signals.map(signal => signal.id), ["t1", "l1", "m1"]);
  assert.deepEqual(result.counts, { trace: 1, log: 1, metric: 1 });
  assert.equal(result.traceId, context.traceId);
  assert.equal(result.tenantId, "tenant_a");
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.signals));
  assert.ok(Object.isFrozen(result.signals[1]!.attributes));
  assert.equal(result.signals[1]!.attributes.customerEmail, "[REDACTED]");
});

test("rejects cross-tenant and mismatched outcome or execution signals with stable paths", () => {
  const base = { tenantId: "tenant_a", outcomeId: "outcome_1", executionId: "execution_1", now: new Date("2026-11-10T12:01:00.000Z") };
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [{ ...signals[0]!, context: { ...context, tenantId: "tenant_b" } }] }),
    (error: unknown) => error instanceof CorrelationError && error.code === "CORRELATION_TENANT_MISMATCH" && error.path === "signals[0].context.tenantId");
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [{ ...signals[0]!, context: { ...context, outcomeId: "other" } }] }),
    /CORRELATION_OUTCOME_MISMATCH/);
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [{ ...signals[0]!, context: { ...context, executionId: "other" } }] }),
    /CORRELATION_EXECUTION_MISMATCH/);
});

test("rejects duplicate IDs, duplicate span definitions, invalid parent spans and mixed traces", () => {
  const base = { tenantId: "tenant_a", outcomeId: "outcome_1", executionId: "execution_1", now: new Date("2026-11-10T12:01:00.000Z") };
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [signals[0]!, signals[0]!] }), /CORRELATION_SIGNAL_DUPLICATE/);
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [traceSignal, { ...traceSignal, id: "t2" }] }), /CORRELATION_SPAN_DUPLICATE/);
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [{ ...traceSignal, parentSpanId: "bad" }] }), /CORRELATION_SPAN_INVALID/);
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [traceSignal, { ...metricSignal, context: { ...context, traceId: "c".repeat(32) } }] }), /CORRELATION_TRACE_MISMATCH/);
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [{ ...traceSignal, context: { ...context, traceId: "0".repeat(32) } }] }), /TRACE_ID_INVALID/);
});

test("rejects malformed, future and out-of-scope signals and invalid metric values", () => {
  const base = { tenantId: "tenant_a", outcomeId: "outcome_1", executionId: "execution_1", now: new Date("2026-11-10T12:01:00.000Z") };
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [{ ...signals[0]!, occurredAt: "yesterday" }] }), /CORRELATION_TIMESTAMP_INVALID/);
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [{ ...signals[0]!, occurredAt: "2026-11-10T12:02:00.000Z" }] }), /CORRELATION_TIMESTAMP_FUTURE/);
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [{ ...metricSignal, value: Number.NaN }] }), /CORRELATION_METRIC_VALUE_INVALID/);
  assert.throws(() => correlateOutcomeSignals({ ...base, signals: [{ ...metricSignal, name: " " }] }), /CORRELATION_SIGNAL_INVALID/);
});

test("requires at least one signal and refuses empty or invalid correlation scope", () => {
  assert.throws(() => correlateOutcomeSignals({ tenantId: "tenant_a", outcomeId: "outcome_1", executionId: "execution_1", signals: [] }), /CORRELATION_SIGNALS_REQUIRED/);
  assert.throws(() => correlateOutcomeSignals({ tenantId: " ", outcomeId: "outcome_1", executionId: "execution_1", signals }), /CORRELATION_SCOPE_INVALID/);
});

test("bounds and sanitizes structured attributes without changing source records", () => {
  const input = { ...signals[1]!, attributes: { status: "ok", authorization: "Bearer secret" } };
  const result = correlateOutcomeSignals({
    tenantId: "tenant_a", outcomeId: "outcome_1", executionId: "execution_1",
    signals: [input], now: new Date("2026-11-10T12:01:00.000Z"),
  });
  assert.equal(result.signals[0]!.attributes.authorization, "[REDACTED]");
  assert.equal(input.attributes.authorization, "Bearer secret");
  assert.throws(() => correlateOutcomeSignals({
    tenantId: "tenant_a", outcomeId: "outcome_1", executionId: "execution_1",
    signals: [{ ...input, attributes: Object.fromEntries(Array.from({ length: 33 }, (_, i) => ["k" + i, i])) }],
    now: new Date("2026-11-10T12:01:00.000Z"),
  }), /TELEMETRY_ATTRIBUTES_LIMIT/);
});
