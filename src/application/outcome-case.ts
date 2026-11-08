import type { OutcomeSpec, OutcomeResult } from "../outcomes/settlement.ts";
import { calculateOutcome } from "../outcomes/settlement.ts";
import type { Observation } from "../measurement/metrics.ts";
import type { EvidenceRecord } from "../evidence/evidence.ts";
import { verifyEvidence } from "../evidence/evidence.ts";
import type { OutcomeReport } from "../reporting/report.ts";
import { buildOutcomeReport } from "../reporting/report.ts";
import { attributeOutcome } from "../outcomes/attribution.ts";

export type CaseStage = "specified" | "active" | "measured" | "settled" | "disputed";
export interface OutcomeCase {
  readonly id: string;
  readonly tenantId: string;
  readonly stage: CaseStage;
  readonly spec: OutcomeSpec;
  readonly evidence: readonly EvidenceRecord[];
  readonly observations: readonly Observation[];
  readonly attributionData?: { controlBaseline: number; controlObservations: readonly Observation[] };
  readonly result?: OutcomeResult;
  readonly report?: OutcomeReport;
}
export class OutcomeCaseError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message); this.name = "OutcomeCaseError";
  }
}
export function validateOutcomeCase(c: OutcomeCase): string[] {
  const errors: string[] = [];
  if (!c.id || !c.tenantId) errors.push("CASE_ID_TENANT_REQUIRED");
  if (c.stage !== "specified") errors.push("CASE_INITIAL_STAGE_INVALID");
  if (!c.spec?.approvedBy) errors.push("OUTCOME_NOT_APPROVED");
  if (!c.spec?.metric?.id || !c.spec.metric.unit) errors.push("METRIC_DEFINITION_REQUIRED");
  if (!Number.isFinite(c.spec?.baseline) || !Number.isFinite(c.spec?.target)) errors.push("OUTCOME_VALUES_INVALID");
  if (!c.spec?.periodStart || !c.spec?.periodEnd || Date.parse(c.spec.periodEnd) <= Date.parse(c.spec.periodStart)) errors.push("OUTCOME_PERIOD_INVALID");
  if (!Array.isArray(c.evidence) || !Array.isArray(c.observations)) errors.push("CASE_COLLECTIONS_INVALID");
  if (Array.isArray(c.evidence)) {
    const ids = new Set<string>();
    for (const item of c.evidence) {
      if (item.tenantId !== c.tenantId) errors.push("TENANT_MISMATCH");
      if (ids.has(item.id)) errors.push("EVIDENCE_DUPLICATE");
      ids.add(item.id);
    }
  }
  if (Array.isArray(c.observations)) for (const item of c.observations) {
    if (item.metricId !== c.spec.metric.id || item.unit !== c.spec.metric.unit) errors.push("OBSERVATION_METRIC_MISMATCH");
    if (!Number.isFinite(item.value) || !Number.isFinite(item.confidence) || item.confidence < 0 || item.confidence > 1 || Number.isNaN(Date.parse(item.observedAt)) || !item.sourceId) errors.push("OBSERVATION_INVALID");
  }
  return [...new Set(errors)];
}
export function startOutcomeCase(c: OutcomeCase): OutcomeCase {
  if (c.stage !== "specified") throw new OutcomeCaseError("CASE_STAGE_INVALID", "stage");
  if (!c.spec.approvedBy) throw new OutcomeCaseError("OUTCOME_NOT_APPROVED", "spec.approvedBy");
  return Object.freeze({...c, stage:"active"});
}
export function recordOutcomeEvidence(c: OutcomeCase, e: EvidenceRecord, expectedHash: string): OutcomeCase {
  if (c.stage !== "active") throw new OutcomeCaseError("CASE_NOT_ACTIVE", "stage");
  if (e.tenantId !== c.tenantId) throw new OutcomeCaseError("TENANT_MISMATCH", "evidence.tenantId");
  const errors = verifyEvidence(e, expectedHash);
  if (errors.length) throw new OutcomeCaseError(errors[0]!, "evidence");
  if (c.evidence.some(x=>x.id===e.id)) throw new OutcomeCaseError("EVIDENCE_DUPLICATE", "evidence.id");
  return Object.freeze({...c,evidence:Object.freeze([...c.evidence,e])});
}
export function recordObservation(c: OutcomeCase, o: Observation): OutcomeCase {
  if (c.stage !== "active") throw new OutcomeCaseError("CASE_NOT_ACTIVE", "stage");
  if (o.metricId!==c.spec.metric.id || o.unit!==c.spec.metric.unit)
    throw new OutcomeCaseError("OBSERVATION_METRIC_MISMATCH", "observation");
  if (!Number.isFinite(o.value) || !Number.isFinite(o.confidence) || o.confidence < 0 || o.confidence > 1 || !o.sourceId || Number.isNaN(Date.parse(o.observedAt)))
    throw new OutcomeCaseError("OBSERVATION_INVALID", "observation");
  if (c.observations.some(x => x.sourceId === o.sourceId && x.observedAt === o.observedAt && x.metricId === o.metricId))
    throw new OutcomeCaseError("OBSERVATION_DUPLICATE", "observation");
  return Object.freeze({...c,observations:Object.freeze([...c.observations,o])});
}
export function setControlBaseline(c: OutcomeCase, value: number): OutcomeCase {
  if (c.stage !== "active") throw new OutcomeCaseError("CASE_NOT_ACTIVE", "stage");
  if (c.spec.attribution !== "experimental") throw new OutcomeCaseError("CONTROL_GROUP_NOT_DECLARED", "spec.attribution");
  if (!Number.isFinite(value)) throw new OutcomeCaseError("CONTROL_BASELINE_INVALID", "attributionData.controlBaseline");
  return Object.freeze({ ...c, attributionData: { controlBaseline: value, controlObservations: c.attributionData?.controlObservations ?? [] } });
}
export function recordControlObservation(c: OutcomeCase, o: Observation): OutcomeCase {
  if (c.stage !== "active") throw new OutcomeCaseError("CASE_NOT_ACTIVE", "stage");
  if (c.spec.attribution !== "experimental") throw new OutcomeCaseError("CONTROL_GROUP_NOT_DECLARED", "spec.attribution");
  if (!c.attributionData) throw new OutcomeCaseError("CONTROL_BASELINE_REQUIRED", "attributionData.controlBaseline");
  if (o.metricId !== c.spec.metric.id || o.unit !== c.spec.metric.unit) throw new OutcomeCaseError("OBSERVATION_METRIC_MISMATCH", "controlObservation");
  if (!Number.isFinite(o.value) || !Number.isFinite(o.confidence) || o.confidence < 0 || o.confidence > 1 || !o.sourceId || Number.isNaN(Date.parse(o.observedAt))) throw new OutcomeCaseError("OBSERVATION_INVALID", "controlObservation");
  if (c.attributionData.controlObservations.some(x => x.sourceId === o.sourceId && x.observedAt === o.observedAt)) throw new OutcomeCaseError("OBSERVATION_DUPLICATE", "controlObservation");
  return Object.freeze({ ...c, attributionData: { ...c.attributionData, controlObservations: Object.freeze([...c.attributionData.controlObservations, o]) } });
}
export function settleOutcomeCase(c: OutcomeCase, observationIndex: number, methodology: string, reportId: string, now = new Date()): OutcomeCase {
  if (c.stage !== "active") throw new OutcomeCaseError("CASE_NOT_ACTIVE", "stage");
  const observation=c.observations[observationIndex];
  if (!observation) throw new OutcomeCaseError("OBSERVATION_NOT_FOUND", "observationIndex");
  if (!c.evidence.length) throw new OutcomeCaseError("EVIDENCE_REQUIRED", "evidence");
  const controlValues = c.attributionData?.controlObservations ?? [];
  if (c.spec.attribution === "experimental" && (!c.attributionData || !controlValues.length)) throw new OutcomeCaseError("CONTROL_GROUP_REQUIRED", "attributionData");
  const controlObserved = controlValues.length ? controlValues.reduce((sum, item) => sum + item.value, 0) / controlValues.length : undefined;
  const attribution = attributeOutcome({ baseline: c.spec.baseline, observed: observation.value, method: c.spec.attribution, confidence: observation.confidence, ...(c.attributionData ? { controlBaseline: c.attributionData.controlBaseline } : {}), ...(controlObserved !== undefined ? { controlObserved } : {}) });
  const adjustedObservation = { ...observation, value: c.spec.baseline + attribution.adjustedChange };
  const result=Object.freeze({ ...calculateOutcome(c.spec,adjustedObservation), attribution });
  const report=buildOutcomeReport({id:reportId,tenantId:c.tenantId,outcomeId:c.id,result,evidenceIds:c.evidence.map(e=>e.id),methodology,limitations:[]},now);
  return Object.freeze({...c,stage:"settled",result,report});
}
export function disputeOutcomeCase(c: OutcomeCase, reason: string): OutcomeCase {
  if (c.stage!=="settled") throw new OutcomeCaseError("CASE_NOT_SETTLED","stage");
  if (!reason.trim()) throw new OutcomeCaseError("DISPUTE_REASON_REQUIRED","reason");
  return Object.freeze({...c,stage:"disputed"});
}
