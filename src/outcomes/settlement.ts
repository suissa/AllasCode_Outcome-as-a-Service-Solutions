import type {MetricDefinition,Observation} from "../measurement/metrics.ts";export interface OutcomeSpec{metric:MetricDefinition;baseline:number;target:number;direction:"increase"|"decrease";periodStart:string;periodEnd:string;attribution:"direct"|"contribution"|"experimental";approvedBy:string}export interface OutcomeResult{baseline:number;target:number;observed:number;absoluteChange:number;targetProgress:number;confidence:number;achieved:boolean;attribution?:AttributionResult}export function calculateOutcome(s:OutcomeSpec,o:Observation):OutcomeResult{if(!s.approvedBy)throw new Error("OUTCOME_NOT_APPROVED");if(o.metricId!==s.metric.id||o.unit!==s.metric.unit)throw new Error("OUTCOME_METRIC_MISMATCH");const delta=o.value-s.baseline;const targetDelta=s.target-s.baseline;const progress=targetDelta===0?(o.value===s.target?1:0):delta/targetDelta;return Object.freeze({baseline:s.baseline,target:s.target,observed:o.value,absoluteChange:delta,targetProgress:Math.max(0,Math.min(1,progress)),confidence:o.confidence,achieved:s.direction==="increase"?o.value>=s.target:o.value<=s.target})}
export interface ConfidenceIntervalInput { mean: number; standardDeviation: number; sampleSize: number; confidenceLevel?: 0.9|0.95|0.99 }
export interface ConfidenceInterval { lower: number; upper: number; standardError: number; confidenceLevel: number; method: "normal-approximation" }
export function calculateConfidenceInterval(input: ConfidenceIntervalInput): ConfidenceInterval {
  const { mean, standardDeviation, sampleSize } = input;
  const level = input.confidenceLevel ?? 0.95;
  if (![mean, standardDeviation].every(Number.isFinite) || standardDeviation < 0 || !Number.isInteger(sampleSize) || sampleSize < 2)
    throw new Error("CONFIDENCE_INPUT_INVALID");
  if (sampleSize < 30) throw new Error("CONFIDENCE_SAMPLE_TOO_SMALL_FOR_NORMAL_APPROXIMATION");
  const z = level === 0.9 ? 1.6448536269514722 : level === 0.99 ? 2.5758293035489004 : 1.959963984540054;
  const standardError = standardDeviation / Math.sqrt(sampleSize);
  const margin = z * standardError;
  return Object.freeze({ lower: mean - margin, upper: mean + margin, standardError, confidenceLevel: level, method: "normal-approximation" });
}
