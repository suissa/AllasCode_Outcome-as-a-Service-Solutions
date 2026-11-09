import test from "node:test";
import assert from "node:assert/strict";
import { PolicyRegistry, PostgresPolicyRegistry, approvePolicy, assertPolicyEffective, type Policy } from "../../src/domain/policy.ts";
import type { SqlDatabase, SqlExecutor } from "../../src/persistence/sql.ts";

const policy=(id="refund-policy",version=1,createdBy="author"):Policy<{limit:number}>=>({id,version,name:"Refund policy",effectiveAt:"2026-01-01T00:00:00.000Z",rules:{limit:100},createdBy});
test("policy proposals are validated, tenant scoped and deeply immutable",()=>{
 const registry=new PolicyRegistry<{limit:number}>();const first=registry.register("tenant_a",policy());
 assert.ok(Object.isFrozen(first.rules));assert.throws(()=>registry.register("tenant_a",policy()),/POLICY_ALREADY_REGISTERED/);
 assert.throws(()=>registry.propose("tenant_a",policy("refund-policy",3)),/POLICY_VERSION_CONFLICT/);
 registry.propose("tenant_a",policy("refund-policy",2));
 assert.equal(registry.history("tenant_b","refund-policy").length,0);
 assert.throws(()=>registry.register("tenant_a",{...policy(),approvedBy:"someone",approvedAt:"2026-01-01"}),/POLICY_PROPOSAL_MUST_BE_UNAPPROVED/);
});
test("approval enforces separation of duties, one approval and effective time",()=>{
 const registry=new PolicyRegistry();registry.register("tenant_a",policy());
 assert.throws(()=>registry.approve("tenant_a","refund-policy",1,"author"),/POLICY_SEPARATION_OF_DUTIES/);
 const approved=registry.approve("tenant_a","refund-policy",1,"reviewer",new Date("2026-01-02T00:00:00Z"));
 assert.equal(approved.approvedBy,"reviewer");assertPolicyEffective(approved,new Date("2026-01-03T00:00:00Z"));
 assert.throws(()=>registry.approve("tenant_a","refund-policy",1,"other"),/POLICY_ALREADY_APPROVED/);
 assert.throws(()=>registry.effective("tenant_a","refund-policy",new Date("2026-01-01T12:00:00Z")),/POLICY_NOT_EFFECTIVE/);
});
test("standalone approval rejects malformed and self-approved policies",()=>{
 assert.throws(()=>approvePolicy(policy(),"author"),/POLICY_SEPARATION_OF_DUTIES/);
 assert.throws(()=>approvePolicy({...policy(),effectiveAt:"invalid"},"reviewer"),/POLICY_INVALID/);
});
interface Stored {tenant_id:string;policy_id:string;version:number;name:string;effective_at:string;rules:unknown;created_by:string;policy_hash:string;approved_by?:string;approved_at?:string;reason?:string}
class MemoryPolicyDb implements SqlDatabase {
 readonly versions:Stored[]=[];readonly approvals:Stored[]=[];
 async query<R extends Record<string,unknown>>(sql:string,p:readonly unknown[]=[]):Promise<{rows:R[];rowCount:number}>{
  if(sql.includes("from policy_versions v join policy_approvals"))return {rows:this.join(p).filter(x=>Date.parse(x.effective_at)<=Date.parse(String(p[2]))&&x.approved_at&&Date.parse(x.approved_at)<=Date.parse(String(p[2]))).sort((a,b)=>b.version-a.version).slice(0,1) as unknown as R[],rowCount:1};
  if(sql.includes("from policy_versions v left join policy_approvals"))return {rows:this.join(p).sort((a,b)=>a.version-b.version) as unknown as R[],rowCount:this.versions.length};
  return {rows:[],rowCount:0};
 }
 private join(p:readonly unknown[]):Stored[]{return this.versions.filter(v=>v.tenant_id===p[0]&&v.policy_id===p[1]).map(v=>({...v,...(this.approvals.find(a=>a.tenant_id===v.tenant_id&&a.policy_id===v.policy_id&&a.version===v.version)??{})}));}
 async transaction<R>(work:(tx:SqlExecutor)=>Promise<R>):Promise<R>{
  const tx:SqlExecutor={query:async<Q extends Record<string,unknown>>(sql:string,p:readonly unknown[]=[]):Promise<{rows:Q[];rowCount:number}>=>{
   if(sql.includes("select version from policy_versions")){const rows=this.versions.filter(v=>v.tenant_id===p[0]&&v.policy_id===p[1]).sort((a,b)=>b.version-a.version);return {rows:(rows[0]?[{version:rows[0].version}]:[]) as unknown as Q[],rowCount:rows.length};}
   if(sql.includes("select policy_id from policy_versions")){const rows=this.versions.filter(v=>v.tenant_id===p[0]&&v.policy_id===p[1]);return {rows:(rows[0]?[{policy_id:rows[0].policy_id}]:[]) as unknown as Q[],rowCount:rows.length};}
   if(sql.includes("left join policy_approvals")){const row=this.join(p).find(v=>v.version===Number(p[2]));return {rows:(row?[row]:[]) as unknown as Q[],rowCount:row?1:0};}
   if(sql.startsWith("insert into policy_versions")){this.versions.push({tenant_id:String(p[0]),policy_id:String(p[1]),version:Number(p[2]),name:String(p[3]),effective_at:String(p[4]),rules:JSON.parse(String(p[5])),created_by:String(p[6]),policy_hash:String(p[7])});return {rows:[],rowCount:1};}
   if(sql.startsWith("insert into policy_approvals")){this.approvals.push({tenant_id:String(p[0]),policy_id:String(p[1]),version:Number(p[2]),approved_by:String(p[3]),approved_at:String(p[4]),reason:String(p[5]),policy_hash:String(p[6])} as Stored);return {rows:[],rowCount:1};}
   return {rows:[],rowCount:1};
  }};
  return work(tx);
 }
}
test("PostgreSQL registry persists immutable versions and approvals",async()=>{
 const db=new MemoryPolicyDb(),registry=new PostgresPolicyRegistry<{limit:number}>(db);
 await registry.register("tenant_a",policy(), "author");
 await assert.rejects(()=>registry.propose("tenant_a",policy("refund-policy",3),"author"),/POLICY_VERSION_CONFLICT/);
 await registry.propose("tenant_a",policy("refund-policy",2),"author");
 await assert.rejects(()=>registry.approve("tenant_a","refund-policy",1,"author","self approval"),/POLICY_SEPARATION_OF_DUTIES/);
 await registry.approve("tenant_a","refund-policy",1,"reviewer","Reviewed controls",new Date("2026-01-02T00:00:00.000Z"));
 assert.equal((await registry.effective("tenant_a","refund-policy",new Date("2026-02-01"))).version,1);
 assert.equal((await registry.history("tenant_a","refund-policy")).length,2);
 assert.equal((await registry.history("tenant_b","refund-policy")).length,0);
});
