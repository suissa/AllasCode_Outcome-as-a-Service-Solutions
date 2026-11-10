import type { TenantSloResult } from "./observability.ts";

export class AnomalyDetectionError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "AnomalyDetectionError";
  }
}

export interface OperationalMetricSample {
  id: string;
  tenantId: string;
  metric: string;
  value: number;
  unit: string;
  occurredAt: string;
  outcomeId: string;
  executionId: string;
}

export interface ExecutionOutcomeSample {
  id: string;
  tenantId: string;
  outcomeId: string;
  executionId: string;
  occurredAt: string;
  status: "success" | "failure";
  failureCode?: string;
}

export type OperationalAnomaly =
  | {
      id: string;
      kind: "metric";
      severity: "medium" | "high";
      tenantId: string;
      metric: string;
      unit: string;
      observed: number;
      baseline: number;
      deviation: number;
      threshold: number;
      sampleId: string;
      occurredAt: string;
      outcomeId: string;
      executionId: string;
    }
  | {
      id: string;
      kind: "failure_rate";
      severity: "high" | "critical";
      tenantId: string;
      metric: "execution.failure_rate";
      observed: number;
      threshold: number;
      sampleSize: number;
      failureCount: number;
      failureCodes: readonly string[];
      windowStart: string;
      windowEnd: string;
    }
  | {
      id: string;
      kind: "slo_breach";
      severity: "critical";
      tenantId: string;
      policyId: string;
      metric: "availability" | "errorRate" | "latencyP95Ms";
      observed: number;
      target: number;
      sampleSize: number;
      windowStart: string;
      windowEnd: string;
    };

export interface AnomalyDetectionInput {
  tenantId: string;
  now?: Date;
  baselineWindowSeconds: number;
  currentWindowSeconds: number;
  baselineMinimumSamples: number;
  madMultiplier: number;
  minimumDeviation: number;
  failureRateThreshold: number;
  minimumExecutionSamples: number;
  baselineSamples: readonly OperationalMetricSample[];
  currentSamples: readonly OperationalMetricSample[];
  executions: readonly ExecutionOutcomeSample[];
  sloResults: readonly TenantSloResult[];
}

export interface AnomalyDetectionResult {
  tenantId: string;
  generatedAt: string;
  anomalies: readonly OperationalAnomaly[];
  insufficientData: Readonly<{
    baselineMetrics: readonly string[];
    executionSamples: number;
  }>;
  evaluated: Readonly<{
    baselineSamples: number;
    currentSamples: number;
    executionSamples: number;
    sloPolicies: number;
  }>;
}

