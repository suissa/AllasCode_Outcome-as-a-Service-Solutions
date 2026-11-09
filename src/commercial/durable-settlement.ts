import { createHash } from "node:crypto";
import type { SqlDatabase, SqlExecutor } from "../persistence/sql.ts";
import { canonicalJson } from "../domain/audit.ts";
import type { SettlementAction, SettlementActionPort } from "./settlement-workflow.ts";
export type SettlementActionState="pending"|"running"|"succeeded"|"failed";
export type SettlementEventKind="queued"|"started"|"retry_scheduled"|"completed"|"failed";
export interface SettlementContext{tenantId:string;actorId:string;correlationId:string}
export interface SettlementWorkflowRecord{
 tenantId:string;actionId:string;idempotencyKey:string;fingerprint:string;action:SettlementAction;state:SettlementActionState;
 attempt:number;maxAttempts:number;leaseUntil?:string;claimedBy?:string;externalReference?:string;errorCode?:string;createdAt:string;updatedAt:string;replayed:boolean;
}
export interface SettlementWorkflowEvent{tenantId:string;actionId:string;eventId:string;kind:SettlementEventKind;actorId:string;correlationId:string;payload:Readonly<Record<string,unknown>>;occurredAt:string}
interface ActionRow extends Record<string,unknown>{tenant_id:string;action_id:string;idempotency_key:string;fingerprint:string;payload:SettlementAction|string;state:SettlementActionState;attempt:number|string;max_attempts:number|string;lease_until:Date|string|null;claimed_by:string|null;external_reference:string|null;error_code:string|null;created_at:Date|string;updated_at:Date|string}
interface EventRow extends Record<string,unknown>{tenant_id:string;action_id:string;event_id:string;kind:SettlementEventKind;actor_id:string;correlation_id:string;payload:Record<string,unknown>|string;occurred_at:Date|string}
const required=(v:string)=>typeof v==="string"&&v.trim().length>0;
const iso=(v:Date|string|null|undefined):string|undefined=>v==null?undefined:v instanceof Date?v.toISOString():new Date(v).toISOString();
const decode=<T>(v:T|string):T=>typeof v==="string"?JSON.parse(v) as T:v;
const fingerprint=(action:SettlementAction)=>createHash("sha256").update(canonicalJson(action),"utf8").digest("hex");
function toRecord(row:ActionRow,replayed=false):SettlementWorkflowRecord{
 const leaseUntil=iso(row.lease_until);
 return Object.freeze({tenantId:row.tenant_id,actionId:row.action_id,idempotencyKey:row.idempotency_key,fingerprint:row.fingerprint,action:decode(row.payload),state:row.state,attempt:Number(row.attempt),maxAttempts:Number(row.max_attempts),...(leaseUntil?{leaseUntil}:{}),...(row.claimed_by?{claimedBy:row.claimed_by}:{}),...(row.external_reference?{externalReference:row.external_reference}:{}),...(row.error_code?{errorCode:row.error_code}:{}),createdAt:iso(row.created_at)!,updatedAt:iso(row.updated_at)!,replayed});
}
function toEvent(row:EventRow):SettlementWorkflowEvent{
 return Object.freeze({tenantId:row.tenant_id,actionId:row.action_id,eventId:row.event_id,kind:row.kind,actorId:row.actor_id,correlationId:row.correlation_id,payload:decode<Record<string,unknown>>(row.payload),occurredAt:iso(row.occurred_at)!});
}
function validateContext(context:SettlementContext):void{
 if(!required(context.tenantId)||!required(context.actorId)||!required(context.correlationId))throw new Error("SETTLEMENT_CONTEXT_INVALID");
}
function validateAction(action:SettlementAction,tenantId:string):void{
 if(!required(action.id)||!required(action.tenantId)||action.tenantId!==tenantId||!required(action.outcomeId)||!required(action.agreementId)||!required(action.idempotencyKey)||!required(action.reason)||! /^[A-Z]{3}$/.test(action.currency))throw new Error("SETTLEMENT_ACTION_INVALID");
 if(action.amount!==undefined&&(!Number.isFinite(action.amount)||action.amount<=0))throw new Error("SETTLEMENT_ACTION_AMOUNT_INVALID");
}
export class PostgresSettlementWorkflow{
 constructor(private readonly db:SqlDatabase){}
 async enqueue(actions:readonly SettlementAction[],context:SettlementContext,maxAttempts=3,at=new Date()):Promise<readonly SettlementWorkflowRecord[]>{
  validateContext(context);if(!actions.length||!Number.isSafeInteger(maxAttempts)||maxAttempts<1||!Number.isFinite(at.getTime()))throw new Error("SETTLEMENT_PLAN_INVALID");
  const ids=new Set<string>(),keys=new Set<string>();for(const action of actions){validateAction(action,context.tenantId);if(ids.has(action.id)||keys.has(action.idempotencyKey))throw new Error("SETTLEMENT_PLAN_DUPLICATE_ACTION");ids.add(action.id);keys.add(action.idempotencyKey);}
  return this.db.transaction(async tx=>{
   const records:SettlementWorkflowRecord[]=[];
   for(const action of [...actions].sort((a,b)=>a.idempotencyKey.localeCompare(b.idempotencyKey))){
    const digest=fingerprint(action);await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",["settlement-action:"+context.tenantId+":"+action.idempotencyKey]);
    const existing=await tx.query<ActionRow>("select tenant_id,action_id,idempotency_key,fingerprint,payload,state,attempt,max_attempts,lease_until,claimed_by,external_reference,error_code,created_at,updated_at from settlement_workflow_actions where tenant_id=$1 and idempotency_key=$2 for update",[context.tenantId,action.idempotencyKey]);
    if(existing.rows[0]){
     if(existing.rows[0].fingerprint!==digest||canonicalJson(decode(existing.rows[0].payload))!==canonicalJson(action))throw new Error("SETTLEMENT_IDEMPOTENCY_CONFLICT");
     records.push(toRecord(existing.rows[0],true));continue;
    }
    const now=at.toISOString();const inserted=await tx.query<ActionRow>("insert into settlement_workflow_actions (tenant_id,action_id,idempotency_key,fingerprint,payload,state,attempt,max_attempts,created_at,updated_at) values ($1,$2,$3,$4,$5::jsonb,'pending',0,$6,$7,$7) returning tenant_id,action_id,idempotency_key,fingerprint,payload,state,attempt,max_attempts,lease_until,claimed_by,external_reference,error_code,created_at,updated_at",[context.tenantId,action.id,action.idempotencyKey,digest,canonicalJson(action),maxAttempts,now]);
    if(!inserted.rows[0])throw new Error("SETTLEMENT_ENQUEUE_FAILED");
    await this.appendEvent(tx,{tenantId:context.tenantId,actionId:action.id,eventId:action.id+":queued",kind:"queued",actorId:context.actorId,correlationId:context.correlationId,payload:{fingerprint:digest},occurredAt:now});
    records.push(toRecord(inserted.rows[0]));
   }
   return Object.freeze(records);
  });
 }
 async claim(tenantId:string,actionId:string,workerId:string,context:SettlementContext,leaseMs=30_000,at=new Date()):Promise<SettlementWorkflowRecord|null>{
  validateContext(context);if(context.tenantId!==tenantId||!required(actionId)||!required(workerId)||!Number.isSafeInteger(leaseMs)||leaseMs<1||!Number.isFinite(at.getTime()))throw new Error("SETTLEMENT_CLAIM_INVALID");
  return this.db.transaction(async tx=>{
   await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",["settlement-action:"+tenantId+":"+actionId]);
   const found=await tx.query<ActionRow>("select tenant_id,action_id,idempotency_key,fingerprint,payload,state,attempt,max_attempts,lease_until,claimed_by,external_reference,error_code,created_at,updated_at from settlement_workflow_actions where tenant_id=$1 and action_id=$2 for update",[tenantId,actionId]);
   const row=found.rows[0];if(!row)throw new Error("SETTLEMENT_ACTION_NOT_FOUND");
   const leaseUntil=iso(row.lease_until);if(row.state==="succeeded"||row.state==="failed"||(row.state==="running"&&leaseUntil&&Date.parse(leaseUntil)>at.getTime()))return null;
   if(Number(row.attempt)>=Number(row.max_attempts))return null;
   const attempt=Number(row.attempt)+1;const now=at.toISOString();const lease=new Date(at.getTime()+leaseMs).toISOString();
   const updated=await tx.query<ActionRow>("update settlement_workflow_actions set state='running',attempt=$3,lease_until=$4,claimed_by=$5,updated_at=$6 where tenant_id=$1 and action_id=$2 and (state='pending' or (state='running' and lease_until<=$6)) returning tenant_id,action_id,idempotency_key,fingerprint,payload,state,attempt,max_attempts,lease_until,claimed_by,external_reference,error_code,created_at,updated_at",[tenantId,actionId,attempt,lease,workerId,now]);
   if(!updated.rows[0])return null;
   await this.appendEvent(tx,{tenantId,actionId,eventId:actionId+":started:"+attempt,kind:"started",actorId:context.actorId,correlationId:context.correlationId,payload:{workerId,attempt,leaseUntil:lease},occurredAt:now});
   return toRecord(updated.rows[0]);
  });
 }
 async complete(tenantId:string,actionId:string,workerId:string,externalReference:string,context:SettlementContext,at=new Date()):Promise<SettlementWorkflowRecord>{
  validateContext(context);if(context.tenantId!==tenantId||!required(actionId)||!required(workerId)||!required(externalReference)||!Number.isFinite(at.getTime()))throw new Error("SETTLEMENT_COMPLETION_INVALID");
  return this.db.transaction(async tx=>{
   await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",["settlement-action:"+tenantId+":"+actionId]);
   const found=await tx.query<ActionRow>("select tenant_id,action_id,idempotency_key,fingerprint,payload,state,attempt,max_attempts,lease_until,claimed_by,external_reference,error_code,created_at,updated_at from settlement_workflow_actions where tenant_id=$1 and action_id=$2 for update",[tenantId,actionId]);
   const row=found.rows[0];if(!row)throw new Error("SETTLEMENT_ACTION_NOT_FOUND");
   if(row.state!=="running"||row.claimed_by!==workerId)throw new Error("SETTLEMENT_WORKER_MISMATCH");
   const now=at.toISOString();const updated=await tx.query<ActionRow>("update settlement_workflow_actions set state='succeeded',external_reference=$3,lease_until=null,claimed_by=null,updated_at=$4 where tenant_id=$1 and action_id=$2 and state='running' and claimed_by=$5 returning tenant_id,action_id,idempotency_key,fingerprint,payload,state,attempt,max_attempts,lease_until,claimed_by,external_reference,error_code,created_at,updated_at",[tenantId,actionId,externalReference,now,workerId]);
   if(!updated.rows[0])throw new Error("SETTLEMENT_COMPLETION_CONFLICT");
   await this.appendEvent(tx,{tenantId,actionId,eventId:actionId+":completed",kind:"completed",actorId:context.actorId,correlationId:context.correlationId,payload:{externalReference,attempt:Number(row.attempt)},occurredAt:now});
   return toRecord(updated.rows[0]);
  });
 }
 async fail(tenantId:string,actionId:string,workerId:string,errorCode:string,retryable:boolean,context:SettlementContext,at=new Date()):Promise<SettlementWorkflowRecord>{
  validateContext(context);if(context.tenantId!==tenantId||!required(actionId)||!required(workerId)||!required(errorCode)||typeof retryable!=="boolean"||!Number.isFinite(at.getTime()))throw new Error("SETTLEMENT_FAILURE_INVALID");
  return this.db.transaction(async tx=>{
   await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",["settlement-action:"+tenantId+":"+actionId]);
   const found=await tx.query<ActionRow>("select tenant_id,action_id,idempotency_key,fingerprint,payload,state,attempt,max_attempts,lease_until,claimed_by,external_reference,error_code,created_at,updated_at from settlement_workflow_actions where tenant_id=$1 and action_id=$2 for update",[tenantId,actionId]);
   const row=found.rows[0];if(!row)throw new Error("SETTLEMENT_ACTION_NOT_FOUND");
   if(row.state!=="running"||row.claimed_by!==workerId)throw new Error("SETTLEMENT_WORKER_MISMATCH");
   const retry=retryable&&Number(row.attempt)<Number(row.max_attempts);const nextState:SettlementActionState=retry?"pending":"failed";const now=at.toISOString();
   const updated=await tx.query<ActionRow>("update settlement_workflow_actions set state=$3,error_code=$4,lease_until=null,claimed_by=null,updated_at=$5 where tenant_id=$1 and action_id=$2 and state='running' and claimed_by=$6 returning tenant_id,action_id,idempotency_key,fingerprint,payload,state,attempt,max_attempts,lease_until,claimed_by,external_reference,error_code,created_at,updated_at",[tenantId,actionId,nextState,errorCode,now,workerId]);
   if(!updated.rows[0])throw new Error("SETTLEMENT_FAILURE_CONFLICT");
   await this.appendEvent(tx,{tenantId,actionId,eventId:actionId+":"+(retry?"retry_scheduled":"failed")+":"+row.attempt,kind:retry?"retry_scheduled":"failed",actorId:context.actorId,correlationId:context.correlationId,payload:{errorCode,attempt:Number(row.attempt),retryable},occurredAt:now});
   return toRecord(updated.rows[0]);
  });
 }
 async execute(tenantId:string,actionId:string,workerId:string,context:SettlementContext,port:SettlementActionPort,at=new Date()):Promise<{status:"not_claimed"}|{status:"completed";record:SettlementWorkflowRecord}|{status:"retry_scheduled"|"failed";record:SettlementWorkflowRecord;errorCode:string}>{
  const claimed=await this.claim(tenantId,actionId,workerId,context,30_000,at);if(!claimed)return{status:"not_claimed"};
  try{const result=await port.execute(claimed.action);if(!required(result.externalReference))throw new Error("SETTLEMENT_REFERENCE_REQUIRED");const record=await this.complete(tenantId,actionId,workerId,result.externalReference,context);return{status:"completed",record};}
  catch(error){const errorCode=error instanceof Error?error.message:"SETTLEMENT_ACTION_FAILED";const record=await this.fail(tenantId,actionId,workerId,errorCode,true,context);return{status:record.state==="pending"?"retry_scheduled":"failed",record,errorCode};}
 }
 async get(tenantId:string,actionId:string):Promise<SettlementWorkflowRecord|null>{
  if(!required(tenantId)||!required(actionId))throw new Error("SETTLEMENT_LOOKUP_SCOPE_REQUIRED");
  const result=await this.db.query<ActionRow>("select tenant_id,action_id,idempotency_key,fingerprint,payload,state,attempt,max_attempts,lease_until,claimed_by,external_reference,error_code,created_at,updated_at from settlement_workflow_actions where tenant_id=$1 and action_id=$2",[tenantId,actionId]);
  return result.rows[0]?toRecord(result.rows[0]):null;
 }
 async events(tenantId:string,actionId:string):Promise<readonly SettlementWorkflowEvent[]>{
  if(!required(tenantId)||!required(actionId))throw new Error("SETTLEMENT_LOOKUP_SCOPE_REQUIRED");
  const result=await this.db.query<EventRow>("select tenant_id,action_id,event_id,kind,actor_id,correlation_id,payload,occurred_at from settlement_workflow_events where tenant_id=$1 and action_id=$2 order by occurred_at,event_id",[tenantId,actionId]);
  return Object.freeze(result.rows.map(toEvent));
 }
 private async appendEvent(tx:SqlExecutor,event:SettlementWorkflowEvent):Promise<void>{
  await tx.query("insert into settlement_workflow_events (tenant_id,action_id,event_id,kind,actor_id,correlation_id,payload,occurred_at) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)",[event.tenantId,event.actionId,event.eventId,event.kind,event.actorId,event.correlationId,canonicalJson(event.payload),event.occurredAt]);
 }
}
