import { createHash } from "node:crypto";

export class ComplianceControlError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "ComplianceControlError";
  }
}

export type ComplianceCategory = "access" | "privacy" | "retention" | "secrets" | "encryption" | "audit" | "governance";
export type EvidenceClassification = "public" | "internal" | "confidential" | "personal" | "sensitive";

export interface ComplianceControl {
  id: string;
  tenantId: string;
  name: string;
  category: ComplianceCategory;
  requiredEvidenceKinds: readonly string[];
  minimumEvidencePerKind: number;
  maxEvidenceAgeSeconds: number;
  severity: "low" | "medium" | "high" | "critical";
  enabled: boolean;
}

export interface ControlEvidenceObservation {
  id: string;
  tenantId: string;
  controlId: string;
  kind: string;
  sourceId: string;
  capturedAt: string;
  contentHash: string;
  classification: EvidenceClassification;
  result: "passed" | "failed";
  validUntil?: string;
  consentId?: string;
  legalBasis?: string;
  preparedBy?: string;
  verifiedBy?: string;
}

export interface ComplianceControlResult {
  runId: string;
  controlId: string;
  category: ComplianceCategory;
  severity: ComplianceControl["severity"];
  status: "passed" | "failed" | "not_evidenced" | "not_applicable";
  evidenceIds: readonly string[];
  missingEvidenceKinds: readonly string[];
  staleEvidenceIds: readonly string[];
  failedEvidenceIds: readonly string[];
  executedAt: string;
}

export interface ComplianceRunResult {
  tenantId: string;
  actorId: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  controls: readonly ComplianceControlResult[];
  summary: Readonly<{ passed: number; failed: number; notEvidenced: number; notApplicable: number }>;
}

export interface ComplianceEvidenceBundle {
  id: string;
  tenantId: string;
  preparedBy: string;
  periodStart: string;
  periodEnd: string;
  generatedAt: string;
  controlCount: number;
  evidenceCount: number;
  controls: readonly ComplianceControlResult[];
  snapshotHash: string;
  reviewedBy?: string;
  reviewedAt?: string;
}

const required = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 256;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function fail(code: string, path: string): never {
  throw new ComplianceControlError(code, path);
}

function snapshotHash(value: unknown): string {
  const normalize = (item: unknown): unknown => {
    if (item === null || typeof item === "string" || typeof item === "boolean") return item;
    if (typeof item === "number") {
      if (!Number.isFinite(item)) fail("COMPLIANCE_SNAPSHOT_INVALID", "snapshot");
      return item;
    }
    if (Array.isArray(item)) return item.map(normalize);
    if (item && typeof item === "object") {
      const output: Record<string, unknown> = {};
      for (const key of Object.keys(item as Record<string, unknown>).sort()) {
        const child = (item as Record<string, unknown>)[key];
        if (child === undefined) fail("COMPLIANCE_SNAPSHOT_INVALID", key);
        output[key] = normalize(child);
      }
      return output;
    }
    fail("COMPLIANCE_SNAPSHOT_INVALID", "snapshot");
  };
  return createHash("sha256").update(JSON.stringify(normalize(value)), "utf8").digest("hex");
}

function validateControl(control: ComplianceControl, tenantId: string, path: string): void {
  if (!control || !required(control.id) || !required(control.name) ||
      !["access", "privacy", "retention", "secrets", "encryption", "audit", "governance"].includes(control.category) ||
      !["low", "medium", "high", "critical"].includes(control.severity) ||
      !Array.isArray(control.requiredEvidenceKinds) || control.requiredEvidenceKinds.length === 0 ||
      control.requiredEvidenceKinds.some(kind => !required(kind)) ||
      new Set(control.requiredEvidenceKinds).size !== control.requiredEvidenceKinds.length ||
      !Number.isInteger(control.minimumEvidencePerKind) || control.minimumEvidencePerKind < 1 || control.minimumEvidencePerKind > 1000 ||
      !Number.isInteger(control.maxEvidenceAgeSeconds) || control.maxEvidenceAgeSeconds < 1 ||
      typeof control.enabled !== "boolean") {
    fail("COMPLIANCE_CONTROL_INVALID", path);
  }
  if (control.tenantId !== tenantId) fail("COMPLIANCE_TENANT_MISMATCH", `${path}.tenantId`);
}

