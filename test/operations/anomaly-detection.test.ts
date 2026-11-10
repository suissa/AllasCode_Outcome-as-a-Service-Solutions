import test from "node:test";
import assert from "node:assert/strict";
import {
  AnomalyDetectionError,
  detectOperationalAnomalies,
  type AnomalyDetectionInput,
  type ExecutionOutcomeSample,
  type OperationalMetricSample,
} from "../../src/operations/anomaly-detection.ts";

const now = new Date("2026-11-10T12:00:00.000Z");
const baseline: OperationalMetricSample[] = [10, 10, 11, 9, 10, 10, 11, 9].map((value, index) => ({
  id: `b${index}`, tenantId: "tenant_a", metric: "checkout.latency_ms", value, unit: "ms",
  occurredAt: `2026-11-10T11:5${index}:00.000Z`, outcomeId: `o-b${index}`, executionId: `e-b${index}`,
}));
const current: OperationalMetricSample[] = [
  { id: "c1", tenantId: "tenant_a", metric: "checkout.latency_ms", value: 100, unit: "ms", occurredAt: "2026-11-10T11:59:00.000Z", outcomeId: "o1", executionId: "e1" },
];
const executions: ExecutionOutcomeSample[] = [
  { id: "x1", tenantId: "tenant_a", outcomeId: "o1", executionId: "e1", occurredAt: "2026-11-10T11:59:00.000Z", status: "success" },
  { id: "x2", tenantId: "tenant_a", outcomeId: "o2", executionId: "e2", occurredAt: "2026-11-10T11:58:00.000Z", status: "failure", failureCode: "PAYMENT_TIMEOUT" },
  { id: "x3", tenantId: "tenant_a", outcomeId: "o3", executionId: "e3", occurredAt: "2026-11-10T11:57:00.000Z", status: "failure", failureCode: "PAYMENT_TIMEOUT" },
  { id: "x4", tenantId: "tenant_a", outcomeId: "o4", executionId: "e4", occurredAt: "2026-11-10T11:56:00.000Z", status: "success" },
];

function input(overrides: Partial<AnomalyDetectionInput> = {}): AnomalyDetectionInput {
  return {
    tenantId: "tenant_a",
    now,
    baselineWindowSeconds: 600,
    currentWindowSeconds: 120,
    baselineMinimumSamples: 5,
    madMultiplier: 3,
    minimumDeviation: 2,
    failureRateThreshold: 0.25,
    minimumExecutionSamples: 4,
    baselineSamples: baseline,
    currentSamples: current,
    executions,
    sloResults: [],
    ...overrides,
  };
}

test("detects robust metric anomalies against a historical median/MAD baseline deterministically", () => {
  const result = detectOperationalAnomalies(input());
  const anomaly = result.anomalies.find(item => item.kind === "metric");
  assert.ok(anomaly);
  assert.equal(anomaly.metric, "checkout.latency_ms");
  assert.equal(anomaly.observed, 100);
  assert.equal(anomaly.baseline, 10);
  assert.equal(anomaly.severity, "high");
  assert.deepEqual(result, detectOperationalAnomalies(input()));
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.anomalies));
});

test("detects execution failure-rate spikes and preserves stable failure codes", () => {
  const result = detectOperationalAnomalies(input());
  const anomaly = result.anomalies.find(item => item.kind === "failure_rate");
  assert.ok(anomaly);
  assert.equal(anomaly.observed, 0.5);
  assert.equal(anomaly.sampleSize, 4);
  assert.equal(anomaly.failureCodes[0], "PAYMENT_TIMEOUT");
});

test("turns every breached SLO dimension into a critical operational anomaly", () => {
  const result = detectOperationalAnomalies(input({
    currentSamples: [],
    sloResults: [{
      policyId: "slo_api", tenantId: "tenant_a", status: "breached", sampleSize: 100,
      availability: 0.9, errorRate: 0.1, latencyP95Ms: 500,
      windowStart: "2026-11-10T11:00:00.000Z", windowEnd: "2026-11-10T12:00:00.000Z",
      breaches: [
        { metric: "availability", observed: 0.9, target: 0.99 },
        { metric: "errorRate", observed: 0.1, target: 0.01 },
      ],
    }],
  }));
  assert.deepEqual(result.anomalies.filter(item => item.kind === "slo_breach").map(item => item.metric), ["availability", "errorRate"]);
  assert.ok(result.anomalies.filter(item => item.kind === "slo_breach").every(item => item.severity === "critical"));
});

