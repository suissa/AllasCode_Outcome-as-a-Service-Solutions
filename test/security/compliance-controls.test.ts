import test from "node:test";
import assert from "node:assert/strict";
import {
  ComplianceControlError,
  buildComplianceEvidenceBundle,
  reviewComplianceEvidenceBundle,
  runSecurityPrivacyControls,
  type ComplianceControl,
  type ControlEvidenceObservation,
} from "../../src/security/compliance-controls.ts";

const now = new Date("2026-11-10T12:00:00.000Z");
const controls: ComplianceControl[] = [
  { id: "access-review", tenantId: "tenant_a", name: "Access review freshness", category: "access", requiredEvidenceKinds: ["access_review"], minimumEvidencePerKind: 1, maxEvidenceAgeSeconds: 3600, severity: "high", enabled: true },
  { id: "privacy-consent", tenantId: "tenant_a", name: "Consent and retention", category: "privacy", requiredEvidenceKinds: ["consent_record", "retention_check"], minimumEvidencePerKind: 1, maxEvidenceAgeSeconds: 86400, severity: "critical", enabled: true },
];
const evidence: ControlEvidenceObservation[] = [
  { id: "ev-access", tenantId: "tenant_a", controlId: "access-review", kind: "access_review", sourceId: "iam", capturedAt: "2026-11-10T11:50:00.000Z", contentHash: "a".repeat(64), classification: "internal", result: "passed", preparedBy: "system", verifiedBy: "reviewer" },
  { id: "ev-consent", tenantId: "tenant_a", controlId: "privacy-consent", kind: "consent_record", sourceId: "consent-db", capturedAt: "2026-11-10T11:45:00.000Z", contentHash: "b".repeat(64), classification: "personal", result: "passed", consentId: "consent_1", verifiedBy: "privacy_officer" },
  { id: "ev-retention", tenantId: "tenant_a", controlId: "privacy-consent", kind: "retention_check", sourceId: "retention-job", capturedAt: "2026-11-10T11:46:00.000Z", contentHash: "c".repeat(64), classification: "internal", result: "passed" },
];

function run(overrides: Partial<Parameters<typeof runSecurityPrivacyControls>[0]> = {}) {
  return runSecurityPrivacyControls({
    tenantId: "tenant_a", actorId: "control_runner", periodStart: "2026-11-10T00:00:00.000Z",
    periodEnd: "2026-11-10T12:00:00.000Z", controls, evidence, now, ...overrides,
  });
}

test("runs tenant-scoped security and privacy controls deterministically and records evidence provenance", () => {
  const result = run();
  assert.equal(result.summary.passed, 2);
  assert.equal(result.summary.failed, 0);
  assert.equal(result.summary.notEvidenced, 0);
  assert.deepEqual(result, run());
  assert.deepEqual(result.controls.map(item => item.evidenceIds.length), [1, 2]);
  assert.ok(Object.isFrozen(result));
  assert.ok(Object.isFrozen(result.controls[0]));
});

test("reports missing and stale evidence as not evidenced without treating controls as passed", () => {
  const result = run({ evidence: evidence.filter(item => item.id !== "ev-retention") });
  assert.equal(result.summary.notEvidenced, 1);
  assert.deepEqual(result.controls.find(item => item.controlId === "privacy-consent")?.missingEvidenceKinds, ["retention_check"]);
});

test("fails controls for failed checks, expired evidence and invalid evidence hashes", () => {
  const failed = run({ evidence: evidence.map(item => item.id === "ev-access" ? { ...item, result: "failed" as const } : item) });
  assert.equal(failed.controls.find(item => item.controlId === "access-review")?.status, "failed");
  const expired = run({ evidence: evidence.map(item => item.id === "ev-access" ? { ...item, validUntil: "2026-11-10T11:00:00.000Z" } : item) });
  assert.equal(expired.controls.find(item => item.controlId === "access-review")?.status, "failed");
  assert.throws(() => run({ evidence: evidence.map(item => item.id === "ev-access" ? { ...item, contentHash: "bad" } : item) }), /COMPLIANCE_EVIDENCE_HASH_INVALID/);
});

test("rejects cross-tenant evidence, unknown control references and duplicate evidence IDs", () => {
  assert.throws(() => run({ evidence: [{ ...evidence[0]!, tenantId: "tenant_b" }] }),
    (error: unknown) => error instanceof ComplianceControlError && error.code === "COMPLIANCE_TENANT_MISMATCH");
  assert.throws(() => run({ evidence: [{ ...evidence[0]!, controlId: "missing" }] }), /COMPLIANCE_CONTROL_NOT_FOUND/);
  assert.throws(() => run({ evidence: [evidence[0]!, evidence[0]!] }), /COMPLIANCE_EVIDENCE_DUPLICATE/);
});

test("enforces privacy basis, independent verification and strict timestamps", () => {
  assert.throws(() => run({ evidence: evidence.map(item => item.id === "ev-consent" ? { ...item, consentId: undefined, verifiedBy: undefined } : item) }),
    /COMPLIANCE_PRIVACY_BASIS_REQUIRED/);
  assert.throws(() => run({ evidence: evidence.map(item => item.id === "ev-access" ? { ...item, verifiedBy: "system" } : item) }),
    /COMPLIANCE_REVIEW_INDEPENDENT_REQUIRED/);
  assert.throws(() => run({ evidence: evidence.map(item => item.id === "ev-access" ? { ...item, capturedAt: "yesterday" } : item) }),
    /COMPLIANCE_TIMESTAMP_INVALID/);
  assert.throws(() => run({ evidence: evidence.map(item => item.id === "ev-access" ? { ...item, capturedAt: "2026-11-10T12:01:00.000Z" } : item) }),
    /COMPLIANCE_TIMESTAMP_FUTURE/);
});

test("rejects invalid controls, period boundaries and unauthorized execution", () => {
  assert.throws(() => run({ controls: [{ ...controls[0]!, requiredEvidenceKinds: [] }] }), /COMPLIANCE_CONTROL_INVALID/);
  assert.throws(() => run({ periodStart: "2026-11-11T00:00:00.000Z" }), /COMPLIANCE_PERIOD_INVALID/);
  assert.throws(() => run({ tenantId: "tenant_b" }), /COMPLIANCE_CONTROL_NOT_FOUND/);
  assert.throws(() => run({ authorize: false } as never), /COMPLIANCE_RUN_UNAUTHORIZED/);
});

test("builds a tamper-evident evidence bundle and requires independent reviewer", () => {
  const result = run();
  const bundle = buildComplianceEvidenceBundle(result, "control_runner", now);
  assert.equal(bundle.controlCount, 2);
  assert.equal(bundle.evidenceCount, 3);
  assert.match(bundle.snapshotHash, /^[a-f0-9]{64}$/);
  assert.deepEqual(bundle, buildComplianceEvidenceBundle(result, "control_runner", now));
  const reviewed = reviewComplianceEvidenceBundle(bundle, "independent_auditor", now);
  assert.equal(reviewed.reviewedBy, "independent_auditor");
  assert.ok(Object.isFrozen(reviewed));
  assert.throws(() => reviewComplianceEvidenceBundle(bundle, "control_runner", now), /COMPLIANCE_REVIEW_INDEPENDENT_REQUIRED/);
});
