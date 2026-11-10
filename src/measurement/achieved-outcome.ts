export class OutcomeCalculationError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "OutcomeCalculationError";
  }
}

export interface AchievedOutcomeInput {
  tenantId: string;
  outcomeId: string;
  executionId: string;
  metric: string;
  unit: string;
  baseline: number;
  target: number;
  observations: readonly number[];
  confidenceLevel?: number;
}

export interface AchievedOutcome {
  tenantId: string;
  outcomeId: string;
  executionId: string;
  metric: string;
  unit: string;
  baseline: number;
  target: number;
  mean: number;
  sampleSize: number;
  standardDeviation: number;
  targetProgress: number;
  confidenceLevel: number;
  confidenceInterval: Readonly<{ lower: number; upper: number }>;
}

const text = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0 && v.length <= 256;
const finite = (v: unknown): v is number => typeof v === "number" && Number.isFinite(v);
function reject(code: string, path: string): never { throw new OutcomeCalculationError(code, path); }

// Two-sided Student-t critical values (95% and 90%); normal approximation for other confidence levels.
const T95 = [0, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042];
const T90 = [0, 6.314, 2.920, 2.353, 2.132, 2.015, 1.943, 1.895, 1.860, 1.833, 1.812, 1.796, 1.782, 1.771, 1.761, 1.753, 1.746, 1.740, 1.734, 1.729, 1.725, 1.721, 1.717, 1.714, 1.711, 1.708, 1.706, 1.703, 1.701, 1.699, 1.697];

function critical(confidence: number, df: number): number {
  const table = confidence === 0.95 ? T95 : confidence === 0.9 ? T90 : undefined;
  if (table) return table[Math.min(df, 30)] ?? 1.96;
  // Acklam inverse-normal approximation; adequate for the explicitly requested normal fallback.
  const p = (1 + confidence) / 2;
  const a = [-39.6968302866538, 220.946098424521, -275.928510446969, 138.357751867269, -30.6647980661472, 2.50662827745924];
  const b = [-54.4760987982241, 161.585836858041, -155.698979859887, 66.8013118877197, -13.2806815528857];
  const c = [-0.00778489400243029, -0.322396458041136, -2.40075827716184, -2.54973253934373, 4.37466414146497, 2.93816398269878];
  const d = [0.00778469570904146, 0.32246712907004, 2.445134137143, 3.75440866190742];
  if (p > 0.975) {
    const q = Math.sqrt(-2 * Math.log(1 - p));
    return (((((c[0]!*q+c[1]!)*q+c[2]!)*q+c[3]!)*q+c[4]!)*q+c[5]!)/((((d[0]!*q+d[1]!)*q+d[2]!)*q+d[3]!)*q+1);
  }
  const q = p - 0.5, r = q*q;
  return (((((a[0]!*r+a[1]!)*r+a[2]!)*r+a[3]!)*r+a[4]!)*r+a[5]!)*q/(((((b[0]!*r+b[1]!)*r+b[2]!)*r+b[3]!)*r+b[4]!)*r+1);
}

export function calculateAchievedOutcome(input: AchievedOutcomeInput): Readonly<AchievedOutcome> {
  if (!input || !text(input.tenantId) || !text(input.outcomeId) || !text(input.executionId)) reject("OUTCOME_SCOPE_INVALID", "scope");
  if (!text(input.metric)) reject("OUTCOME_METRIC_INVALID", "metric");
  if (!text(input.unit)) reject("OUTCOME_UNIT_INVALID", "unit");
  if (!finite(input.baseline)) reject("OUTCOME_BASELINE_INVALID", "baseline");
  if (!finite(input.target)) reject("OUTCOME_TARGET_INVALID", "target");
  const confidence = input.confidenceLevel ?? 0.95;
  if (!finite(confidence) || confidence <= 0 || confidence >= 1) reject("OUTCOME_CONFIDENCE_INVALID", "confidenceLevel");
  if (!Array.isArray(input.observations) || input.observations.length === 0) reject("OUTCOME_OBSERVATIONS_REQUIRED", "observations");
  if (input.observations.length > 10000) reject("OUTCOME_OBSERVATIONS_LIMIT", "observations");
  input.observations.forEach((value, i) => { if (!finite(value)) reject("OUTCOME_OBSERVATION_INVALID", `observations[${i}]`); });

  const n = input.observations.length;
  const mean = input.observations.reduce((sum, value) => sum + value, 0) / n;
  const variance = n > 1 ? input.observations.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (n - 1) : 0;
  const sd = Math.sqrt(variance);
  const margin = n > 1 ? critical(confidence, n - 1) * sd / Math.sqrt(n) : 0;
  const denominator = input.target - input.baseline;
  const progress = denominator === 0 ? (mean === input.target ? 1 : 0) : (mean - input.baseline) / denominator;
  if (![mean, sd, margin, progress].every(Number.isFinite)) reject("OUTCOME_CALCULATION_OVERFLOW", "observations");

  return Object.freeze({
    tenantId: input.tenantId, outcomeId: input.outcomeId, executionId: input.executionId,
    metric: input.metric, unit: input.unit, baseline: input.baseline, target: input.target,
    mean, sampleSize: n, standardDeviation: sd, targetProgress: progress,
    confidenceLevel: confidence,
    confidenceInterval: Object.freeze({ lower: mean - margin, upper: mean + margin }),
  });
}
