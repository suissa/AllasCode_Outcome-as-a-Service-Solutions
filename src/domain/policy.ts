import { createHash } from "node:crypto";
import type { SqlDatabase } from "../persistence/sql.ts";
import { canonicalJson } from "./audit.ts";

export interface Policy<T = unknown> {
  id:string; version:number; name:string; effectiveAt:string; rules:T;
  createdBy?:string; approvedBy?:string; approvedAt?:string;
}
const required=(value:string)=>typeof value==="string"&&value.trim().length>0;
function validatePolicy<T>(policy:Policy<T>):void {
  if(!required(policy.id)||!required(policy.name)||!Number.isSafeInteger(policy.version)||policy.version<1
    ||!required(policy.effectiveAt)||Number.isNaN(Date.parse(policy.effectiveAt))
    ||(policy.createdBy!==undefined&&!required(policy.createdBy))
    ||(policy.approvedBy!==undefined&&!required(policy.approvedBy))
    ||(policy.approvedAt!==undefined&&!required(policy.approvedAt))) throw new Error("POLICY_INVALID");
  canonicalJson(policy.rules);
}
function deepFreeze<T>(value:T):T {
  if(value&&typeof value==="object"&&!Object.isFrozen(value)){
    Object.freeze(value);
    for(const child of Object.values(value as Record<string,unknown>))deepFreeze(child);
  }
  return value;
}
function policyHash<T>(policy:Policy<T>):string {
  return createHash("sha256").update(canonicalJson({
    id:policy.id,version:policy.version,name:policy.name,effectiveAt:policy.effectiveAt,
    rules:policy.rules,createdBy:policy.createdBy??null
  }),"utf8").digest("hex");
}
export function approvePolicy<T>(policy:Policy<T>,actorId:string,at=new Date()):Policy<T>{
  validatePolicy(policy);
  if(!required(actorId))throw new Error("POLICY_APPROVER_REQUIRED");
  if(Number.isNaN(at.getTime()))throw new Error("POLICY_APPROVAL_INVALID");
  if(policy.approvedAt||policy.approvedBy)throw new Error("POLICY_ALREADY_APPROVED");
  if(policy.createdBy&&policy.createdBy===actorId)throw new Error("POLICY_SEPARATION_OF_DUTIES");
  const approved={...policy,approvedBy:actorId,approvedAt:at.toISOString()};
  return deepFreeze(approved);
}
export function assertPolicyEffective(policy:Policy,at=new Date()):void{
  if(!policy.approvedAt||!policy.approvedBy||Number.isNaN(Date.parse(policy.effectiveAt))||Number.isNaN(Date.parse(policy.approvedAt))
    ||Date.parse(policy.effectiveAt)>at.getTime()||Date.parse(policy.approvedAt)>at.getTime())
    throw new Error("POLICY_NOT_EFFECTIVE");
}
export class PolicyRegistry<T=unknown>{
  private readonly versions=new Map<string,Policy<T>[]>();
  register(tenantId:string,policy:Policy<T>):Policy<T>{
    validatePolicy(policy);
    if(!required(tenantId)||policy.version!==1)throw new Error("POLICY_INITIAL_VERSION_INVALID");
    if(policy.approvedAt||policy.approvedBy)throw new Error("POLICY_PROPOSAL_MUST_BE_UNAPPROVED");
    const key=tenantId+":"+policy.id;if(this.versions.has(key))throw new Error("POLICY_ALREADY_REGISTERED");
    const saved=deepFreeze({...policy});this.versions.set(key,[saved]);return saved;
  }
  propose(tenantId:string,policy:Policy<T>):Policy<T>{
    validatePolicy(policy);
    if(!required(tenantId))throw new Error("POLICY_TENANT_REQUIRED");
    const key=tenantId+":"+policy.id;const versions=this.versions.get(key);if(!versions)throw new Error("POLICY_NOT_FOUND");
    const latest=versions[versions.length-1]!;
    if(policy.version!==latest.version+1)throw new Error("POLICY_VERSION_CONFLICT");
    if(policy.approvedAt||policy.approvedBy)throw new Error("POLICY_PROPOSAL_MUST_BE_UNAPPROVED");
    const saved=deepFreeze({...policy});this.versions.set(key,[...versions,saved]);return saved;
  }
  approve(tenantId:string,id:string,version:number,actor:string,at=new Date()):Policy<T>{
    const key=tenantId+":"+id;const versions=this.versions.get(key);if(!versions)throw new Error("POLICY_NOT_FOUND");
    const index=versions.findIndex(p=>p.version===version);if(index<0)throw new Error("POLICY_VERSION_NOT_FOUND");
    const approved=approvePolicy(versions[index]!,actor,at);const next=[...versions];next[index]=approved;
    this.versions.set(key,next);return approved;
  }
  effective(tenantId:string,id:string,at=new Date()):Policy<T>{
    const versions=this.versions.get(tenantId+":"+id)??[];
    const effective=versions.filter(p=>p.approvedAt&&p.approvedBy&&Date.parse(p.effectiveAt)<=at.getTime()&&Date.parse(p.approvedAt)<=at.getTime())
      .sort((a,b)=>b.version-a.version)[0];
    if(!effective)throw new Error("POLICY_NOT_EFFECTIVE");return effective;
  }
  history(tenantId:string,id:string):readonly Policy<T>[] {
    return Object.freeze([...(this.versions.get(tenantId+":"+id)??[])]);
  }
}