const requiredText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 256;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function fail(code: string, path: string): never {
  throw new AnomalyDetectionError(code, path);
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function validateConfig(input: AnomalyDetectionInput): void {
  if (!input || !requiredText(input.tenantId)) fail("ANOMALY_CONFIG_INVALID", "tenantId");
  const positiveIntegers: Array<[string, number, number]> = [
    ["baselineWindowSeconds", input.baselineWindowSeconds, 31 * 24 * 60 * 60],
    ["currentWindowSeconds", input.currentWindowSeconds, 7 * 24 * 60 * 60],
    ["baselineMinimumSamples", input.baselineMinimumSamples, 1_000_000],
    ["minimumExecutionSamples", input.minimumExecutionSamples, 1_000_000],
  ];
  for (const [path, value, max] of positiveIntegers) {
    if (!Number.isInteger(value) || value < 1 || value > max) fail("ANOMALY_CONFIG_INVALID", path);
  }
  if (input.baselineWindowSeconds <= input.currentWindowSeconds) fail("ANOMALY_CONFIG_INVALID", "baselineWindowSeconds");
  if (!Number.isFinite(input.madMultiplier) || input.madMultiplier <= 0 || input.madMultiplier > 100 ||
      !Number.isFinite(input.minimumDeviation) || input.minimumDeviation <= 0 ||
      !Number.isFinite(input.failureRateThreshold) || input.failureRateThreshold <= 0 || input.failureRateThreshold > 1) {
    fail("ANOMALY_CONFIG_INVALID", "thresholds");
  }
  if (!Array.isArray(input.baselineSamples) || !Array.isArray(input.currentSamples) ||
      !Array.isArray(input.executions) || !Array.isArray(input.sloResults)) {
    fail("ANOMALY_INPUT_INVALID", "collections");
  }
}

function validateMetricSamples(
  samples: readonly OperationalMetricSample[],
  tenantId: string,
  nowMs: number,
  path: string,
  ids: Set<string>,
): void {
  for (let index = 0; index < samples.length; index += 1) {
    const item = samples[index];
    const itemPath = `${path}[${index}]`;
    if (!item || !requiredText(item.id) || !requiredText(item.metric) || !requiredText(item.unit) ||
        !requiredText(item.outcomeId) || !requiredText(item.executionId)) {
      fail("ANOMALY_METRIC_INVALID", itemPath);
    }
    if (item.tenantId !== tenantId) fail("ANOMALY_TENANT_MISMATCH", `${itemPath}.tenantId`);
    if (ids.has(item.id)) fail("ANOMALY_SAMPLE_DUPLICATE", `${itemPath}.id`);
    ids.add(item.id);
    if (!validTimestamp(item.occurredAt)) fail("ANOMALY_TIMESTAMP_INVALID", `${itemPath}.occurredAt`);
    if (Date.parse(item.occurredAt) > nowMs) fail("ANOMALY_TIMESTAMP_FUTURE", `${itemPath}.occurredAt`);
    if (!Number.isFinite(item.value)) fail("ANOMALY_METRIC_INVALID", `${itemPath}.value`);
  }
}

export function detectOperationalAnomalies(input: AnomalyDetectionInput): Readonly<AnomalyDetectionResult> {
  validateConfig(input);
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("ANOMALY_CLOCK_INVALID", "now");
  const nowMs = now.getTime();
  const baselineStart = nowMs - input.baselineWindowSeconds * 1000;
  const currentStart = nowMs - input.currentWindowSeconds * 1000;
  const ids = new Set<string>();

  validateMetricSamples(input.baselineSamples, input.tenantId, nowMs, "baselineSamples", ids);
  validateMetricSamples(input.currentSamples, input.tenantId, nowMs, "currentSamples", ids);

  const baselineByMetric = new Map<string, number[]>();
  for (const sample of input.baselineSamples) {
    const timestamp = Date.parse(sample.occurredAt);
    if (timestamp < baselineStart || timestamp >= currentStart) continue;
    const values = baselineByMetric.get(sample.metric) ?? [];
    values.push(sample.value);
    baselineByMetric.set(sample.metric, values);
  }

  const anomalies: OperationalAnomaly[] = [];
  const insufficientMetrics: string[] = [];
  const activeCurrent = input.currentSamples.filter(sample => {
    const timestamp = Date.parse(sample.occurredAt);
    return timestamp >= currentStart && timestamp <= nowMs;
  });

  for (const metric of [...new Set(activeCurrent.map(sample => sample.metric))].sort()) {
    const history = baselineByMetric.get(metric) ?? [];
    if (history.length < input.baselineMinimumSamples) {
      insufficientMetrics.push(metric);
      continue;
    }
    const center = median(history);
    const mad = median(history.map(value => Math.abs(value - center)));
    const threshold = Math.max(input.minimumDeviation, mad * 1.4826 * input.madMultiplier);
    for (const sample of activeCurrent.filter(item => item.metric === metric)) {
      const deviation = Math.abs(sample.value - center);
      if (deviation <= threshold) continue;
      const severity = deviation > threshold * 2 ? "high" : "medium";
      const id = `metric:${encodeURIComponent(input.tenantId)}:${encodeURIComponent(metric)}:${encodeURIComponent(sample.id)}`;
      anomalies.push(Object.freeze({
        id, kind: "metric", severity, tenantId: input.tenantId, metric, unit: sample.unit,
        observed: sample.value, baseline: center, deviation, threshold, sampleId: sample.id,
        occurredAt: sample.occurredAt, outcomeId: sample.outcomeId, executionId: sample.executionId,
      }));
    }
  }

  const executionIds = new Set<string>();
  const activeExecutions: ExecutionOutcomeSample[] = [];
  for (let index = 0; index < input.executions.length; index += 1) {
    const item = input.executions[index]!;
    const path = `executions[${index}]`;
    if (!item || !requiredText(item.id) || !requiredText(item.outcomeId) || !requiredText(item.executionId)) {
      fail("ANOMALY_EXECUTION_INVALID", path);
    }
    if (item.tenantId !== input.tenantId) fail("ANOMALY_TENANT_MISMATCH", `${path}.tenantId`);
    if (executionIds.has(item.id)) fail("ANOMALY_EXECUTION_DUPLICATE", `${path}.id`);
    executionIds.add(item.id);
    if (!validTimestamp(item.occurredAt)) fail("ANOMALY_TIMESTAMP_INVALID", `${path}.occurredAt`);
    const timestamp = Date.parse(item.occurredAt);
    if (timestamp > nowMs) fail("ANOMALY_TIMESTAMP_FUTURE", `${path}.occurredAt`);
    if (item.status !== "success" && item.status !== "failure") fail("ANOMALY_EXECUTION_INVALID", `${path}.status`);
    if (item.status === "failure" && item.failureCode !== undefined && !requiredText(item.failureCode)) {
      fail("ANOMALY_EXECUTION_INVALID", `${path}.failureCode`);
    }
    if (timestamp >= currentStart && timestamp <= nowMs) activeExecutions.push(item);
  }

  if (activeExecutions.length < input.minimumExecutionSamples) {
    // Insufficient data is explicit; absence of evidence is never treated as a healthy signal.
  } else {
    const failures = activeExecutions.filter(item => item.status === "failure");
    const rate = failures.length / activeExecutions.length;
    if (rate >= input.failureRateThreshold) {
      const failureCodes = [...new Set(failures.map(item => item.failureCode).filter((code): code is string => !!code))].sort();
      anomalies.push(Object.freeze({
        id: `failure-rate:${encodeURIComponent(input.tenantId)}:${currentStart}:${nowMs}`,
        kind: "failure_rate",
        severity: rate >= Math.min(1, input.failureRateThreshold * 2) ? "critical" : "high",
        tenantId: input.tenantId,
        metric: "execution.failure_rate",
        observed: rate,
        threshold: input.failureRateThreshold,
        sampleSize: activeExecutions.length,
        failureCount: failures.length,
        failureCodes: Object.freeze(failureCodes),
        windowStart: new Date(currentStart).toISOString(),
        windowEnd: now.toISOString(),
      }));
    }
  }

  for (let index = 0; index < input.sloResults.length; index += 1) {
    const result = input.sloResults[index]!;
    const path = `sloResults[${index}]`;
    if (!result || !requiredText(result.policyId) || !requiredText(result.tenantId)) fail("ANOMALY_SLO_INVALID", path);
    if (result.tenantId !== input.tenantId) fail("ANOMALY_TENANT_MISMATCH", `${path}.tenantId`);
    if (result.status !== "healthy" && result.status !== "breached" && result.status !== "insufficient_data") {
      fail("ANOMALY_SLO_INVALID", `${path}.status`);
    }
    if (!Number.isInteger(result.sampleSize) || result.sampleSize < 0 ||
        !validTimestamp(result.windowStart) || !validTimestamp(result.windowEnd) ||
        Date.parse(result.windowEnd) > nowMs || Date.parse(result.windowStart) > Date.parse(result.windowEnd) ||
        !Array.isArray(result.breaches)) {
      fail("ANOMALY_SLO_INVALID", path);
    }
    if (result.status !== "breached") continue;
    for (const [breachIndex, breach] of result.breaches.entries()) {
      const breachPath = `${path}.breaches[${breachIndex}]`;
      if (!breach || !["availability", "errorRate", "latencyP95Ms"].includes(breach.metric) ||
          !Number.isFinite(breach.observed) || !Number.isFinite(breach.target)) {
        fail("ANOMALY_SLO_INVALID", breachPath);
      }
      anomalies.push(Object.freeze({
        id: `slo:${encodeURIComponent(input.tenantId)}:${encodeURIComponent(result.policyId)}:${breach.metric}`,
        kind: "slo_breach",
        severity: "critical",
        tenantId: input.tenantId,
        policyId: result.policyId,
        metric: breach.metric,
        observed: breach.observed,
        target: breach.target,
        sampleSize: result.sampleSize,
        windowStart: result.windowStart,
        windowEnd: result.windowEnd,
      }));
    }
  }

  const unique = new Map<string, OperationalAnomaly>();
  for (const anomaly of anomalies) {
    if (!unique.has(anomaly.id)) unique.set(anomaly.id, anomaly);
  }
  const ordered = [...unique.values()].sort((a, b) =>
    a.kind.localeCompare(b.kind) || ("metric" in a ? a.metric : "") .localeCompare("metric" in b ? b.metric : "") || a.id.localeCompare(b.id),
  );

  return Object.freeze({
    tenantId: input.tenantId,
    generatedAt: now.toISOString(),
    anomalies: Object.freeze(ordered),
    insufficientData: Object.freeze({
      baselineMetrics: Object.freeze(insufficientMetrics.sort()),
      executionSamples: Math.max(0, input.minimumExecutionSamples - activeExecutions.length),
    }),
    evaluated: Object.freeze({
      baselineSamples: input.baselineSamples.length,
      currentSamples: activeCurrent.length,
      executionSamples: activeExecutions.length,
      sloPolicies: input.sloResults.length,
    }),
  });
}
