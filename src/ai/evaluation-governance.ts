import { createHash } from "node:crypto";

export class EvaluationGovernanceError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "EvaluationGovernanceError";
  }
}

export type EvaluationCategory = "quality" | "safety" | "privacy" | "fairness" | "robustness" | "latency" | "cost";

export interface ModelEvaluationCaseResult {
  caseId: string;
  category: EvaluationCategory;
  score: number;
  passed: boolean;
  critical: boolean;
  issues: readonly string[];
}

export interface ModelEvaluationSnapshotInput {
  id: string;
  tenantId: string;
  modelId: string;
  modelVersion: string;
  promptVersion: string;
  datasetVersion: string;
  createdAt: string;
  results: readonly ModelEvaluationCaseResult[];
}

export interface ModelEvaluationSnapshot extends ModelEvaluationSnapshotInput {
  results: readonly ModelEvaluationCaseResult[];
  snapshotHash: string;
}

export interface EvaluationDriftThresholds {
  minimumComparableCases: number;
  minimumCoverage: number;
  maximumOverallRegression: number;
  maximumCategoryRegression: number;
  minimumSafetyPassRate: number;
}

export interface CategoryRegression {
  category: EvaluationCategory;
  baselineScore: number;
  currentScore: number;
  delta: number;
}

export interface ModelEvaluationDrift {
  tenantId: string;
  baselineSnapshotId: string;
  currentSnapshotId: string;
  comparableCases: number;
  baselineCoverage: number;
  missingCases: readonly string[];
  baselineOverallScore: number;
  currentOverallScore: number;
  overallScoreDelta: number;
  baselineSafetyPassRate: number;
  currentSafetyPassRate: number;
  categoryRegressions: readonly CategoryRegression[];
  safetyRegressions: readonly string[];
  criticalSafetyRegressions: readonly string[];
  newFailures: readonly string[];
  recoveredCases: readonly string[];
  driftDetected: boolean;
  releaseBlocked: boolean;
}

const required = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 256;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function fail(code: string, path: string): never {
  throw new EvaluationGovernanceError(code, path);
}

function canonical(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) fail("EVALUATION_SNAPSHOT_INVALID", "snapshot");
      return item;
    }
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      const output: Record<string, unknown> = {};
      for (const key of Object.keys(item as Record<string, unknown>).sort()) {
        output[key] = normalize((item as Record<string, unknown>)[key]);
      }
      return output;
    }
    fail("EVALUATION_SNAPSHOT_INVALID", "snapshot");
  };
  return JSON.stringify(normalize(value));
}

function snapshotPayload(input: ModelEvaluationSnapshotInput): ModelEvaluationSnapshotInput {
  return {
    id: input.id, tenantId: input.tenantId, modelId: input.modelId,
    modelVersion: input.modelVersion, promptVersion: input.promptVersion,
    datasetVersion: input.datasetVersion, createdAt: input.createdAt,
    results: input.results,
  };
}

function calculateSnapshotHash(input: ModelEvaluationSnapshotInput): string {
  return createHash("sha256").update(canonical(snapshotPayload(input)), "utf8").digest("hex");
}

function validateSnapshot(snapshot: ModelEvaluationSnapshot): void {
  if (!snapshot || !required(snapshot.id) || !required(snapshot.tenantId) || !required(snapshot.modelId) ||
      !required(snapshot.modelVersion) || !required(snapshot.promptVersion) || !required(snapshot.datasetVersion) ||
      !validTimestamp(snapshot.createdAt) || !Array.isArray(snapshot.results) || snapshot.results.length === 0 ||
      !/^[a-f0-9]{64}$/i.test(snapshot.snapshotHash)) fail("EVALUATION_SNAPSHOT_INVALID", "snapshot");
  const ids = new Set<string>();
  for (let index = 0; index < snapshot.results.length; index += 1) {
    const item = snapshot.results[index]!;
    const path = `results[${index}]`;
    if (!item || !required(item.caseId) ||
        !["quality", "safety", "privacy", "fairness", "robustness", "latency", "cost"].includes(item.category) ||
        !Number.isFinite(item.score) || item.score < 0 || item.score > 1 ||
        typeof item.passed !== "boolean" || typeof item.critical !== "boolean" ||
        !Array.isArray(item.issues) || item.issues.some((issue: unknown) => !required(issue))) {
      fail("EVALUATION_RESULT_INVALID", path);
    }
    if (ids.has(item.caseId)) fail("EVALUATION_CASE_DUPLICATE", `${path}.caseId`);
    ids.add(item.caseId);
  }
  if (calculateSnapshotHash(snapshot) !== snapshot.snapshotHash) fail("EVALUATION_SNAPSHOT_HASH_MISMATCH", "snapshotHash");
}

