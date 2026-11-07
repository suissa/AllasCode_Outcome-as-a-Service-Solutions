import type { OutcomeSpec, OutcomeResult } from "../outcomes/settlement.ts";
import { calculateOutcome } from "../outcomes/settlement.ts";
import type { Observation } from "../measurement/metrics.ts";
import type { EvidenceRecord } from "../evidence/evidence.ts";
import { verifyEvidence } from "../evidence/evidence.ts";
import type { OutcomeReport } from "../reporting/report.ts";
import { buildOutcomeReport } from "../reporting/report.ts";

export type CaseStage = "specified" | "active" | "measured" | "settled" | "disputed";
export interface OutcomeCase {
  readonly id: string;
  readonly tenantId: string;
  readonly stage: CaseStage;
  readonly spec: OutcomeSpec;
  readonly evidence: readonly EvidenceRecord[];
  readonly observations: readonly Observation[];
  readonly result?: OutcomeResult;
  readonly report?: OutcomeReport;
}
export class OutcomeCaseError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message); this.name = "OutcomeCaseError";
  }
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
  return Object.freeze({...c,observations:Object.freeze([...c.observations,o])});
}
export function settleOutcomeCase(c: OutcomeCase, observationIndex: number, methodology: string, reportId: string, now = new Date()): OutcomeCase {
  if (c.stage !== "active") throw new OutcomeCaseError("CASE_NOT_ACTIVE", "stage");
  const observation=c.observations[observationIndex];
  if (!observation) throw new OutcomeCaseError("OBSERVATION_NOT_FOUND", "observationIndex");
  if (!c.evidence.length) throw new OutcomeCaseError("EVIDENCE_REQUIRED", "evidence");
  const result=calculateOutcome(c.spec,observation);
  const report=buildOutcomeReport({id:reportId,tenantId:c.tenantId,outcomeId:c.id,result,evidenceIds:c.evidence.map(e=>e.id),methodology,limitations:[]},now);
  return Object.freeze({...c,stage:"settled",result,report});
}
export function disputeOutcomeCase(c: OutcomeCase, reason: string): OutcomeCase {
  if (c.stage!=="settled") throw new OutcomeCaseError("CASE_NOT_SETTLED","stage");
  if (!reason.trim()) throw new OutcomeCaseError("DISPUTE_REASON_REQUIRED","reason");
  return Object.freeze({...c,stage:"disputed"});
}
