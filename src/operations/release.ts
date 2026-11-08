export type ReleaseStatus="draft"|"approved"|"deploying"|"deployed"|"failed"|"rolled_back";
export interface ReleaseCandidate {
 id:string;version:string;previousVersion:string;commitSha:string;createdBy:string;status:ReleaseStatus;
 migrationIds:readonly string[];featureFlags:readonly string[];rollbackPlan:readonly string[];
 checks:{ciPassed:boolean;securityPassed:boolean;migrationsVerified:boolean};
 approvedBy?:string;deployedAt?:string;failureCode?:string;rolledBackBy?:string;rolledBackAt?:string;
}
export function createReleaseCandidate(input:Omit<ReleaseCandidate,"status">):ReleaseCandidate{
 if(!input.id||!/^\d+\.\d+\.\d+(?:-[a-z0-9.]+)?$/i.test(input.version)||!input.previousVersion||!/^([a-f0-9]{40}|[a-f0-9]{64})$/i.test(input.commitSha)||!input.createdBy)throw new Error("RELEASE_MANIFEST_INVALID");
 if(!input.migrationIds.length||new Set(input.migrationIds).size!==input.migrationIds.length||!input.rollbackPlan.length)throw new Error("RELEASE_ROLLBACK_PLAN_REQUIRED");
 return Object.freeze({...input,status:"draft"});
}
export function approveRelease(r:ReleaseCandidate,actor:string):ReleaseCandidate{
 if(r.status!=="draft"||!actor||actor===r.createdBy)throw new Error("RELEASE_APPROVAL_INVALID");
 if(!r.checks.ciPassed||!r.checks.securityPassed||!r.checks.migrationsVerified)throw new Error("RELEASE_GATES_FAILED");
 return Object.freeze({...r,status:"approved",approvedBy:actor});
}
export function startRelease(r:ReleaseCandidate):ReleaseCandidate{
 if(r.status!=="approved"||!r.approvedBy)throw new Error("RELEASE_NOT_APPROVED");
 return Object.freeze({...r,status:"deploying"});
}
export function completeRelease(r:ReleaseCandidate,at=new Date()):ReleaseCandidate{
 if(r.status!=="deploying")throw new Error("RELEASE_NOT_DEPLOYING");
 return Object.freeze({...r,status:"deployed",deployedAt:at.toISOString()});
}
export function failRelease(r:ReleaseCandidate,code:string):ReleaseCandidate{
 if(r.status!=="deploying"||!code.trim())throw new Error("RELEASE_FAILURE_INVALID");
 return Object.freeze({...r,status:"failed",failureCode:code});
}
export function rollbackRelease(r:ReleaseCandidate,actor:string,at=new Date()):ReleaseCandidate{
 if(r.status!=="deployed"&&r.status!=="failed")throw new Error("RELEASE_NOT_ROLLBACKABLE");
 if(!actor||actor===r.createdBy||actor===r.approvedBy)throw new Error("RELEASE_ROLLBACK_APPROVAL_INVALID");
 return Object.freeze({...r,status:"rolled_back",rolledBackBy:actor,rolledBackAt:at.toISOString()});
}
