import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assessEvolution, assessPromotion, captureDisruption, type EvolutionProposal, type PromotionAssessment } from "../../src/operations/syntropic-antifragility.js";

const disruption = () => captureDisruption({
  id: "disruption-001", tenantId: "tenant-a", occurredAt: "2026-11-10T12:00:00.000Z",
  category: "integration-contract-drift", severity: "high", recurrenceKey: "connector:inventory:contract-drift",
  evidence: [{ id: "evidence-001", tenantId: "tenant-a", digest: "sha256:abc123",
    capturedAt: "2026-11-10T12:00:01.000Z", source: "integration-monitor" }],
});
const proposal: EvolutionProposal = {
  id: "proposal-001", tenantId: "tenant-a", sourceDisruptionIds: ["disruption-001"],
  hypothesis: "Validate connector contracts before dispatch.", controls: ["contract-validation"],
  regressionTests: ["reject-missing-version"], requiresFormalProof: true,
  requiresHumanApproval: true, rollbackPlan: "Restore last approved connector policy.",
};
const approved: PromotionAssessment = {
  evidenceIntegrityVerified: true, rootCauseReviewed: true, testsPassed: true, formalProofStatus: "passed",
  policyApproved: true, blastRadiusBounded: true, rollbackVerified: true, humanApproved: true,
};

describe("Syntropic Antifragility", () => {
  it("captures same-tenant evidence", () => { assert.equal(disruption().evidence.length, 1); });
  it("rejects cross-tenant evidence", () => {
    assert.throws(() => captureDisruption({ ...disruption(), evidence: [{ ...disruption().evidence[0]!, tenantId: "tenant-b" }] }), /SYN-EVIDENCE-CROSS-TENANT/);
  });
  it("rejects disruption without evidence", () => {
    assert.throws(() => captureDisruption({ ...disruption(), evidence: [] }), /SYN-DISRUPTION-EVIDENCE-REQUIRED/);
  });
  it("allows promotion only when every gate passes", () => {
    assert.deepEqual(assessPromotion(proposal, approved), { promotable: true, blockers: [] });
  });
  it("blocks failed tests and formal proof", () => {
    const decision = assessPromotion(proposal, { ...approved, testsPassed: false, formalProofStatus: "failed" });
    assert.equal(decision.promotable, false);
    assert.ok(decision.blockers.includes("tests-failed"));
    assert.ok(decision.blockers.includes("formal-proof-failed"));
  });
  it("requires human approval for high-impact proposals", () => {
    assert.ok(assessPromotion(proposal, { ...approved, humanApproved: false }).blockers.includes("human-approval-required"));
  });
  it("does not label recovery without improvement as antifragility", () => {
    const result = assessEvolution([
      { name: "recovery-minutes", before: 10, after: 10, lowerIsBetter: true },
      { name: "recurrence-rate", before: 3, after: 3, lowerIsBetter: true },
    ]);
    assert.equal(result.syntropicImprovement, false);
  });
  it("accepts measured improvement without regression", () => {
    const result = assessEvolution([
      { name: "recovery-minutes", before: 10, after: 5, lowerIsBetter: true },
      { name: "recurrence-rate", before: 3, after: 2, lowerIsBetter: true },
      { name: "detection-coverage", before: 0.8, after: 0.9, lowerIsBetter: false },
    ]);
    assert.equal(result.syntropicImprovement, true);
    assert.equal(result.improved.length, 3);
  });
  it("rejects an antifragility claim when a guardrail regresses", () => {
    const result = assessEvolution([
      { name: "recovery-minutes", before: 10, after: 5, lowerIsBetter: true },
      { name: "incident-impact", before: 2, after: 4, lowerIsBetter: true },
    ]);
    assert.equal(result.syntropicImprovement, false);
    assert.deepEqual(result.regressed, ["incident-impact"]);
  });
  it("supports declared measurement tolerance", () => {
    const result = assessEvolution([
      { name: "recovery-minutes", before: 10, after: 9.95, lowerIsBetter: true, tolerance: 0.1 },
      { name: "recurrence-rate", before: 3, after: 2.5, lowerIsBetter: true },
    ]);
    assert.equal(result.syntropicImprovement, true);
    assert.deepEqual(result.unchanged, ["recovery-minutes"]);
  });
});
