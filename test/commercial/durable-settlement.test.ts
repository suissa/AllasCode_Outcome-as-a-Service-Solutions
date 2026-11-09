import test from "node:test";
import assert from "node:assert/strict";
import { planSettlementActions } from "../../src/commercial/settlement-workflow.ts";
import { PostgresSettlementWorkflow } from "../../src/commercial/durable-settlement.ts";
import type { SqlDatabase, SqlExecutor } from "../../src/persistence/sql.ts";
import type { SettlementAction } from "../../src/commercial/settlement-workflow.ts";
type Row={tenant_id:string;action_id:string;idempotency_key:string;fingerprint:string;payload:unknown;state:string;attempt:number;max_attempts:number;lease_until:string|null;claimed_by:string|null;external_reference:string|null;error_code:string|null;created_at:string;updated_at:string};
class MemoryDb implements SqlDatabase{
 rows=new Map<string,Row>();events:Record<string,unknown>[]=[];
 async query<T extends Record<string,unknown>>(sql:string,p:readonly unknown[]=[]):Promise<{rows:T[];rowCount:number}>{
  if(sql.includes("from settlement_workflow_actions")){const row=this.rows.get(String(p[0])+":"+String(p[1]));return{rows:(row?[row]:[]) as unknown as T[],rowCount:row?1:0};}
  if(sql.includes("from settlement_workflow_events"))return{rows:this.events.filter(e=>e.tenant_id===p[0]&&e.action_id===p[1]) as unknown as T[],rowCount:this.events.length};
  throw new Error("UNEXPECTED_QUERY:"+sql);
 }
 async transaction<T>(work:(tx:SqlExecutor)=>Promise<T>):Promise<T>{
  const tx:SqlExecutor={query:async<R extends Record<string,unknown>>(sql:string,p:readonly unknown[]=[]):Promise<{rows:R[];rowCount:number}>=>{
   if(sql.includes("pg_advisory_xact_lock"))return{rows:[],rowCount:1};
   if(sql.includes("from settlement_workflow_actions where tenant_id=$1 and idempotency_key=$2")){const row=[...this.rows.values()].find(r=>r.tenant_id===p[0]&&r.idempotency_key===p[1]);return{rows:(row?[row]:[]) as unknown as R[],rowCount:row?1:0};}
   if(sql.includes("from settlement_workflow_actions where tenant_id=$1 and action_id=$2")){const row=this.rows.get(String(p[0])+":"+String(p[1]));return{rows:(row?[row]:[]) as unknown as R[],rowCount:row?1:0};}
   if(sql.startsWith("insert into settlement_workflow_actions")){const row:Row={tenant_id:String(p[0]),action_id:String(p[1]),idempotency_key:String(p[2]),fingerprint:String(p[3]),payload:JSON.parse(String(p[4])),state:"pending",attempt:0,max_attempts:Number(p[5]),lease_until:null,claimed_by:null,external_reference:null,error_code:null,created_at:String(p[6]),updated_at:String(p[6])};this.rows.set(row.tenant_id+":"+row.action_id,row);return{rows:[row] as unknown as R[],rowCount:1};}
   if(sql.startsWith("update settlement_workflow_actions")){const key=String(p[0])+":"+String(p[1]);const row=this.rows.get(key);if(!row)return{rows:[],rowCount:0};if(sql.includes("state='running'")){row.state="running";row.attempt=Number(p[2]);row.lease_until=String(p[3]);row.claimed_by=String(p[4]);row.updated_at=String(p[5]);}else if(sql.includes("state='succeeded'")){row.state="succeeded";row.external_reference=String(p[2]);row.lease_until=null;row.claimed_by=null;row.updated_at=String(p[3]);}else{row.state=String(p[2]);row.error_code=String(p[3]);row.lease_until=null;row.claimed_by=null;row.updated_at=String(p[4]);}return{rows:[row] as unknown as R[],rowCount:1};}
   if(sql.startsWith("insert into settlement_workflow_events")){this.events.push({tenant_id:p[0],action_id:p[1],event_id:p[2],kind:p[3],actor_id:p[4],correlation_id:p[5],payload:JSON.parse(String(p[6])),occurred_at:p[7]});return{rows:[],rowCount:1};}
   throw new Error("UNEXPECTED_SQL:"+sql);
  }};
  return work(tx);
 }
}
const plan=(paymentCaptured=true)=>planSettlementActions({tenantId:"tenant_1",outcomeId:"outcome_1",agreementId:"agreement_1",accepted:true,achieved:false,disputed:false,paymentCaptured,currency:"BRL",feeAmount:100,bonusAmount:20,refundableAmount:50});
const context={tenantId:"tenant_1",actorId:"operator_1",correlationId:"corr_1"};
test("settlement planner never refunds a payment that was not captured",()=>{
 assert.deepEqual(plan(false).map(a=>a.kind),["hold"]);
 assert.deepEqual(plan(true).map(a=>a.kind),["refund"]);
});
test("durable settlement queue is idempotent, tenant-scoped and auditable",async()=>{
 const db=new MemoryDb();const workflow=new PostgresSettlementWorkflow(db);const action=plan()[0]!;
 const first=await workflow.enqueue([action],context);assert.equal(first[0]?.replayed,false);
 const replay=await workflow.enqueue([action],context);assert.equal(replay[0]?.replayed,true);
 await assert.rejects(()=>workflow.enqueue([{...action,reason:"changed"}],context),/SETTLEMENT_IDEMPOTENCY_CONFLICT/);
 assert.equal((await workflow.get("tenant_1",action.id))?.state,"pending");
 assert.equal(await workflow.get("tenant_2",action.id),null);
 assert.equal((await workflow.events("tenant_1",action.id)).length,1);
});
test("settlement claims use leases, enforce worker ownership and retry safely",async()=>{
 const db=new MemoryDb();const workflow=new PostgresSettlementWorkflow(db);const action=plan()[0]!;
 await workflow.enqueue([action],context);
 const first=await workflow.claim("tenant_1",action.id,"worker_a",{...context,actorId:"worker_a"},1000,new Date("2026-11-09T12:00:00Z"));
 assert.equal(first?.attempt,1);
 assert.equal(await workflow.claim("tenant_1",action.id,"worker_b",{...context,actorId:"worker_b"},1000,new Date("2026-11-09T12:00:01Z")),null);
 await assert.rejects(()=>workflow.complete("tenant_1",action.id,"worker_b","external_1",context),/SETTLEMENT_WORKER_MISMATCH/);
 const retry=await workflow.fail("tenant_1",action.id,"worker_a","PROVIDER_BUSY",true,{...context,actorId:"worker_a"},new Date("2026-11-09T12:00:02Z"));
 assert.equal(retry.state,"pending");
 const second=await workflow.claim("tenant_1",action.id,"worker_b",{...context,actorId:"worker_b"},1000,new Date("2026-11-09T12:00:03Z"));
 assert.equal(second?.attempt,2);
 const done=await workflow.complete("tenant_1",action.id,"worker_b","external_2",{...context,actorId:"worker_b"},new Date("2026-11-09T12:00:04Z"));
 assert.equal(done.state,"succeeded");assert.equal(done.externalReference,"external_2");
 assert.equal(await workflow.claim("tenant_1",action.id,"worker_c",context),null);
 assert.deepEqual((await workflow.events("tenant_1",action.id)).map(e=>e.kind),["queued","started","retry_scheduled","started","completed"]);
});
test("durable executor persists retryable failures and provider references",async()=>{
 const db=new MemoryDb();const workflow=new PostgresSettlementWorkflow(db);const action=plan()[0]!;
 await workflow.enqueue([action],context);
 const result=await workflow.execute("tenant_1",action.id,"worker_a",{...context,actorId:"worker_a"},{execute:async(a:SettlementAction)=>({externalReference:"provider:"+a.id})},new Date("2026-11-09T12:00:00Z"));
 assert.equal(result.status,"completed");
 if(result.status==="completed")assert.equal(result.record.externalReference,"provider:"+action.id);
});
