import type { MetricDefinition, Observation } from "../measurement/metrics.ts";
import { validateMetricDefinition } from "../measurement/metrics.ts";
import { assessDataQuality } from "../measurement/data-quality.ts";

export interface BaselineSnapshot {
  id?: string;
  metric: MetricDefinition;
  observations: Observation[];
  value: number;
  period: string;
  quality: "valid" | "incomplete" | "stale";
  approvedBy?: string;
  approvedAt?: string;
}

export interface OutcomeTarget {
  metricId: string;
  baseline: number;
  target: number;
  unit: string;
  periodStart: string;
  periodEnd: string;
  constraints: string[];
  version?: number;
  baselineSnapshotId?: string;
  approvedBy?: string;
  approvedAt?: string;
}

const validTimestamp = (value: string): boolean =>
  typeof value === "string" && value.trim().length > 0 && Number.isFinite(Date.parse(value));

export function validateBaseline(b: BaselineSnapshot, tolerance = 1e-9): string[] {
  const errors: string[] = [];
  errors.push(...validateMetricDefinition(b.metric).map(code => "METRIC_" + code.replace(/^METRIC_/, "")));
  if (typeof b.period !== "string" || !b.period.trim()) errors.push("BASELINE_PERIOD_REQUIRED");
  if (!Number.isFinite(tolerance) || tolerance < 0) errors.push("BASELINE_TOLERANCE_INVALID");
  if (!Number.isFinite(b.value)) errors.push("BASELINE_VALUE_INVALID");
  if (!Array.isArray(b.observations) || !b.observations.length) errors.push("BASELINE_OBSERVATIONS_REQUIRED");
  if (!["valid", "incomplete", "stale"].includes(b.quality)) errors.push("BASELINE_QUALITY_INVALID");
  if (b.quality !== "valid") errors.push("BASELINE_QUALITY_NOT_VALID");

  const sourceIds = new Set<string>();
  for (const observation of b.observations ?? []) {
    if (observation.metricId !== b.metric.id || observation.unit !== b.metric.unit) errors.push("BASELINE_METRIC_MISMATCH");
    if (!Number.isFinite(observation.value) || !Number.isFinite(observation.confidence) ||
        observation.confidence < 0 || observation.confidence > 1 || !validTimestamp(observation.observedAt)) {
      errors.push("BASELINE_OBSERVATION_INVALID");
    }
    if (typeof observation.sourceId !== "string" || !b.metric.requiredSources.includes(observation.sourceId)) {
      errors.push("BASELINE_SOURCE_INVALID");
    } else sourceIds.add(observation.sourceId);
  }

  if (b.observations?.length && Number.isFinite(b.value) && Number.isFinite(tolerance) && tolerance >= 0) {
    const values = b.observations.map(o => o.value);
    const ordered = [...b.observations].sort((a, z) => Date.parse(a.observedAt) - Date.parse(z.observedAt));
    const expected = b.metric.aggregation === "sum" ? values.reduce((x, y) => x + y, 0)
      : b.metric.aggregation === "avg" ? values.reduce((x, y) => x + y, 0) / values.length
      : b.metric.aggregation === "min" ? Math.min(...values)
      : b.metric.aggregation === "max" ? Math.max(...values)
      : b.metric.aggregation === "count" ? values.length
      : ordered[ordered.length - 1]!.value;
    if (Math.abs(expected - b.value) > tolerance) errors.push("BASELINE_AGGREGATION_MISMATCH");
  }
  if (b.id !== undefined && (typeof b.id !== "string" || !b.id.trim())) errors.push("BASELINE_ID_INVALID");
  return [...new Set(errors)];
}

export function approveBaseline(b: BaselineSnapshot, actor: string, at = new Date()): BaselineSnapshot {
  const errors = validateBaseline(b);
  if (errors.length) throw new Error("BASELINE_INVALID:" + errors.join(","));
  if (typeof actor !== "string" || !actor.trim()) throw new Error("BASELINE_APPROVER_REQUIRED");
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) throw new Error("BASELINE_APPROVAL_TIME_INVALID");
  return Object.freeze({
    ...b,
    id: b.id ?? `baseline:${b.metric.id}:${b.period}`,
    observations: Object.freeze([...b.observations]) as unknown as Observation[],
    metric: Object.freeze({ ...b.metric, requiredSources: Object.freeze([...b.metric.requiredSources]) as unknown as string[] }),
    approvedBy: actor.trim(),
    approvedAt: at.toISOString()
  });
}

