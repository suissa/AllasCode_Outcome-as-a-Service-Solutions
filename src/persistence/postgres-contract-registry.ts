import type { SqlDatabase } from "./sql.ts";
import type { ContractCommitCommand, ContractCommitResult, ContractEvent, ContractRecord, ContractRegistryStore } from "../commercial/contract-workflow.ts";

interface ContractRow extends Record<string, unknown> { payload: ContractRecord | string; revision: number; state: string }
interface IdempotencyRow extends Record<string, unknown> { fingerprint: string; result: ContractRecord | string }
interface EventRow extends Record<string, unknown> { payload?: ContractEvent | string; tenant_id: string; contract_id: string; event_id: string; revision: number; action: ContractEvent["action"]; from_state: ContractEvent["fromState"]; to_state: ContractEvent["toState"]; actor_id: string; correlation_id: string; metadata: Record<string, unknown> | string; occurred_at: string | Date }
const decode = <T>(value: T | string): T => typeof value === "string" ? JSON.parse(value) as T : value;
const canonical = (value: unknown): string => {
 if(value===null||typeof value!=="object")return JSON.stringify(value)??"null";
 if(Array.isArray(value))return "["+value.map(canonical).join(",")+"]";
 const object=value as Record<string,unknown>;
 return "{"+Object.keys(object).sort().map(k=>JSON.stringify(k)+":"+canonical(object[k])).join(",")+"}";
};
const toEvent = (row: EventRow): ContractEvent => row.payload ? decode(row.payload) : ({
 tenantId:row.tenant_id,contractId:row.contract_id,eventId:row.event_id,revision:Number(row.revision),
 action:row.action,fromState:row.from_state,toState:row.to_state,actorId:row.actor_id,
 correlationId:row.correlation_id,metadata:decode(row.metadata),occurredAt:new Date(row.occurred_at).toISOString(),
});
export class PostgresContractRegistryStore implements ContractRegistryStore {
 constructor(private readonly db:SqlDatabase){}
 async createDraft(value:ContractRecord,event:ContractEvent,idempotencyKey:string,fingerprint:string):Promise<ContractCommitResult>{
  if(!value.tenantId||!value.id||value.revision!==1||event.revision!==1||event.toState!=="draft"||!idempotencyKey||!/^[a-f0-9]{64}$/.test(fingerprint))throw new Error("CONTRACT_CREATE_INVALID");
  return this.db.transaction(async tx=>{
   await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[value.tenantId+":contract:"+idempotencyKey]);
   const prior=await tx.query<IdempotencyRow>("select fingerprint,result from contract_idempotency where tenant_id=$1 and idempotency_key=$2 for update",[value.tenantId,idempotencyKey]);
   if(prior.rows[0]){
    if(prior.rows[0].fingerprint!==fingerprint)throw new Error("CONTRACT_IDEMPOTENCY_CONFLICT");
    return {value:decode(prior.rows[0].result),replayed:true};
   }
   const existing=await tx.query<ContractRow>("select payload,revision,state from contract_records where tenant_id=$1 and contract_id=$2 for update",[value.tenantId,value.id]);
   if(existing.rows[0])throw new Error("CONTRACT_ALREADY_EXISTS");
   await tx.query("insert into contract_records(tenant_id,contract_id,revision,state,payload,created_at,updated_at) values($1,$2,1,'draft',$3::jsonb,$4,$4)",[value.tenantId,value.id,canonical(value),value.createdAt]);
   await this.insertEvent(tx,event);
   await tx.query("insert into contract_idempotency(tenant_id,idempotency_key,fingerprint,result) values($1,$2,$3,$4::jsonb)",[value.tenantId,idempotencyKey,fingerprint,canonical(value)]);
   return {value,replayed:false};
  });
 }
 async get(tenantId:string,contractId:string):Promise<ContractRecord|undefined>{
  if(!tenantId||!contractId)throw new Error("CONTRACT_LOOKUP_SCOPE_REQUIRED");
  const result=await this.db.query<ContractRow>("select payload,revision,state from contract_records where tenant_id=$1 and contract_id=$2",[tenantId,contractId]);
  return result.rows[0]?decode(result.rows[0].payload):undefined;
 }
 async commit(command:ContractCommitCommand):Promise<ContractCommitResult>{
  if(!command.tenantId||!command.contractId||!command.idempotencyKey||!/^[a-f0-9]{64}$/.test(command.fingerprint)||!Number.isInteger(command.expectedRevision)||command.value.revision!==command.expectedRevision+1||command.event.revision!==command.value.revision)throw new Error("CONTRACT_COMMAND_INVALID");
  return this.db.transaction(async tx=>{
   await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[command.tenantId+":contract:"+command.idempotencyKey]);
   const prior=await tx.query<IdempotencyRow>("select fingerprint,result from contract_idempotency where tenant_id=$1 and idempotency_key=$2 for update",[command.tenantId,command.idempotencyKey]);
   if(prior.rows[0]){
    if(prior.rows[0].fingerprint!==command.fingerprint)throw new Error("CONTRACT_IDEMPOTENCY_CONFLICT");
    return {value:decode(prior.rows[0].result),replayed:true};
   }
   const current=await tx.query<ContractRow>("select payload,revision,state from contract_records where tenant_id=$1 and contract_id=$2 for update",[command.tenantId,command.contractId]);
   if(!current.rows[0])throw new Error("CONTRACT_NOT_FOUND");
   if(Number(current.rows[0].revision)!==command.expectedRevision)throw new Error("CONTRACT_REVISION_CONFLICT");
   if(command.value.tenantId!==command.tenantId||command.value.id!==command.contractId||command.event.tenantId!==command.tenantId||command.event.contractId!==command.contractId)throw new Error("CONTRACT_TENANT_MISMATCH");
   await tx.query("update contract_records set revision=$3,state=$4,payload=$5::jsonb,updated_at=$6 where tenant_id=$1 and contract_id=$2 and revision=$7",[command.tenantId,command.contractId,command.value.revision,command.value.state,canonical(command.value),command.value.updatedAt,command.expectedRevision]);
   await this.insertEvent(tx,command.event);
   await tx.query("insert into contract_idempotency(tenant_id,idempotency_key,fingerprint,result) values($1,$2,$3,$4::jsonb)",[command.tenantId,command.idempotencyKey,command.fingerprint,canonical(command.value)]);
   return {value:command.value,replayed:false};
  });
 }
 async events(tenantId:string,contractId:string):Promise<readonly ContractEvent[]>{
  if(!tenantId||!contractId)throw new Error("CONTRACT_LOOKUP_SCOPE_REQUIRED");
  const result=await this.db.query<EventRow>("select tenant_id,contract_id,event_id,revision,action,from_state,to_state,actor_id,correlation_id,metadata,occurred_at from contract_events where tenant_id=$1 and contract_id=$2 order by revision",[tenantId,contractId]);
  return Object.freeze(result.rows.map(toEvent));
 }
 private async insertEvent(tx:import("./sql.ts").SqlExecutor,event:ContractEvent):Promise<void>{
  await tx.query("insert into contract_events(tenant_id,contract_id,event_id,revision,action,from_state,to_state,actor_id,correlation_id,metadata,occurred_at) values($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11)",[event.tenantId,event.contractId,event.eventId,event.revision,event.action,event.fromState,event.toState,event.actorId,event.correlationId,canonical(event.metadata),event.occurredAt]);
 }
}
