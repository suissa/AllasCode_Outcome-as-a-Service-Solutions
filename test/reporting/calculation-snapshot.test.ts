import test from "node:test";
import assert from "node:assert/strict";
import { createCalculationSnapshot, snapshotFingerprint, PostgresCalculationSnapshotStore } from "../../src/reporting/snapshot.ts";
import type { OutcomeResult } from "../../src/outcomes/settlement.ts";
import type { SqlDatabase, SqlExecutor } from "../../src/persistence/sql.ts";
const result:OutcomeResult={baseline:100,target:150,observed:160,absoluteChange:60,targetProgress:1,confidence:.92,achieved:true};
const makeSnapshot=(id="snapshot_1",tenantId="tenant_1")=>createCalculationSnapshot({id,tenantId,outcomeId:"outcome_1",specVersion:2,methodVersion:"revenue-v2",inputEvidenceHashes:["a".repeat(64)],result},new Date("2026-11-09T12:00:00Z"));
class MemoryDb implements SqlDatabase {
 readonly snapshots=new Map<string,{tenant_id:string;snapshot_id:string;fingerprint:string;payload:unknown}>();
 readonly ledger=new Map<string,{tenantId:string;sequence:number;eventId:string;eventType:string;previousHash:string;eventHash:string;payload:unknown}[]>();
 async query<T extends Record<string,unknown>>(sql:string,p:readonly unknown[]=[]):Promise<{rows:T[];rowCount:number}>{
  if(sql.includes("from calculation_snapshots")){const rows=[...(this.snapshots.values())].filter(r=>r.tenant_id===p[0]).map(r=>({tenant_id:r.tenant_id,snapshot_id:r.snapshot_id,fingerprint:r.fingerprint,payload:r.payload}));return{rows:rows as unknown as T[],rowCount:rows.length};}
  if(sql.includes("from audit_event_ledger")){const rows=this.ledger.get(String(p[0]))??[];return{rows:rows as unknown as T[],rowCount:rows.length};}
  throw new Error("UNEXPECTED_QUERY:"+sql);
 }
 async transaction<T>(work:(tx:SqlExecutor)=>Promise<T>):Promise<T>{
  const tx:SqlExecutor={query:async<R extends Record<string,unknown>>(sql:string,p:readonly unknown[]=[]):Promise<{rows:R[];rowCount:number}>=>{
   const tenant=String(p[0]??"");
   if(sql.includes("pg_advisory_xact_lock"))return{rows:[],rowCount:1};
   if(sql.includes("from calculation_snapshots where tenant_id=$1 and snapshot_id=$2")){const r=this.snapshots.get(tenant+":"+String(p[1]));return{rows:(r?[r]:[]) as unknown as R[],rowCount:r?1:0};}
   if(sql.includes("from audit_event_ledger where tenant_id=$1 and event_id=$2")){const r=(this.ledger.get(tenant)??[]).find(x=>x.eventId===p[1]);return{rows:(r?[{tenant_id:r.tenantId,sequence:r.sequence,event_id:r.eventId,event_type:r.eventType,previous_hash:r.previousHash,event_hash:r.eventHash,payload:r.payload}]:[]) as unknown as R[],rowCount:r?1:0};}
   if(sql.includes("from audit_event_ledger where tenant_id=$1 order by sequence desc")){const rows=this.ledger.get(tenant)??[];const r=rows.at(-1);return{rows:(r?[{tenant_id:r.tenantId,sequence:r.sequence,event_id:r.eventId,event_type:r.eventType,previous_hash:r.previousHash,event_hash:r.eventHash,payload:r.payload}]:[]) as unknown as R[],rowCount:r?1:0};}
   if(sql.startsWith("insert into calculation_snapshots")){const row={tenant_id:tenant,snapshot_id:String(p[1]),fingerprint:String(p[3]),payload:JSON.parse(String(p[4]))};this.snapshots.set(tenant+":"+row.snapshot_id,row);return{rows:[],rowCount:1};}
   if(sql.startsWith("insert into audit_event_ledger")){const rows=this.ledger.get(tenant)??[];rows.push({tenantId:tenant,sequence:Number(p[1]),eventId:String(p[2]),eventType:"audit",previousHash:String(p[3]),eventHash:String(p[4]),payload:JSON.parse(String(p[5]))});this.ledger.set(tenant,rows);return{rows:[],rowCount:1};}
   throw new Error("UNEXPECTED_SQL:"+sql);
  }};
  return work(tx);
 }
}
test("calculation snapshots bind tenant, methodology and evidence into deterministic fingerprints",()=>{
 const first=makeSnapshot();const reordered={...first,result:{...first.result}};assert.equal(snapshotFingerprint(first),snapshotFingerprint(reordered));
 assert.notEqual(snapshotFingerprint(first),snapshotFingerprint({...first,methodVersion:"revenue-v3"}));
 assert.notEqual(snapshotFingerprint(first),snapshotFingerprint({...first,tenantId:"tenant_2"}));
 assert.throws(()=>createCalculationSnapshot({...first,inputEvidenceHashes:["bad"]}),/SNAPSHOT_EVIDENCE_REQUIRED/);
 assert.throws(()=>createCalculationSnapshot({...first,tenantId:""}),/SNAPSHOT_METADATA_INVALID/);
});
test("snapshot store is tenant-scoped, idempotent and writes an audit ledger event atomically",async()=>{
 const db=new MemoryDb();const store=new PostgresCalculationSnapshotStore(db);const snapshot=makeSnapshot();
 const first=await store.save(snapshot,{actorId:"actor_1",correlationId:"corr_1"});
 assert.equal(first.replayed,false);assert.equal(first.sequence,1);
 const replay=await store.save(snapshot,{actorId:"actor_1",correlationId:"corr_1"});
 assert.equal(replay.replayed,true);assert.equal(replay.fingerprint,first.fingerprint);
 await assert.rejects(()=>store.save({...snapshot,result:{...snapshot.result,observed:170}},{actorId:"actor_1",correlationId:"corr_2"}),/SNAPSHOT_ID_CONFLICT/);
 assert.equal(await store.get("tenant_1",snapshot.id)!==null,true);
 assert.equal(await store.get("tenant_2",snapshot.id),null);
 const other=makeSnapshot("snapshot_2","tenant_2");await store.save(other,{actorId:"actor_2",correlationId:"corr_2"});
 assert.equal((await store.list("tenant_1","outcome_1")).length,1);
});
