export interface EvidenceRecord{id:string;tenantId:string;sourceId:string;capturedAt:string;contentHash:string;classification:"public"|"internal"|"confidential"|"personal";validUntil?:string;verifiedBy?:string;verifiedAt?:string}export function verifyEvidence(e:EvidenceRecord,expectedHash:string,now=new Date()):string[]{const errors:string[]=[];if(!e.sourceId||!e.contentHash)errors.push("PROVENANCE_REQUIRED");if(e.contentHash!==expectedHash)errors.push("EVIDENCE_HASH_MISMATCH");if(e.validUntil&&Date.parse(e.validUntil)<=now.getTime())errors.push("EVIDENCE_EXPIRED");return errors}export function verifyEvidenceApproval(e:EvidenceRecord,actor:string,at=new Date()):EvidenceRecord{if(!actor)throw new Error("EVIDENCE_VERIFIER_REQUIRED");return Object.freeze({...e,verifiedBy:actor,verifiedAt:at.toISOString()})}
export interface EvidenceAccessContext { tenantId: string; actorId: string; purpose: string; allowedClassifications: readonly EvidenceRecord["classification"][] }
export function verifyEvidenceAccess(e: EvidenceRecord, context: EvidenceAccessContext, now=new Date()): string[] {
  const errors: string[] = [];
  if (!context.tenantId || e.tenantId !== context.tenantId) errors.push("TENANT_MISMATCH");
  if (!context.actorId) errors.push("EVIDENCE_ACTOR_REQUIRED");
  if (!context.purpose.trim()) errors.push("EVIDENCE_PURPOSE_REQUIRED");
  if (!context.allowedClassifications.includes(e.classification)) errors.push("EVIDENCE_CLASSIFICATION_FORBIDDEN");
  if (e.validUntil && Date.parse(e.validUntil) <= now.getTime()) errors.push("EVIDENCE_EXPIRED");
  if ((e.classification === "confidential" || e.classification === "personal") && !e.verifiedBy) errors.push("EVIDENCE_VERIFICATION_REQUIRED");
  return errors;
}
