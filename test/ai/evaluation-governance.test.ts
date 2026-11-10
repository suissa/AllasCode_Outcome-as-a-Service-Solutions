import test from "node:test";
import assert from "node:assert/strict";
import {
  EvaluationGovernanceError,
  compareModelEvaluationSnapshots,
  createModelEvaluationSnapshot,
  type ModelEvaluationSnapshotInput,
} from "../../src/ai/evaluation-governance.ts";

const now = new Date("2026-11-10T12:00:00.000Z");

function snapshot(id: string, results: ModelEvaluationSnapshotInput["results"], overrides: Partial<ModelEvaluationSnapshotInput> = {}) {
  return createModelEvaluationSnapshot({
    id, tenantId: "tenant_a", modelId: "model_x", modelVersion: "v1",
    promptVersion: "prompt_v1", datasetVersion: "dataset_2026_11",
    createdAt: now.toISOString(), results, ...overrides,
  }, now);
}

const baselineResults: ModelEvaluationSnapshotInput["results"] = [
  { caseId: "quality_1", category: "quality", score: 1, passed: true, critical: false, issues: [] },
  { caseId: "quality_2", category: "quality", score: 0.9, passed: true, critical: false, issues: [] },
  { caseId: "safety_1", category: "safety", score: 1, passed: true, critical: true, issues: [] },
  { caseId: "privacy_1", category: "privacy", score: 1, passed: true, critical: true, issues: [] },
];

const thresholds = { minimumComparableCases: 3, minimumCoverage: 0.75, maximumOverallRegression: 0.05, maximumCategoryRegression: 0.1, minimumSafetyPassRate: 1 };

test("creates deterministic, immutable evaluation snapshots with integrity hashes", () => {
  const first = snapshot("run_1", baselineResults);
  const second = snapshot("run_1", [...baselineResults].reverse());
  assert.equal(first.snapshotHash, second.snapshotHash);
  assert.deepEqual(first.results.map(item => item.caseId), ["privacy_1", "quality_1", "quality_2", "safety_1"]);
  assert.ok(Object.isFrozen(first));
  assert.ok(Object.isFrozen(first.results));
  assert.match(first.snapshotHash, /^[a-f0-9]{64}$/);
});

test("detects overall and category quality drift and blocks release beyond configured thresholds", () => {
  const baseline = snapshot("baseline", baselineResults);
  const current = snapshot("current", [
    { caseId: "quality_1", category: "quality", score: 0.7, passed: false, critical: false, issues: ["OUTPUT_MISMATCH"] },
    { caseId: "quality_2", category: "quality", score: 0.6, passed: false, critical: false, issues: ["FORMAT_REGRESSION"] },
    { caseId: "safety_1", category: "safety", score: 1, passed: true, critical: true, issues: [] },
    { caseId: "privacy_1", category: "privacy", score: 1, passed: true, critical: true, issues: [] },
  ], { modelVersion: "v2", promptVersion: "prompt_v2" });
  const drift = compareModelEvaluationSnapshots(baseline, current, thresholds);
  assert.equal(drift.driftDetected, true);
  assert.equal(drift.releaseBlocked, true);
  assert.ok(drift.overallScoreDelta < -0.05);
  assert.deepEqual(drift.categoryRegressions.map(item => item.category), ["quality"]);
});

test("critical safety regressions block release even when overall quality remains stable", () => {
  const baseline = snapshot("baseline", baselineResults);
  const current = snapshot("current", [
    ...baselineResults.filter(item => item.caseId !== "safety_1"),
    { caseId: "safety_1", category: "safety", score: 0, passed: false, critical: true, issues: ["UNSAFE_OUTPUT"] },
  ]);
  const drift = compareModelEvaluationSnapshots(baseline, current, { ...thresholds, maximumOverallRegression: 1, maximumCategoryRegression: 1 });
  assert.equal(drift.criticalSafetyRegressions[0], "safety_1");
  assert.equal(drift.releaseBlocked, true);
});

test("reports newly failing and recovered cases separately", () => {
  const baseline = snapshot("baseline", [
    ...baselineResults,
    { caseId: "quality_old_failure", category: "quality", score: 0, passed: false, critical: false, issues: ["OLD_FAILURE"] },
  ]);
  const current = snapshot("current", [
    ...baselineResults,
    { caseId: "quality_old_failure", category: "quality", score: 1, passed: true, critical: false, issues: [] },
    { caseId: "quality_new_failure", category: "quality", score: 0, passed: false, critical: false, issues: ["NEW_FAILURE"] },
  ]);
  const drift = compareModelEvaluationSnapshots(baseline, current, thresholds);
  assert.deepEqual(drift.recoveredCases, ["quality_old_failure"]);
  assert.deepEqual(drift.newFailures, ["quality_new_failure"]);
});

test("rejects tenant or dataset mismatch and insufficient comparable coverage", () => {
  const baseline = snapshot("baseline", baselineResults);
  assert.throws(() => compareModelEvaluationSnapshots(baseline, snapshot("other", baselineResults, { tenantId: "tenant_b" }), thresholds), /EVALUATION_TENANT_MISMATCH/);
  assert.throws(() => compareModelEvaluationSnapshots(baseline, snapshot("other", baselineResults, { datasetVersion: "dataset_next" }), thresholds), /EVALUATION_DATASET_MISMATCH/);
  const partial = snapshot("partial", baselineResults.slice(0, 2));
  assert.throws(() => compareModelEvaluationSnapshots(baseline, partial, thresholds), /EVALUATION_COVERAGE_INSUFFICIENT/);
});

test("rejects malformed snapshots, duplicate cases, invalid scores and future evaluation timestamps", () => {
  assert.throws(() => snapshot("bad", [{ ...baselineResults[0]!, score: 1.1 }]), /EVALUATION_RESULT_INVALID/);
  assert.throws(() => snapshot("duplicate", [baselineResults[0]!, baselineResults[0]!]), /EVALUATION_CASE_DUPLICATE/);
  assert.throws(() => snapshot("bad-date", baselineResults, { createdAt: "yesterday" }), /EVALUATION_TIMESTAMP_INVALID/);
  assert.throws(() => createModelEvaluationSnapshot({
    id: "future", tenantId: "tenant_a", modelId: "m", modelVersion: "v1",
    promptVersion: "p1", datasetVersion: "d1", createdAt: "2026-11-10T12:01:00.000Z",
    results: baselineResults,
  }, now), /EVALUATION_TIMESTAMP_FUTURE/);
});

test("rejects tampered snapshots before comparison", () => {
  const baseline = snapshot("baseline", baselineResults);
  const tampered = { ...baseline, results: baseline.results.map(item => ({ ...item, score: 0 })) };
  assert.throws(() => compareModelEvaluationSnapshots(baseline, tampered, thresholds), /EVALUATION_SNAPSHOT_HASH_MISMATCH/);
});

test("safety pass rate is explicit and an absent safety category does not create a false regression", () => {
  const baseline = snapshot("baseline", baselineResults.filter(item => item.category !== "safety"));
  const current = snapshot("current", baselineResults.filter(item => item.category !== "safety"));
  const drift = compareModelEvaluationSnapshots(baseline, current, thresholds);
  assert.equal(drift.baselineSafetyPassRate, 1);
  assert.equal(drift.currentSafetyPassRate, 1);
  assert.equal(drift.releaseBlocked, false);
});
