export interface UsageEvent{id:string;tenantId:string;actorId:string;quantity:number;unit:string;occurredAt:string;idempotencyKey:string}export interface LedgerEntry{id:string;tenantId:string;sourceEventId:string;currency:string;amount:number;kind:"charge"|"credit"|"refund";createdAt:string}export function priceUsage(e:UsageEvent,rate:number,currency:string):LedgerEntry{if(e.quantity<0||rate<0||!Number.isFinite(e.quantity*rate))throw new Error("USAGE_INVALID");return Object.freeze({id:`ledger_${e.id}`,tenantId:e.tenantId,sourceEventId:e.id,currency,amount:e.quantity*rate,kind:"charge",createdAt:e.occurredAt})}export function reconcile(entries:readonly LedgerEntry[],events:readonly UsageEvent[]):string[]{const ids=new Set(events.map(e=>e.id));return entries.filter(e=>!ids.has(e.sourceEventId)).map(e=>e.id)}
import type { SqlDatabase } from "../persistence/sql.ts";
export interface UsageReconciliation { missingLedgerEventIds: readonly string[]; orphanLedgerEntryIds: readonly string[]; duplicateSourceEventIds: readonly string[] }
export function reconcileUsage(events:readonly UsageEvent[],entries:readonly LedgerEntry[]):UsageReconciliation {
 const eventIds=new Set(events.map(e=>e.id));const entrySourceIds=entries.map(e=>e.sourceEventId);const entryIds=new Set(entrySourceIds);
 const counts=new Map<string,number>();for(const id of entrySourceIds)counts.set(id,(counts.get(id)??0)+1);
 return Object.freeze({
  missingLedgerEventIds:Object.freeze(events.filter(e=>!entryIds.has(e.id)).map(e=>e.id)),
  orphanLedgerEntryIds:Object.freeze(entries.filter(e=>!eventIds.has(e.sourceEventId)).map(e=>e.id)),
  duplicateSourceEventIds:Object.freeze([...counts.entries()].filter(([,count])=>count>1).map(([id])=>id)),
 });
}
interface MeterEventRow extends Record<string,unknown>{fingerprint:string;ledger_payload:LedgerEntry|string}
const decodeLedger=(v:LedgerEntry|string):LedgerEntry=>typeof v==="string"?JSON.parse(v) as LedgerEntry:v;
export class PostgresUsageLedger {
 constructor(private readonly db:SqlDatabase){}
 async record(event:UsageEvent,rate:number,currency:string):Promise<{entry:LedgerEntry;replayed:boolean}>{
  if(!event.id||!event.tenantId||!event.actorId||!event.idempotencyKey||!event.unit||Number.isNaN(Date.parse(event.occurredAt))||!/^[A-Z]{3}$/.test(currency))throw new Error("USAGE_EVENT_INVALID");
  const fingerprint=JSON.stringify([event,rate,currency]);const entry=priceUsage(event,rate,currency);
  return this.db.transaction(async tx=>{
   await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[event.tenantId+":"+event.idempotencyKey]);
   const prior=await tx.query<MeterEventRow>("select fingerprint, ledger_payload from usage_meter_events where tenant_id=$1 and idempotency_key=$2 for update",[event.tenantId,event.idempotencyKey]);
   if(prior.rows[0]){
    if(prior.rows[0].fingerprint!==fingerprint)throw new Error("USAGE_IDEMPOTENCY_CONFLICT");
    return {entry:decodeLedger(prior.rows[0].ledger_payload),replayed:true};
   }
   await tx.query("insert into usage_meter_events (tenant_id,idempotency_key,event_id,fingerprint,payload,ledger_entry_id,ledger_payload) values ($1,$2,$3,$4,$5::jsonb,$6,$7::jsonb)",[event.tenantId,event.idempotencyKey,event.id,fingerprint,JSON.stringify(event),entry.id,JSON.stringify(entry)]);
   await tx.query("insert into usage_ledger_entries (tenant_id,entry_id,source_event_id,payload) values ($1,$2,$3,$4::jsonb)",[event.tenantId,entry.id,event.id,JSON.stringify(entry)]);
   return {entry,replayed:false};
  });
 }
 async list(tenantId:string):Promise<readonly LedgerEntry[]>{
  const r=await this.db.query<{payload:LedgerEntry|string}>("select payload from usage_ledger_entries where tenant_id=$1 order by created_at,entry_id",[tenantId]);
  return Object.freeze(r.rows.map(row=>decodeLedger(row.payload)));
 }
}
