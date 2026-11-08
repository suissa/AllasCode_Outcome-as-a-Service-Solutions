export interface AccessGrant{actorId:string;tenantId:string;resourceId:string;permissions:string[];grantedBy:string;grantedAt:string;expiresAt?:string}export function reviewAccess(g:AccessGrant,now=new Date()):{valid:boolean;expired:boolean;leastPrivilege:boolean}{const expired=!!g.expiresAt&&Date.parse(g.expiresAt)<=now.getTime();return{valid:!!g.actorId&&!!g.tenantId&&!expired,expired,leastPrivilege:g.permissions.length>0&&g.permissions.every(p=>["read","create","update","delete","approve","execute"].includes(p))}}
export interface AccessReviewDecision { grant: AccessGrant; reviewerId: string; decision: "retain"|"revoke"; reason: string; reviewedAt: string }
export function decideAccessReview(g: AccessGrant, reviewerId: string, decision: "retain"|"revoke", reason: string, at=new Date()): AccessReviewDecision {
  if (!reviewerId || !reason.trim()) throw new Error("ACCESS_REVIEW_METADATA_REQUIRED");
  if (reviewerId === g.actorId) throw new Error("ACCESS_REVIEW_INDEPENDENT_REQUIRED");
  if (decision === "retain" && !reviewAccess(g, at).valid) throw new Error("ACCESS_GRANT_INVALID");
  return Object.freeze({ grant: decision === "revoke" ? Object.freeze({ ...g, permissions: [] }) : g, reviewerId, decision, reason, reviewedAt: at.toISOString() });
}