interface PolicyRow extends Record<string,unknown>{
  tenant_id:string;policy_id:string;version:number|string;name:string;effective_at:Date|string;
  rules:unknown|string;created_by:string;approved_by:string|null;approved_at:Date|string|null;
}
const decodeRules=<T>(value:unknown):T=>typeof value==="string"?JSON.parse(value) as T:value as T;
const asIso=(value:Date|string|null|undefined):string|undefined=>value==null?undefined:value instanceof Date?value.toISOString():new Date(value).toISOString();
function fromRow<T>(row:PolicyRow):Policy<T>{
  const approvedAt=asIso(row.approved_at);
  return deepFreeze({id:row.policy_id,version:Number(row.version),name:row.name,
    effectiveAt:asIso(row.effective_at)!,rules:decodeRules<T>(row.rules),createdBy:row.created_by,
    ...(row.approved_by?{approvedBy:row.approved_by}:{}),...(approvedAt?{approvedAt}:{})});
}
export class PostgresPolicyRegistry<T=unknown>{
  constructor(private readonly db:SqlDatabase){}
  register(tenantId:string,policy:Policy<T>,createdBy:string):Promise<Policy<T>>{
    validatePolicy(policy);
    if(!required(tenantId)||!required(createdBy)||policy.version!==1)throw new Error("POLICY_INITIAL_VERSION_INVALID");
    if(policy.approvedAt||policy.approvedBy)throw new Error("POLICY_PROPOSAL_MUST_BE_UNAPPROVED");
    return this.insertVersion(tenantId,{...policy,createdBy});
  }
  propose(tenantId:string,policy:Policy<T>,createdBy:string):Promise<Policy<T>>{
    validatePolicy(policy);
    if(!required(tenantId)||!required(createdBy))throw new Error("POLICY_CREATOR_REQUIRED");
    if(policy.approvedAt||policy.approvedBy)throw new Error("POLICY_PROPOSAL_MUST_BE_UNAPPROVED");
    return this.db.transaction(async tx=>{
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",["policy:"+tenantId+":"+policy.id]);
      const latest=await tx.query<{version:number|string}>("select version from policy_versions where tenant_id=$1 and policy_id=$2 order by version desc limit 1",[tenantId,policy.id]);
      if(!latest.rows[0])throw new Error("POLICY_NOT_FOUND");
      if(policy.version!==Number(latest.rows[0].version)+1)throw new Error("POLICY_VERSION_CONFLICT");
      return this.insertWithExecutor(tx,tenantId,{...policy,createdBy});
    });
  }
  private async insertVersion(tenantId:string,policy:Policy<T>):Promise<Policy<T>>{
    return this.db.transaction(async tx=>{
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",["policy:"+tenantId+":"+policy.id]);
      const existing=await tx.query("select policy_id from policy_versions where tenant_id=$1 and policy_id=$2 limit 1",[tenantId,policy.id]);
      if(existing.rows[0])throw new Error("POLICY_ALREADY_REGISTERED");
      return this.insertWithExecutor(tx,tenantId,policy);
    });
  }
  private async insertWithExecutor(tx:import("../persistence/sql.ts").SqlExecutor,tenantId:string,policy:Policy<T>):Promise<Policy<T>>{
    await tx.query("insert into policy_versions (tenant_id,policy_id,version,name,effective_at,rules,created_by,policy_hash) values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8)",
      [tenantId,policy.id,policy.version,policy.name,policy.effectiveAt,canonicalJson(policy.rules),policy.createdBy,policyHash(policy)]);
    return deepFreeze({...policy});
  }
  async approve(tenantId:string,id:string,version:number,actorId:string,reason:string,at=new Date()):Promise<Policy<T>>{
    if(!required(tenantId)||!required(id)||!Number.isSafeInteger(version)||version<1||!required(actorId))throw new Error("POLICY_APPROVAL_INVALID");
    if(!required(reason))throw new Error("POLICY_APPROVAL_REASON_REQUIRED");
    if(Number.isNaN(at.getTime()))throw new Error("POLICY_APPROVAL_INVALID");
    return this.db.transaction(async tx=>{
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",["policy:"+tenantId+":"+id]);
      const found=await tx.query<PolicyRow>(
        "select v.tenant_id,v.policy_id,v.version,v.name,v.effective_at,v.rules,v.created_by,a.approved_by,a.approved_at from policy_versions v left join policy_approvals a on a.tenant_id=v.tenant_id and a.policy_id=v.policy_id and a.version=v.version where v.tenant_id=$1 and v.policy_id=$2 and v.version=$3 for update of v",
        [tenantId,id,version]);
      if(!found.rows[0])throw new Error("POLICY_VERSION_NOT_FOUND");
      const policy=fromRow<T>(found.rows[0]);
      if(policy.approvedAt)throw new Error("POLICY_ALREADY_APPROVED");
      if(policy.createdBy===actorId)throw new Error("POLICY_SEPARATION_OF_DUTIES");
      const approvedAt=at.toISOString();
      await tx.query("insert into policy_approvals (tenant_id,policy_id,version,approved_by,approved_at,reason,policy_hash) values ($1,$2,$3,$4,$5,$6,$7)",
        [tenantId,id,version,actorId,approvedAt,reason,policyHash(policy)]);
      return deepFreeze({...policy,approvedBy:actorId,approvedAt});
    });
  }
  async effective(tenantId:string,id:string,at=new Date()):Promise<Policy<T>>{
    const result=await this.db.query<PolicyRow>(
      "select v.tenant_id,v.policy_id,v.version,v.name,v.effective_at,v.rules,v.created_by,a.approved_by,a.approved_at from policy_versions v join policy_approvals a on a.tenant_id=v.tenant_id and a.policy_id=v.policy_id and a.version=v.version where v.tenant_id=$1 and v.policy_id=$2 and v.effective_at<=$3 and a.approved_at<=$3 order by v.version desc limit 1",
      [tenantId,id,at.toISOString()]);
    if(!result.rows[0])throw new Error("POLICY_NOT_EFFECTIVE");
    return fromRow<T>(result.rows[0]);
  }
  async history(tenantId:string,id:string):Promise<readonly Policy<T>[]>{
    const result=await this.db.query<PolicyRow>(
      "select v.tenant_id,v.policy_id,v.version,v.name,v.effective_at,v.rules,v.created_by,a.approved_by,a.approved_at from policy_versions v left join policy_approvals a on a.tenant_id=v.tenant_id and a.policy_id=v.policy_id and a.version=v.version where v.tenant_id=$1 and v.policy_id=$2 order by v.version",
      [tenantId,id]);
    return Object.freeze(result.rows.map(row=>fromRow<T>(row)));
  }
}
