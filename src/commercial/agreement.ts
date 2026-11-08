export type FeeKind="fixed"|"usage"|"milestone"|"outcome";export interface FeeComponent{id:string;kind:FeeKind;currency:string;amount?:number;rate?:number;cap?:number;floor?:number;metricId?:string}export interface AgreementSignature{signerId:string;signatureHash:string;provider:string;signedAt:string;verificationReference:string}export interface Agreement{id:string;tenantId:string;version:number;status:"draft"|"pending_approval"|"active"|"completed"|"disputed"|"cancelled";scope:string[];deliverables:string[];exclusions:string[];fees:FeeComponent[];approvedBy?:string;acceptedAt?:string;signatures?:readonly AgreementSignature[]}export function validateAgreement(a:Agreement):string[]{const e:string[]=[];if(!a.tenantId)e.push("tenantId:REQUIRED");if(!a.scope.length)e.push("scope:REQUIRED");if(!a.deliverables.length)e.push("deliverables:REQUIRED");for(const f of a.fees){if(!f.currency)e.push(`fees.${f.id}.currency:REQUIRED`);if(f.kind==="outcome"&&!f.metricId)e.push(`fees.${f.id}.metricId:REQUIRED`);if(f.amount!==undefined&&f.amount<0)e.push(`fees.${f.id}.amount:NEGATIVE`)}return e}export function acceptAgreement(a:Agreement,actor:string,at=new Date()):Agreement{if(validateAgreement(a).length)throw new Error("AGREEMENT_INVALID");if(!actor)throw new Error("AGREEMENT_ACCEPTOR_REQUIRED");return Object.freeze({...a,status:"active",approvedBy:actor,acceptedAt:at.toISOString()})}
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
