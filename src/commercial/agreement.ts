export type FeeKind="fixed"|"usage"|"milestone"|"outcome";export interface FeeComponent{id:string;kind:FeeKind;currency:string;amount?:number;rate?:number;cap?:number;floor?:number;metricId?:string}export interface AgreementSignature{signerId:string;signatureHash:string;provider:string;signedAt:string;verificationReference:string}export interface Agreement{id:string;tenantId:string;version:number;status:"draft"|"pending_approval"|"active"|"completed"|"disputed"|"cancelled";scope:string[];deliverables:string[];exclusions:string[];fees:FeeComponent[];approvedBy?:string;acceptedAt?:string;signatures?:readonly AgreementSignature[];sourceDecisionId?:string;sourceScenarioId?:string;decisionRationale?:string;evidenceIds?:readonly string[]}export function validateAgreement(a:Agreement):string[]{const e:string[]=[];if(!a.tenantId)e.push("tenantId:REQUIRED");if(!a.scope.length)e.push("scope:REQUIRED");if(!a.deliverables.length)e.push("deliverables:REQUIRED");for(const f of a.fees){if(!f.currency)e.push(`fees.${f.id}.currency:REQUIRED`);if(f.kind==="outcome"&&!f.metricId)e.push(`fees.${f.id}.metricId:REQUIRED`);if(f.amount!==undefined&&f.amount<0)e.push(`fees.${f.id}.amount:NEGATIVE`)}return e}export function acceptAgreement(a:Agreement,actor:string,at=new Date()):Agreement{if(validateAgreement(a).length)throw new Error("AGREEMENT_INVALID");if(!actor)throw new Error("AGREEMENT_ACCEPTOR_REQUIRED");return Object.freeze({...a,status:"active",approvedBy:actor,acceptedAt:at.toISOString()})}
export type SignatureVerifier = (signature: AgreementSignature, agreement: Agreement) => boolean | Promise<boolean>;
export async function recordAgreementSignature(a: Agreement, signature: AgreementSignature, verify: SignatureVerifier): Promise<Agreement> {
  if (a.status !== "draft" && a.status !== "pending_approval") throw new Error("AGREEMENT_NOT_SIGNABLE");
  if (!signature.signerId || !signature.signatureHash || !signature.provider || !signature.verificationReference || Number.isNaN(Date.parse(signature.signedAt))) throw new Error("AGREEMENT_SIGNATURE_INVALID");
  if ((a.signatures ?? []).some(s => s.signerId === signature.signerId)) throw new Error("AGREEMENT_SIGNER_DUPLICATE");
  if (!(await verify(signature, a))) throw new Error("AGREEMENT_SIGNATURE_UNVERIFIED");
  return Object.freeze({ ...a, status:"pending_approval", signatures:Object.freeze([...(a.signatures ?? []), Object.freeze(signature)]) });
}
export function activateSignedAgreement(a: Agreement, requiredSigners: readonly string[], at=new Date()): Agreement {
  const signed = new Set((a.signatures ?? []).map(s => s.signerId));
  if (!requiredSigners.length || requiredSigners.some(id => !signed.has(id))) throw new Error("AGREEMENT_SIGNATURES_INCOMPLETE");
  if (validateAgreement(a).length) throw new Error("AGREEMENT_INVALID");
  return Object.freeze({ ...a, status:"active", approvedBy:requiredSigners.join(","), acceptedAt:at.toISOString() });
}

import type { SolutionDecision } from "../solutions/decision.ts";
export interface AgreementProposalInput {
  id:string; version:number; decision:SolutionDecision; scenarioId:string;
  scope:readonly string[]; deliverables:readonly string[]; exclusions:readonly string[]; fees:readonly FeeComponent[];
}
export function createAgreementProposal(input:AgreementProposalInput):Agreement {
  if(input.decision.status!=="selected"||input.decision.selectedScenarioId!==input.scenarioId)throw new Error("PROPOSAL_DECISION_MISMATCH");
  if(!input.decision.tenantId||!input.decision.evidenceIds.length)throw new Error("PROPOSAL_EVIDENCE_REQUIRED");
  const proposal:Agreement={
    id:input.id,tenantId:input.decision.tenantId,version:input.version,status:"draft",
    scope:[...input.scope],deliverables:[...input.deliverables],exclusions:[...input.exclusions],fees:[...input.fees],
    sourceDecisionId:input.decision.id,sourceScenarioId:input.scenarioId,
    decisionRationale:input.decision.rationale,evidenceIds:[...input.decision.evidenceIds],
  };
  const errors=validateAgreement(proposal);
  if(errors.length)throw new Error("PROPOSAL_INVALID:"+errors.join(","));
  return Object.freeze({...proposal,scope:Object.freeze(proposal.scope),deliverables:Object.freeze(proposal.deliverables),exclusions:Object.freeze(proposal.exclusions),fees:Object.freeze(proposal.fees),evidenceIds:Object.freeze([...(proposal.evidenceIds??[])])});
}
