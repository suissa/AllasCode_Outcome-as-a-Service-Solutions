import { createHash } from "node:crypto";
import type { OutcomeResult } from "../outcomes/settlement.ts";
import type { SqlDatabase } from "../persistence/sql.ts";
import { AUDIT_GENESIS_HASH, canonicalJson, createAuditEvent } from "../domain/audit.ts";
export interface CalculationSnapshot { id:string; tenantId:string; outcomeId:string; specVersion:number; methodVersion:string; inputEvidenceHashes:string[]; result:OutcomeResult; calculatedAt:string }
export interface SnapshotAuditContext { actorId:string; correlationId:string }
export interface StoredCalculationSnapshot extends CalculationSnapshot { fingerprint:string; sequence:number; replayed:boolean }
interface SnapshotRow extends Record<string,unknown>{tenant_id:string;snapshot_id:string;fingerprint:string;payload:CalculationSnapshot|string}
interface LedgerRow extends Record<string,unknown>{tenant_id:string;sequence:number|string;event_id:string;event_type:"audit"|"decision";previous_hash:string;event_hash:string;payload:unknown|string}
const required=(value:string)=>typeof value==="string"&&value.trim().length>0;
export function createCalculationSnapshot(s:Omit<CalculationSnapshot,"calculatedAt">,at=new Date()):CalculationSnapshot{
 if(!required(s.id)||!required(s.tenantId)||!required(s.outcomeId)||!Number.isInteger(s.specVersion)||s.specVersion<1||!required(s.methodVersion)||!Number.isFinite(at.getTime()))throw new Error("SNAPSHOT_METADATA_INVALID");
 if(!s.inputEvidenceHashes.length||s.inputEvidenceHashes.some(h=>!/^([a-f0-9]{64}|sha256:[a-f0-9]{64})$/i.test(h))||new Set(s.inputEvidenceHashes).size!==s.inputEvidenceHashes.length)throw new Error("SNAPSHOT_EVIDENCE_REQUIRED");
 if(![s.result.baseline,s.result.target,s.result.observed,s.result.absoluteChange,s.result.targetProgress,s.result.confidence].every(Number.isFinite)||s.result.confidence<0||s.result.confidence>1||typeof s.result.achieved!=="boolean")throw new Error("SNAPSHOT_RESULT_INVALID");
 const snapshot={...s,inputEvidenceHashes:[...s.inputEvidenceHashes],result:{...s.result},calculatedAt:at.toISOString()};canonicalJson(snapshot);return Object.freeze(snapshot);
}
export function snapshotFingerprint(s:CalculationSnapshot):string{
 const payload={id:s.id,tenantId:s.tenantId,outcomeId:s.outcomeId,specVersion:s.specVersion,methodVersion:s.methodVersion,inputEvidenceHashes:[...s.inputEvidenceHashes].sort(),result:s.result};
 return createHash("sha256").update(canonicalJson(payload),"utf8").digest("hex");
}
const decode=<T>(value:T|string):T=>typeof value==="string"?JSON.parse(value) as T:value;
function auditHash(input:{tenantId:string;sequence:number;previousHash:string;eventType:"audit"|"decision";eventId:string;payload:unknown}):string{return createHash("sha256").update(canonicalJson(input),"utf8").digest("hex")}
export class PostgresCalculationSnapshotStore{
 constructor(private readonly db:SqlDatabase){}
 async save(snapshot:CalculationSnapshot,context:SnapshotAuditContext):Promise<StoredCalculationSnapshot>{
  if(!required(context.actorId)||!required(context.correlationId))throw new Error("SNAPSHOT_AUDIT_CONTEXT_REQUIRED");
  const fingerprint=snapshotFingerprint(snapshot);const serialized=canonicalJson(snapshot);const auditEventId="snapshot:"+snapshot.id;
  return this.db.transaction(async tx=>{
   await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",["audit-ledger:"+snapshot.tenantId]);
   const existing=await tx.query<SnapshotRow>("select tenant_id,snapshot_id,fingerprint,payload from calculation_snapshots where tenant_id=$1 and snapshot_id=$2",[snapshot.tenantId,snapshot.id]);
   if(existing.rows[0]){
    const row=existing.rows[0];if(row.fingerprint!==fingerprint||canonicalJson(decode(row.payload))!==serialized)throw new Error("SNAPSHOT_ID_CONFLICT");
    const ledger=await tx.query<LedgerRow>("select tenant_id,sequence,event_id,event_type,previous_hash,event_hash,payload from audit_event_ledger where tenant_id=$1 and event_id=$2",[snapshot.tenantId,auditEventId]);
    if(!ledger.rows[0]||ledger.rows[0].event_type!=="audit")throw new Error("SNAPSHOT_AUDIT_RECORD_MISSING");
    return Object.freeze({...decode(row.payload),fingerprint,sequence:Number(ledger.rows[0].sequence),replayed:true});
   }
   await tx.query("insert into calculation_snapshots (tenant_id,snapshot_id,outcome_id,fingerprint,payload,calculated_at) values ($1,$2,$3,$4,$5::jsonb,$6)",[snapshot.tenantId,snapshot.id,snapshot.outcomeId,fingerprint,serialized,snapshot.calculatedAt]);
   const event=createAuditEvent({id:auditEventId,tenantId:snapshot.tenantId,actorId:context.actorId,action:"calculation.snapshot.persisted",subjectType:"calculation_snapshot",subjectId:snapshot.id,correlationId:context.correlationId,metadata:{outcomeId:snapshot.outcomeId,fingerprint,specVersion:snapshot.specVersion,methodVersion:snapshot.methodVersion}},new Date(snapshot.calculatedAt));
   const ledgerHead=await tx.query<LedgerRow>("select tenant_id,sequence,event_id,event_type,previous_hash,event_hash,payload from audit_event_ledger where tenant_id=$1 order by sequence desc limit 1",[snapshot.tenantId]);
   const sequence=Number(ledgerHead.rows[0]?.sequence??0)+1;const previousHash=ledgerHead.rows[0]?.event_hash??AUDIT_GENESIS_HASH;
   const eventHash=auditHash({tenantId:snapshot.tenantId,sequence,previousHash,eventType:"audit",eventId:event.id,payload:event});
   await tx.query("insert into audit_event_ledger (tenant_id,sequence,event_id,event_type,previous_hash,event_hash,payload) values ($1,$2,$3,'audit',$4,$5,$6::jsonb)",[snapshot.tenantId,sequence,event.id,previousHash,eventHash,canonicalJson(event)]);
   return Object.freeze({...snapshot,fingerprint,sequence,replayed:false});
  });
 }
 async get(tenantId:string,snapshotId:string):Promise<CalculationSnapshot|null>{
  if(!required(tenantId)||!required(snapshotId))throw new Error("SNAPSHOT_LOOKUP_SCOPE_REQUIRED");
  const result=await this.db.query<SnapshotRow>("select tenant_id,snapshot_id,fingerprint,payload from calculation_snapshots where tenant_id=$1 and snapshot_id=$2",[tenantId,snapshotId]);
  const row=result.rows[0];if(!row)return null;const snapshot=decode(row.payload);
  if(row.tenant_id!==tenantId||snapshot.tenantId!==tenantId||snapshot.id!==snapshotId||snapshotFingerprint(snapshot)!==row.fingerprint)throw new Error("SNAPSHOT_INTEGRITY_FAILED");
  return Object.freeze(snapshot);
 }
 async list(tenantId:string,outcomeId:string):Promise<readonly CalculationSnapshot[]>{
  if(!required(tenantId)||!required(outcomeId))throw new Error("SNAPSHOT_LOOKUP_SCOPE_REQUIRED");
  const result=await this.db.query<SnapshotRow>("select tenant_id,snapshot_id,fingerprint,payload from calculation_snapshots where tenant_id=$1 and outcome_id=$2 order by calculated_at,snapshot_id",[tenantId,outcomeId]);
  return Object.freeze(result.rows.map(row=>{const snapshot=decode(row.payload);if(row.tenant_id!==tenantId||snapshot.tenantId!==tenantId||snapshotFingerprint(snapshot)!==row.fingerprint)throw new Error("SNAPSHOT_INTEGRITY_FAILED");return Object.freeze(snapshot)}));
 }
}