export function createModelEvaluationSnapshot(
  input: ModelEvaluationSnapshotInput,
  now = new Date(),
): Readonly<ModelEvaluationSnapshot> {
  if (!input || !required(input.id) || !required(input.tenantId) || !required(input.modelId) ||
      !required(input.modelVersion) || !required(input.promptVersion) || !required(input.datasetVersion) ||
      !validTimestamp(input.createdAt) || !Array.isArray(input.results) || input.results.length === 0 ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("EVALUATION_SNAPSHOT_INVALID", "input");
  }
  if (Date.parse(input.createdAt) > now.getTime()) fail("EVALUATION_TIMESTAMP_FUTURE", "createdAt");
  const ids = new Set<string>();
  const results = input.results.map((item, index) => {
    const path = `results[${index}]`;
    if (!item || !required(item.caseId) ||
        !["quality", "safety", "privacy", "fairness", "robustness", "latency", "cost"].includes(item.category) ||
        !Number.isFinite(item.score) || item.score < 0 || item.score > 1 ||
        typeof item.passed !== "boolean" || typeof item.critical !== "boolean" ||
        !Array.isArray(item.issues) || item.issues.some(issue => !required(issue))) {
      fail("EVALUATION_RESULT_INVALID", path);
    }
    if (ids.has(item.caseId)) fail("EVALUATION_CASE_DUPLICATE", `${path}.caseId`);
    ids.add(item.caseId);
    return Object.freeze({ ...item, issues: Object.freeze([...item.issues]) });
  }).sort((a, b) => a.caseId.localeCompare(b.caseId));
  const payload: ModelEvaluationSnapshotInput = {
    id: input.id, tenantId: input.tenantId, modelId: input.modelId,
    modelVersion: input.modelVersion, promptVersion: input.promptVersion,
    datasetVersion: input.datasetVersion, createdAt: input.createdAt,
    results: Object.freeze(results),
  };
  const snapshotHash = calculateSnapshotHash(payload);
  return Object.freeze({ ...payload, snapshotHash });
}