export function runSecurityPrivacyControls(
  input: {
    tenantId: string;
    actorId: string;
    periodStart: string;
    periodEnd: string;
    controls: readonly ComplianceControl[];
    evidence: readonly ControlEvidenceObservation[];
    now?: Date;
  },
  authorize: (actorId: string, tenantId: string) => boolean,
): Readonly<ComplianceRunResult> {
  if (!input || !required(input.tenantId) || !required(input.actorId) ||
      !validTimestamp(input.periodStart) || !validTimestamp(input.periodEnd) ||
      !Array.isArray(input.controls) || !Array.isArray(input.evidence)) {
    fail("COMPLIANCE_RUN_INPUT_INVALID", "input");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("COMPLIANCE_CLOCK_INVALID", "now");
  if (Date.parse(input.periodStart) > Date.parse(input.periodEnd) ||
      Date.parse(input.periodEnd) > now.getTime()) fail("COMPLIANCE_PERIOD_INVALID", "period");
  if (!authorize(input.actorId, input.tenantId)) fail("COMPLIANCE_RUN_UNAUTHORIZED", "actorId");

  const controlById = new Map<string, ComplianceControl>();
  for (let index = 0; index < input.controls.length; index += 1) {
    const control = input.controls[index]!;
    validateControl(control, input.tenantId, `controls[${index}]`);
    if (controlById.has(control.id)) fail("COMPLIANCE_CONTROL_DUPLICATE", `controls[${index}].id`);
    controlById.set(control.id, control);
  }

  const evidenceByControl = new Map<string, ControlEvidenceObservation[]>();
  const evidenceIds = new Set<string>();
  for (let index = 0; index < input.evidence.length; index += 1) {
    const item = input.evidence[index]!;
    const path = `evidence[${index}]`;
    if (!item || !required(item.id) || !required(item.controlId) || !required(item.kind) ||
        !required(item.sourceId) || !/^[a-f0-9]{64}$/i.test(item.contentHash) ||
        !["public", "internal", "confidential", "personal", "sensitive"].includes(item.classification) ||
        !["passed", "failed"].includes(item.result)) {
      fail("COMPLIANCE_EVIDENCE_INVALID", path);
    }
    if (item.tenantId !== input.tenantId) fail("COMPLIANCE_TENANT_MISMATCH", `${path}.tenantId`);
    if (evidenceIds.has(item.id)) fail("COMPLIANCE_EVIDENCE_DUPLICATE", `${path}.id`);
    evidenceIds.add(item.id);
    const control = controlById.get(item.controlId);
    if (!control) fail("COMPLIANCE_CONTROL_NOT_FOUND", `${path}.controlId`);
    if (!control.requiredEvidenceKinds.includes(item.kind)) fail("COMPLIANCE_EVIDENCE_KIND_UNEXPECTED", `${path}.kind`);
    if (!validTimestamp(item.capturedAt)) fail("COMPLIANCE_TIMESTAMP_INVALID", `${path}.capturedAt`);
    const capturedAt = Date.parse(item.capturedAt);
    if (capturedAt > now.getTime()) fail("COMPLIANCE_TIMESTAMP_FUTURE", `${path}.capturedAt`);
    if (capturedAt < Date.parse(input.periodStart) || capturedAt > Date.parse(input.periodEnd)) {
      fail("COMPLIANCE_EVIDENCE_OUTSIDE_PERIOD", `${path}.capturedAt`);
    }
    if (item.validUntil !== undefined && !validTimestamp(item.validUntil)) fail("COMPLIANCE_TIMESTAMP_INVALID", `${path}.validUntil`);
    if ((item.classification === "personal" || item.classification === "sensitive") &&
        (!required(item.consentId) && !required(item.legalBasis))) {
      fail("COMPLIANCE_PRIVACY_BASIS_REQUIRED", `${path}.consentId/legalBasis`);
    }
    if ((item.classification === "confidential" || item.classification === "personal" || item.classification === "sensitive") && !required(item.verifiedBy)) {
      fail("COMPLIANCE_PRIVACY_VERIFICATION_REQUIRED", `${path}.verifiedBy`);
    }
    if (item.verifiedBy !== undefined && (!required(item.verifiedBy) || item.verifiedBy === item.preparedBy)) {
      fail("COMPLIANCE_REVIEW_INDEPENDENT_REQUIRED", `${path}.verifiedBy`);
    }
    const list = evidenceByControl.get(item.controlId) ?? [];
    list.push(item);
    evidenceByControl.set(item.controlId, list);
  }

  const controls: ComplianceControlResult[] = [];
  for (const control of [...controlById.values()].sort((a, b) => a.id.localeCompare(b.id))) {
    const runId = `control-run:${encodeURIComponent(input.tenantId)}:${encodeURIComponent(control.id)}:${encodeURIComponent(input.periodEnd)}`;
    if (!control.enabled) {
      controls.push(Object.freeze({
        runId, controlId: control.id, category: control.category, severity: control.severity,
        status: "not_applicable", evidenceIds: Object.freeze([]), missingEvidenceKinds: Object.freeze([]),
        staleEvidenceIds: Object.freeze([]), failedEvidenceIds: Object.freeze([]), executedAt: now.toISOString(),
      }));
      continue;
    }
    const related = evidenceByControl.get(control.id) ?? [];
    const missing: string[] = [];
    const stale: string[] = [];
    const failed: string[] = [];
    for (const kind of control.requiredEvidenceKinds) {
      const matching = related.filter(item => item.kind === kind);
      if (matching.length < control.minimumEvidencePerKind) missing.push(kind);
      for (const item of matching) {
        if (Date.parse(item.capturedAt) < now.getTime() - control.maxEvidenceAgeSeconds * 1000 ||
            (item.validUntil !== undefined && Date.parse(item.validUntil) <= now.getTime())) stale.push(item.id);
        if (item.result === "failed") failed.push(item.id);
      }
    }
    const status = failed.length || stale.length ? "failed" : missing.length ? "not_evidenced" : "passed";
    controls.push(Object.freeze({
      runId, controlId: control.id, category: control.category, severity: control.severity, status,
      evidenceIds: Object.freeze(related.map(item => item.id).sort()),
      missingEvidenceKinds: Object.freeze(missing.sort()),
      staleEvidenceIds: Object.freeze(stale.sort()),
      failedEvidenceIds: Object.freeze(failed.sort()),
      executedAt: now.toISOString(),
    }));
  }

  const summary = {
    passed: controls.filter(item => item.status === "passed").length,
    failed: controls.filter(item => item.status === "failed").length,
    notEvidenced: controls.filter(item => item.status === "not_evidenced").length,
    notApplicable: controls.filter(item => item.status === "not_applicable").length,
  };
  return Object.freeze({
    tenantId: input.tenantId, actorId: input.actorId, periodStart: input.periodStart, periodEnd: input.periodEnd,
    generatedAt: now.toISOString(), controls: Object.freeze(controls), summary: Object.freeze(summary),
  });
}

export function buildComplianceEvidenceBundle(
  run: ComplianceRunResult,
  preparedBy: string,
  now = new Date(),
): Readonly<ComplianceEvidenceBundle> {
  if (!run || !required(run.tenantId) || !required(run.actorId) || !required(preparedBy) ||
      !validTimestamp(run.periodStart) || !validTimestamp(run.periodEnd) ||
      !validTimestamp(run.generatedAt) || !Array.isArray(run.controls) ||
      !Number.isFinite(now.getTime()) || now.getTime() < Date.parse(run.generatedAt)) {
    fail("COMPLIANCE_BUNDLE_INVALID", "run");
  }
  const controls = Object.freeze(run.controls.map(item => Object.freeze({
    ...item,
    evidenceIds: Object.freeze([...item.evidenceIds]),
    missingEvidenceKinds: Object.freeze([...item.missingEvidenceKinds]),
    staleEvidenceIds: Object.freeze([...item.staleEvidenceIds]),
    failedEvidenceIds: Object.freeze([...item.failedEvidenceIds]),
  })));
  const payload = {
    tenantId: run.tenantId, preparedBy, periodStart: run.periodStart, periodEnd: run.periodEnd,
    generatedAt: now.toISOString(), controls,
  };
  const hash = snapshotHash(payload);
  return Object.freeze({
    id: `compliance-bundle:${encodeURIComponent(run.tenantId)}:${encodeURIComponent(run.periodEnd)}`,
    ...payload,
    controlCount: controls.length,
    evidenceCount: new Set(controls.flatMap(item => item.evidenceIds)).size,
    controls,
    snapshotHash: hash,
  });
}

export function reviewComplianceEvidenceBundle(
  bundle: ComplianceEvidenceBundle,
  reviewerId: string,
  now = new Date(),
): Readonly<ComplianceEvidenceBundle> {
  if (!bundle || !required(bundle.id) || !required(bundle.tenantId) || !required(bundle.preparedBy) ||
      !/^[a-f0-9]{64}$/i.test(bundle.snapshotHash) || !Number.isFinite(now.getTime()) ||
      now.getTime() < Date.parse(bundle.generatedAt)) {
    fail("COMPLIANCE_BUNDLE_INVALID", "bundle");
  }
  if (!required(reviewerId)) fail("COMPLIANCE_REVIEWER_REQUIRED", "reviewerId");
  if (reviewerId === bundle.preparedBy) fail("COMPLIANCE_REVIEW_INDEPENDENT_REQUIRED", "reviewerId");
  const expectedHash = snapshotHash({
    tenantId: bundle.tenantId, preparedBy: bundle.preparedBy, periodStart: bundle.periodStart,
    periodEnd: bundle.periodEnd, generatedAt: bundle.generatedAt, controls: bundle.controls,
  });
  if (expectedHash !== bundle.snapshotHash) fail("COMPLIANCE_BUNDLE_HASH_MISMATCH", "snapshotHash");
  return Object.freeze({ ...bundle, reviewedBy: reviewerId, reviewedAt: now.toISOString() });
}
