/**
 * Syntropic Antifragility domain primitives.
 * A disruption is evidence, not permission to mutate production.
 */
export type DisruptionSeverity = "low" | "medium" | "high" | "critical";
export interface EvidenceReference {
  readonly id: string; readonly tenantId: string; readonly digest: string;
  readonly capturedAt: string; readonly source: string;
}
export interface Disruption {
  readonly id: string; readonly tenantId: string; readonly occurredAt: string;
  readonly category: string; readonly severity: DisruptionSeverity;
  readonly recurrenceKey: string; readonly evidence: readonly EvidenceReference[];
}
export interface EvolutionProposal {
  readonly id: string; readonly tenantId: string; readonly sourceDisruptionIds: readonly string[];
  readonly hypothesis: string; readonly controls: readonly string[];
  readonly regressionTests: readonly string[]; readonly requiresFormalProof: boolean;
  readonly requiresHumanApproval: boolean; readonly rollbackPlan: string;
}
export type FormalProofStatus = "passed" | "not-required" | "failed" | "missing";
export interface PromotionAssessment {
  readonly evidenceIntegrityVerified: boolean; readonly rootCauseReviewed: boolean;
  readonly testsPassed: boolean; readonly formalProofStatus: FormalProofStatus;
  readonly policyApproved: boolean; readonly blastRadiusBounded: boolean;
  readonly rollbackVerified: boolean; readonly humanApproved: boolean;
}
export type PromotionBlocker =
  | "evidence-unverified" | "root-cause-unreviewed" | "tests-failed"
  | "formal-proof-missing" | "formal-proof-failed" | "policy-not-approved"
  | "blast-radius-unbounded" | "rollback-not-verified" | "human-approval-required";
export interface PromotionDecision { readonly promotable: boolean; readonly blockers: readonly PromotionBlocker[]; }
export interface EvolutionMetric {
  readonly name: string; readonly before: number; readonly after: number;
  readonly lowerIsBetter: boolean; readonly tolerance?: number;
}
export interface EvolutionAssessment {
  readonly syntropicImprovement: boolean; readonly improved: readonly string[];
  readonly regressed: readonly string[]; readonly unchanged: readonly string[];
}

export function captureDisruption(input: Disruption): Disruption {
  if (!input.id.trim() || !input.tenantId.trim() || !input.category.trim() || !input.recurrenceKey.trim())
    throw new Error("SYN-DISRUPTION-REQUIRED-FIELD");
  if (!Number.isFinite(Date.parse(input.occurredAt))) throw new Error("SYN-DISRUPTION-INVALID-TIMESTAMP");
  if (input.evidence.length === 0) throw new Error("SYN-DISRUPTION-EVIDENCE-REQUIRED");
  for (const evidence of input.evidence) {
    if (!evidence.id.trim() || !evidence.digest.trim() || !evidence.source.trim())
      throw new Error("SYN-EVIDENCE-INCOMPLETE");
    if (evidence.tenantId !== input.tenantId) throw new Error("SYN-EVIDENCE-CROSS-TENANT");
    if (!Number.isFinite(Date.parse(evidence.capturedAt))) throw new Error("SYN-EVIDENCE-INVALID-TIMESTAMP");
  }
  return Object.freeze({ ...input, evidence: Object.freeze(input.evidence.map((item) => Object.freeze({ ...item }))) });
}

/** Pure gate: missing/failed required proof, failed tests or missing authority block promotion. */
export function assessPromotion(proposal: EvolutionProposal, assessment: PromotionAssessment): PromotionDecision {
  const blockers: PromotionBlocker[] = [];
  if (!assessment.evidenceIntegrityVerified) blockers.push("evidence-unverified");
  if (!assessment.rootCauseReviewed) blockers.push("root-cause-unreviewed");
  if (!assessment.testsPassed) blockers.push("tests-failed");
  if (assessment.formalProofStatus === "failed") blockers.push("formal-proof-failed");
  if (proposal.requiresFormalProof && assessment.formalProofStatus !== "passed" && assessment.formalProofStatus !== "failed")
    blockers.push("formal-proof-missing");
  if (!proposal.requiresFormalProof && assessment.formalProofStatus === "missing") blockers.push("formal-proof-missing");
  if (!assessment.policyApproved) blockers.push("policy-not-approved");
  if (!assessment.blastRadiusBounded) blockers.push("blast-radius-unbounded");
  if (!assessment.rollbackVerified || !proposal.rollbackPlan.trim()) blockers.push("rollback-not-verified");
  if (proposal.requiresHumanApproval && !assessment.humanApproved) blockers.push("human-approval-required");
  return Object.freeze({ promotable: blockers.length === 0, blockers: Object.freeze(blockers) });
}

/** Improvement requires at least one material gain and zero guardrail regressions. */
export function assessEvolution(metrics: readonly EvolutionMetric[]): EvolutionAssessment {
  if (metrics.length === 0) throw new Error("SYN-EVOLUTION-METRICS-REQUIRED");
  const improved: string[] = [], regressed: string[] = [], unchanged: string[] = [];
  for (const metric of metrics) {
    if (!metric.name.trim() || !Number.isFinite(metric.before) || !Number.isFinite(metric.after))
      throw new Error("SYN-EVOLUTION-METRIC-INVALID");
    const tolerance = metric.tolerance ?? 0;
    if (!Number.isFinite(tolerance) || tolerance < 0) throw new Error("SYN-EVOLUTION-TOLERANCE-INVALID");
    const delta = metric.lowerIsBetter ? metric.before - metric.after : metric.after - metric.before;
    if (delta > tolerance) improved.push(metric.name);
    else if (delta < -tolerance) regressed.push(metric.name);
    else unchanged.push(metric.name);
  }
  return Object.freeze({
    syntropicImprovement: improved.length > 0 && regressed.length === 0,
    improved: Object.freeze(improved), regressed: Object.freeze(regressed), unchanged: Object.freeze(unchanged),
  });
}