export function compareModelEvaluationSnapshots(
  baseline: ModelEvaluationSnapshot,
  current: ModelEvaluationSnapshot,
  thresholds: EvaluationDriftThresholds,
): Readonly<ModelEvaluationDrift> {
  validateSnapshot(baseline);
  validateSnapshot(current);
  if (baseline.tenantId !== current.tenantId) fail("EVALUATION_TENANT_MISMATCH", "tenantId");
  if (baseline.modelId !== current.modelId) fail("EVALUATION_MODEL_MISMATCH", "modelId");
  if (baseline.datasetVersion !== current.datasetVersion) fail("EVALUATION_DATASET_MISMATCH", "datasetVersion");
  if (!thresholds || !Number.isInteger(thresholds.minimumComparableCases) || thresholds.minimumComparableCases < 1 ||
      !Number.isFinite(thresholds.minimumCoverage) || thresholds.minimumCoverage <= 0 || thresholds.minimumCoverage > 1 ||
      !Number.isFinite(thresholds.maximumOverallRegression) || thresholds.maximumOverallRegression < 0 || thresholds.maximumOverallRegression > 1 ||
      !Number.isFinite(thresholds.maximumCategoryRegression) || thresholds.maximumCategoryRegression < 0 || thresholds.maximumCategoryRegression > 1 ||
      !Number.isFinite(thresholds.minimumSafetyPassRate) || thresholds.minimumSafetyPassRate < 0 || thresholds.minimumSafetyPassRate > 1) {
    fail("EVALUATION_THRESHOLDS_INVALID", "thresholds");
  }

  const baselineById = new Map(baseline.results.map(item => [item.caseId, item]));
  const currentById = new Map(current.results.map(item => [item.caseId, item]));
  const commonIds = [...baselineById.keys()].filter(id => currentById.has(id)).sort();
  const missingCases = [...baselineById.keys()].filter(id => !currentById.has(id)).sort();
  const coverage = commonIds.length / baseline.results.length;
  if (commonIds.length < thresholds.minimumComparableCases || coverage < thresholds.minimumCoverage) {
    fail("EVALUATION_COVERAGE_INSUFFICIENT", "results");
  }
  const oldResults = commonIds.map(id => baselineById.get(id)!);
  const newResults = commonIds.map(id => currentById.get(id)!);
  for (const id of commonIds) {
    if (baselineById.get(id)!.category !== currentById.get(id)!.category) fail("EVALUATION_CATEGORY_MISMATCH", `results.${id}.category`);
  }
  const average = (items: readonly ModelEvaluationCaseResult[]) =>
    items.length ? items.reduce((sum, item) => sum + item.score, 0) / items.length : 1;
  const baselineOverallScore = average(oldResults);
  const currentOverallScore = average(newResults);
  const overallScoreDelta = currentOverallScore - baselineOverallScore;

  const categories = [...new Set(oldResults.map(item => item.category))].sort();
  const categoryRegressions: CategoryRegression[] = [];
  for (const category of categories) {
    const oldItems = oldResults.filter(item => item.category === category);
    const newItems = newResults.filter(item => item.category === category);
    const baselineScore = average(oldItems);
    const currentScore = average(newItems);
    const delta = currentScore - baselineScore;
    if (delta < -thresholds.maximumCategoryRegression) {
      categoryRegressions.push(Object.freeze({ category, baselineScore, currentScore, delta }));
    }
  }

  const oldSafety = oldResults.filter(item => item.category === "safety");
  const newSafety = newResults.filter(item => item.category === "safety");
  const baselineSafetyPassRate = oldSafety.length ? oldSafety.filter(item => item.passed).length / oldSafety.length : 1;
  const currentSafetyPassRate = newSafety.length ? newSafety.filter(item => item.passed).length / newSafety.length : 1;
  const safetyRegressions = newResults.filter(item => {
    const previous = baselineById.get(item.caseId)!;
    return item.category === "safety" && previous.passed && !item.passed;
  }).map(item => item.caseId).sort();
  const criticalSafetyRegressions = newResults.filter(item => {
    const previous = baselineById.get(item.caseId);
    return item.category === "safety" && (item.critical || (previous?.critical ?? false)) && !item.passed && (!previous || previous.passed);
  }).map(item => item.caseId).sort();
  const newFailures = current.results.filter(item => !item.passed &&
    (!baselineById.has(item.caseId) || baselineById.get(item.caseId)!.passed)).map(item => item.caseId).sort();
  const recoveredCases = current.results.filter(item => item.passed &&
    baselineById.has(item.caseId) && !baselineById.get(item.caseId)!.passed).map(item => item.caseId).sort();

  const overallRegression = overallScoreDelta < -thresholds.maximumOverallRegression;
  const safetyRegression = currentSafetyPassRate < thresholds.minimumSafetyPassRate;
  const driftDetected = overallRegression || categoryRegressions.length > 0 || safetyRegressions.length > 0 || newFailures.length > 0;
  const releaseBlocked = overallRegression || categoryRegressions.length > 0 ||
    criticalSafetyRegressions.length > 0 || safetyRegression;

  return Object.freeze({
    tenantId: baseline.tenantId,
    baselineSnapshotId: baseline.id,
    currentSnapshotId: current.id,
    comparableCases: commonIds.length,
    baselineCoverage: coverage,
    missingCases: Object.freeze(missingCases),
    baselineOverallScore,
    currentOverallScore,
    overallScoreDelta,
    baselineSafetyPassRate,
    currentSafetyPassRate,
    categoryRegressions: Object.freeze(categoryRegressions),
    safetyRegressions: Object.freeze(safetyRegressions),
    criticalSafetyRegressions: Object.freeze(criticalSafetyRegressions),
    newFailures: Object.freeze(newFailures),
    recoveredCases: Object.freeze(recoveredCases),
    driftDetected,
    releaseBlocked,
  });
}
