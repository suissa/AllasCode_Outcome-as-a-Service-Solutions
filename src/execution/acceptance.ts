export interface AcceptanceCheck{id:string;description:string;required:boolean;passed:boolean;evidenceIds:string[]}
export interface DeliverableAcceptance{deliverableId:string;checks:AcceptanceCheck[];accepted:boolean;reviewerId?:string;reviewedAt?:string;issues?:readonly string[]}
export function validateAcceptanceContract(d:Omit<DeliverableAcceptance,"accepted">):string[]{
 const errors:string[]=[];if(!d.deliverableId.trim())errors.push("DELIVERABLE_ID_REQUIRED");if(!d.checks.length)errors.push("ACCEPTANCE_CHECKS_REQUIRED");
 const ids=new Set<string>();for(const check of d.checks){if(!check.id||ids.has(check.id))errors.push("ACCEPTANCE_CHECK_ID_INVALID");ids.add(check.id);if(!check.description.trim())errors.push("ACCEPTANCE_CHECK_DESCRIPTION_REQUIRED");if(check.required&&check.passed&&!check.evidenceIds.length)errors.push("ACCEPTANCE_EVIDENCE_REQUIRED:"+check.id);if(new Set(check.evidenceIds).size!==check.evidenceIds.length)errors.push("ACCEPTANCE_EVIDENCE_DUPLICATE:"+check.id);}
 return [...new Set(errors)];
}
export function evaluateAcceptance(d:Omit<DeliverableAcceptance,"accepted">):DeliverableAcceptance{
 const issues=validateAcceptanceContract(d);const accepted=issues.length===0&&d.checks.every(c=>!c.required||c.passed&&c.evidenceIds.length>0);
 return Object.freeze({...d,accepted,issues:Object.freeze(issues)});
}
export function reviewAcceptance(d:DeliverableAcceptance,reviewer:string,approved:boolean,at=new Date()):DeliverableAcceptance{
 if(!reviewer)throw new Error("ACCEPTANCE_REVIEWER_REQUIRED");
 if(d.issues?.length||!d.checks.length)throw new Error("ACCEPTANCE_CONTRACT_INVALID");
 if(approved&&!d.accepted)throw new Error("DELIVERABLE_NOT_ACCEPTABLE");
 return Object.freeze({...d,accepted:approved&&d.accepted,reviewerId:reviewer,reviewedAt:at.toISOString()});
}
