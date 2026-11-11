export interface DiagnosisFinding {
 id:string; tenantId:string; statement:string;
 category:"process"|"technology"|"people"|"data"|"policy";
 evidenceIds:string[]; confidence:number; impact:"low"|"medium"|"high";
 constraints:string[]; owner?:string;
}
const categories=["process","technology","people","data","policy"];
const impacts=["low","medium","high"];
export function validateFinding(f:DiagnosisFinding):string[]{
 const errors:string[]=[];
 if(typeof f.id!=="string"||!f.id.trim())errors.push("id:REQUIRED");
 if(typeof f.tenantId!=="string"||!f.tenantId.trim())errors.push("tenantId:REQUIRED");
 if(typeof f.statement!=="string"||!f.statement.trim())errors.push("statement:REQUIRED");
 if(!categories.includes(f.category))errors.push("category:INVALID");
 if(!Array.isArray(f.evidenceIds)||!f.evidenceIds.length||f.evidenceIds.some(id=>typeof id!=="string"||!id.trim()))errors.push("evidenceIds:REQUIRED");
 else if(new Set(f.evidenceIds).size!==f.evidenceIds.length)errors.push("evidenceIds:DUPLICATE");
 if(!Number.isFinite(f.confidence)||f.confidence<0||f.confidence>1)errors.push("confidence:OUT_OF_RANGE");
 if(!impacts.includes(f.impact))errors.push("impact:INVALID");
 if(!Array.isArray(f.constraints)||f.constraints.some(value=>typeof value!=="string"||!value.trim()))errors.push("constraints:INVALID");
 if(f.owner!==undefined&&(typeof f.owner!=="string"||!f.owner.trim()))errors.push("owner:INVALID");
 return errors;
}
export interface RootCauseAnalysis {
 tenantId:string; problem:string; findings:DiagnosisFinding[];
 alternativesConsidered:string[]; validatedBy?:string; validatedAt?:string;
}
export function validateRootCause(a:RootCauseAnalysis):string[]{
 const errors:string[]=[];
 if(typeof a.tenantId!=="string"||!a.tenantId.trim())errors.push("tenantId:REQUIRED");
 if(typeof a.problem!=="string"||!a.problem.trim())errors.push("problem:REQUIRED");
 if(!Array.isArray(a.findings)||!a.findings.length)errors.push("findings:REQUIRED");
 else {
  a.findings.forEach((finding,index)=>{if(validateFinding(finding).length)errors.push(`findings[${index}]:INVALID`);});
  if(a.findings.some(f=>f.tenantId!==a.tenantId))errors.push("findings:TENANT_MISMATCH");
  const ids=a.findings.map(f=>f.id);if(new Set(ids).size!==ids.length)errors.push("findings:DUPLICATE_ID");
 }
 if(!Array.isArray(a.alternativesConsidered)||!a.alternativesConsidered.length||a.alternativesConsidered.some(value=>typeof value!=="string"||!value.trim()))errors.push("alternativesConsidered:REQUIRED");
 else if(new Set(a.alternativesConsidered).size!==a.alternativesConsidered.length)errors.push("alternativesConsidered:DUPLICATE");
 return errors;
}
export function validateRootCauseApproval(a:RootCauseAnalysis,actor:string,at=new Date()):RootCauseAnalysis{
 const errors=validateRootCause(a);if(errors.length)throw new Error("ROOT_CAUSE_INVALID:"+errors.join(","));
 if(typeof actor!=="string"||!actor.trim())throw new Error("ROOT_CAUSE_APPROVER_REQUIRED");
 if(a.findings.some(f=>f.owner===actor))throw new Error("ROOT_CAUSE_APPROVER_NOT_INDEPENDENT");
 if(!Number.isFinite(at.getTime()))throw new Error("ROOT_CAUSE_APPROVAL_TIME_INVALID");
 return Object.freeze({...a,findings:Object.freeze([...a.findings]) as unknown as DiagnosisFinding[],alternativesConsidered:Object.freeze([...a.alternativesConsidered]) as unknown as string[],validatedBy:actor,validatedAt:at.toISOString()});
}