export function detectBaselineChange(a: BaselineSnapshot, b: BaselineSnapshot, tolerance = 0): boolean {
  if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error("BASELINE_TOLERANCE_INVALID");
  return a.metric.id !== b.metric.id || a.metric.unit !== b.metric.unit ||
    Math.abs(a.value - b.value) > tolerance || a.period !== b.period ||
    a.metric.version !== b.metric.version || a.observations.length !== b.observations.length;
}

export function validateTarget(t: OutcomeTarget): string[] {
  const errors: string[] = [];
  if (typeof t.metricId !== "string" || !t.metricId.trim()) errors.push("metricId:REQUIRED");
  if (typeof t.unit !== "string" || !t.unit.trim()) errors.push("unit:REQUIRED");
  if (!Number.isFinite(t.baseline) || !Number.isFinite(t.target)) errors.push("values:INVALID");
  const start = Date.parse(t.periodStart);
  const end = Date.parse(t.periodEnd);
  if (!validTimestamp(t.periodStart) || !validTimestamp(t.periodEnd) || end <= start) errors.push("period:INVALID");
  if (!Array.isArray(t.constraints) || t.constraints.some(c => typeof c !== "string" || !c.trim())) errors.push("constraints:INVALID");
  else if (new Set(t.constraints).size !== t.constraints.length) errors.push("constraints:DUPLICATE");
  if (!Number.isInteger(t.version ?? 1) || (t.version ?? 1) < 1) errors.push("version:INVALID");
  return errors;
}

export function approveOutcomeTarget(
  t: OutcomeTarget, b: BaselineSnapshot, actor: string, at = new Date()
): OutcomeTarget {
  if (!b.approvedBy || !b.approvedAt) throw new Error("BASELINE_APPROVAL_REQUIRED");
  if (typeof actor !== "string" || !actor.trim() || actor.trim() === b.approvedBy) {
    throw new Error("TARGET_APPROVER_INDEPENDENT_REQUIRED");
  }
  if (!(at instanceof Date) || !Number.isFinite(at.getTime())) throw new Error("TARGET_APPROVAL_TIME_INVALID");
  const errors = validateTarget(t);
  if (errors.length) throw new Error("TARGET_INVALID:" + errors.join(","));
  if (t.metricId !== b.metric.id || t.unit !== b.metric.unit || t.baseline !== b.value) {
    throw new Error("TARGET_BASELINE_MISMATCH");
  }
  if (b.metric.direction === "increase" && t.target <= t.baseline) throw new Error("TARGET_DIRECTION_CONTRADICTION");
  if (b.metric.direction === "decrease" && t.target >= t.baseline) throw new Error("TARGET_DIRECTION_CONTRADICTION");
  if (Date.parse(t.periodStart) < Date.parse(b.period) && /^\d{4}-\d{2}-\d{2}/.test(b.period)) {
    throw new Error("TARGET_PERIOD_PRECEDES_BASELINE");
  }
  return Object.freeze({
    ...t,
    constraints: Object.freeze([...t.constraints]) as unknown as string[],
    version: t.version ?? 1,
    baselineSnapshotId: b.id ?? b.approvedAt,
    approvedBy: actor.trim(),
    approvedAt: at.toISOString()
  });
}

export function createBaselineSnapshot(
  metric: MetricDefinition, observations: readonly Observation[], period: string, now = new Date()
): BaselineSnapshot {
  if (!period.trim() || !observations.length) throw new Error("BASELINE_OBSERVATIONS_REQUIRED");
  const definitionErrors = validateMetricDefinition(metric);
  if (definitionErrors.length) throw new Error("BASELINE_METRIC_INVALID:" + definitionErrors.join(","));
  const values = observations.map(o => o.value);
  if (values.some(v => !Number.isFinite(v))) throw new Error("BASELINE_OBSERVATION_INVALID");
  const ordered = [...observations].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const value = metric.aggregation === "sum" ? values.reduce((a, b) => a + b, 0)
    : metric.aggregation === "avg" ? values.reduce((a, b) => a + b, 0) / values.length
    : metric.aggregation === "min" ? Math.min(...values)
    : metric.aggregation === "max" ? Math.max(...values)
    : metric.aggregation === "count" ? values.length
    : ordered[ordered.length - 1]!.value;
  const quality = assessDataQuality(metric, observations, metric.requiredSources, now);
  const status = quality.valid && quality.fresh && quality.complete ? "valid" : !quality.fresh ? "stale" : "incomplete";
  return Object.freeze({
    id: `baseline:${metric.id}:${period}`,
    metric: Object.freeze({ ...metric, requiredSources: Object.freeze([...metric.requiredSources]) as unknown as string[] }),
    observations: Object.freeze([...observations]) as unknown as Observation[],
    value, period, quality: status
  });
}
