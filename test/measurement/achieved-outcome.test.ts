import test from "node:test";
import assert from "node:assert/strict";
import { calculateAchievedOutcome, OutcomeCalculationError } from "../../src/measurement/achieved-outcome.ts";

const valid = {
  tenantId: "tenant-a", outcomeId: "outcome-1", executionId: "execution-1",
  metric: "revenue", unit: "BRL", baseline: 100, target: 150,
  observations: [145, 155, 150, 160], confidenceLevel: 0.95,
};

test("calculates achieved value, target progress and deterministic confidence interval", () => {
  const result = calculateAchievedOutcome(valid);
  assert.equal(result.mean, 152.5);
  assert.equal(result.sampleSize, 4);
  assert.equal(result.targetProgress, 1.05);
  assert.ok(result.confidenceInterval.lower < result.mean);
  assert.ok(result.confidenceInterval.upper > result.mean);
  assert.equal(result.confidenceLevel, 0.95);
  assert.equal(result.tenantId, valid.tenantId);
  assert.ok(Object.isFrozen(result));
});

test("supports negative direction goals and zero-baseline-safe progress", () => {
  const lower = calculateAchievedOutcome({ ...valid, baseline: 20, target: 10, observations: [12, 10, 8, 10] });
  assert.equal(lower.mean, 10);
  assert.equal(lower.targetProgress, 1);
  const zero = calculateAchievedOutcome({ ...valid, baseline: 0, target: 10, observations: [8, 10, 12, 10] });
  assert.equal(zero.targetProgress, 1);
});

test("rejects missing scope, invalid metric/unit and empty or non-finite observations", () => {
  assert.throws(() => calculateAchievedOutcome({ ...valid, tenantId: "" }), (e: unknown) => e instanceof OutcomeCalculationError && e.code === "OUTCOME_SCOPE_INVALID");
  assert.throws(() => calculateAchievedOutcome({ ...valid, metric: " " }), /OUTCOME_METRIC_INVALID/);
  assert.throws(() => calculateAchievedOutcome({ ...valid, unit: "" }), /OUTCOME_UNIT_INVALID/);
  assert.throws(() => calculateAchievedOutcome({ ...valid, observations: [] }), /OUTCOME_OBSERVATIONS_REQUIRED/);
  assert.throws(() => calculateAchievedOutcome({ ...valid, observations: [1, Number.NaN] }), /OUTCOME_OBSERVATION_INVALID/);
});

test("rejects invalid baseline, target and confidence level", () => {
  assert.throws(() => calculateAchievedOutcome({ ...valid, baseline: Infinity }), /OUTCOME_BASELINE_INVALID/);
  assert.throws(() => calculateAchievedOutcome({ ...valid, target: NaN }), /OUTCOME_TARGET_INVALID/);
  assert.throws(() => calculateAchievedOutcome({ ...valid, confidenceLevel: 1 }), /OUTCOME_CONFIDENCE_INVALID/);
  assert.throws(() => calculateAchievedOutcome({ ...valid, confidenceLevel: 0 }), /OUTCOME_CONFIDENCE_INVALID/);
});

test("bounds observations and computes a zero-width interval for a single observation", () => {
  const one = calculateAchievedOutcome({ ...valid, observations: [42] });
  assert.equal(one.mean, 42);
  assert.deepEqual(one.confidenceInterval, { lower: 42, upper: 42 });
  assert.throws(() => calculateAchievedOutcome({ ...valid, observations: Array(10001).fill(1) }), /OUTCOME_OBSERVATIONS_LIMIT/);
});

test("does not mutate input and is deterministic for repeated calls", () => {
  const input = structuredClone(valid);
  assert.deepEqual(calculateAchievedOutcome(input), calculateAchievedOutcome(input));
  assert.deepEqual(input, valid);
});