test("ignores normal metrics, healthy SLOs and failure rates below threshold", () => {
  const result = detectOperationalAnomalies(input({
    currentSamples: [{ ...current[0]!, value: 10 }],
    executions: executions.map(item => ({ ...item, status: "success" as const, failureCode: undefined })),
    sloResults: [{
      policyId: "slo_api", tenantId: "tenant_a", status: "healthy", sampleSize: 100,
      availability: 1, errorRate: 0, latencyP95Ms: 50,
      windowStart: "2026-11-10T11:00:00.000Z", windowEnd: "2026-11-10T12:00:00.000Z", breaches: [],
    }],
  }));
  assert.deepEqual(result.anomalies, []);
});

test("rejects cross-tenant data, duplicate identifiers and malformed or future timestamps", () => {
  assert.throws(() => detectOperationalAnomalies(input({ currentSamples: [{ ...current[0]!, tenantId: "tenant_b" }] })),
    (error: unknown) => error instanceof AnomalyDetectionError && error.code === "ANOMALY_TENANT_MISMATCH" && error.path === "currentSamples[0].tenantId");
  assert.throws(() => detectOperationalAnomalies(input({ currentSamples: [current[0]!, current[0]!] })), /ANOMALY_SAMPLE_DUPLICATE/);
  assert.throws(() => detectOperationalAnomalies(input({ currentSamples: [{ ...current[0]!, occurredAt: "yesterday" }] })), /ANOMALY_TIMESTAMP_INVALID/);
  assert.throws(() => detectOperationalAnomalies(input({ currentSamples: [{ ...current[0]!, occurredAt: "2026-11-10T12:01:00.000Z" }] })), /ANOMALY_TIMESTAMP_FUTURE/);
});

test("rejects invalid policies, impossible metrics and unauthorized SLO scope", () => {
  assert.throws(() => detectOperationalAnomalies(input({ madMultiplier: -1 })), /ANOMALY_CONFIG_INVALID/);
  assert.throws(() => detectOperationalAnomalies(input({ currentSamples: [{ ...current[0]!, value: Number.NaN }] })), /ANOMALY_METRIC_INVALID/);
  assert.throws(() => detectOperationalAnomalies(input({ sloResults: [{
    policyId: "slo_other", tenantId: "tenant_b", status: "breached", sampleSize: 2,
    availability: 0, errorRate: 1, latencyP95Ms: 900,
    windowStart: "2026-11-10T11:00:00.000Z", windowEnd: "2026-11-10T12:00:00.000Z",
    breaches: [{ metric: "availability", observed: 0, target: 0.99 }],
  }] })), /ANOMALY_TENANT_MISMATCH/);
});

test("does not flag insufficient baselines or execution windows below minimum sample counts", () => {
  const result = detectOperationalAnomalies(input({
    baselineSamples: baseline.slice(0, 2),
    executions: executions.slice(0, 2),
    minimumExecutionSamples: 3,
    baselineMinimumSamples: 5,
  }));
  assert.equal(result.anomalies.some(item => item.kind === "metric"), false);
  assert.equal(result.anomalies.some(item => item.kind === "failure_rate"), false);
  assert.equal(result.insufficientData.baselineMetrics.includes("checkout.latency_ms"), true);
  assert.equal(result.insufficientData.executionSamples, 2);
});

test("deduplicates identical findings and freezes the result without mutating source input", () => {
  const duplicate = { ...current[0]!, id: "c2" };
  const source = [current[0]!, duplicate];
  const result = detectOperationalAnomalies(input({ currentSamples: source }));
  assert.equal(new Set(result.anomalies.map(item => item.id)).size, result.anomalies.length);
  assert.equal(source.length, 2);
  assert.ok(Object.isFrozen(result.anomalies[0]));
});
