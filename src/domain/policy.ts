export interface Policy<T=unknown>{id:string;version:number;name:string;effectiveAt:string;rules:T;approvedBy?:string;approvedAt?:string} export function approvePolicy<T>(p:Policy<T>,actorId:string,at=new Date()):Policy<T>{if(!actorId)throw new Error("POLICY_APPROVER_REQUIRED");if(p.approvedAt)throw new Error("POLICY_ALREADY_APPROVED");return Object.freeze({...p,approvedBy:actorId,approvedAt:at.toISOString()})} export function assertPolicyEffective(p:Policy,at=new Date()):void{if(!p.approvedAt||Date.parse(p.effectiveAt)>at.getTime())throw new Error("POLICY_NOT_EFFECTIVE")}
export class PolicyRegistry<T=unknown> {
  private readonly versions=new Map<string,Policy<T>[]>();
  register(tenantId:string,policy:Policy<T>):Policy<T>{
    if(!tenantId||!policy.id||policy.version!==1)throw new Error("POLICY_INITIAL_VERSION_INVALID");
    const key=tenantId+":"+policy.id;if(this.versions.has(key))throw new Error("POLICY_ALREADY_REGISTERED");
    const saved=Object.freeze({...policy});this.versions.set(key,[saved]);return saved;
  }
  propose(tenantId:string,policy:Policy<T>):Policy<T>{
    const key=tenantId+":"+policy.id;const versions=this.versions.get(key);if(!versions)throw new Error("POLICY_NOT_FOUND");
    const latest=versions[versions.length-1]!;
    if(policy.version!==latest.version+1)throw new Error("POLICY_VERSION_CONFLICT");
    if(policy.approvedAt||policy.approvedBy)throw new Error("POLICY_PROPOSAL_MUST_BE_UNAPPROVED");
    const saved=Object.freeze({...policy});this.versions.set(key,[...versions,saved]);return saved;
  }
  approve(tenantId:string,id:string,version:number,actor:string,at=new Date()):Policy<T>{
    const key=tenantId+":"+id;const versions=this.versions.get(key);if(!versions)throw new Error("POLICY_NOT_FOUND");
    const index=versions.findIndex(p=>p.version===version);if(index<0)throw new Error("POLICY_VERSION_NOT_FOUND");
    const approved=approvePolicy(versions[index]!,actor,at);const next=[...versions];next[index]=approved;this.versions.set(key,next);return approved;
  }
  effective(tenantId:string,id:string,at=new Date()):Policy<T>{
    const versions=this.versions.get(tenantId+":"+id)??[];
    const effective=versions.filter(p=>p.approvedAt&&Date.parse(p.effectiveAt)<=at.getTime()).sort((a,b)=>b.version-a.version)[0];
    if(!effective)throw new Error("POLICY_NOT_EFFECTIVE");return effective;
  }
  history(tenantId:string,id:string):readonly Policy<T>[] { return Object.freeze([...(this.versions.get(tenantId+":"+id)??[])]); }
}
