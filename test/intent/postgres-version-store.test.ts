import test from "node:test";
import assert from "node:assert/strict";
import { PostgresIntentVersionStore } from "../../src/intent/postgres-version-store.ts";
import type { SqlDatabase, SqlExecutor } from "../../src/persistence/sql.ts";
import type { IntentVersion } from "../../src/intent/versioning.ts";
test("PostgreSQL intent version store enforces append-only contiguous versions",async()=>{
 const stored:IntentVersion[]=[];const tx:SqlExecutor={query:async<T extends Record<string,unknown>>(sql:string,params:readonly unknown[]=[]):Promise<{rows:T[];rowCount:number}>=>{
  if(sql.includes("select version from intent_versions"))return{rows:(stored.length?[{version:stored[stored.length-1]!.version}]:[]) as unknown as T[],rowCount:stored.length?1:0};
  if(sql.includes("insert into intent_versions")){stored.push(JSON.parse(String(params[3])) as IntentVersion);return{rows:[],rowCount:1};}
  if(sql.includes("select payload from intent_versions"))return{rows:stored.map(payload=>({payload})) as unknown as T[],rowCount:stored.length};
  return{rows:[],rowCount:1};
 }};
 const db:SqlDatabase={query:tx.query,transaction:async<T>(work:(executor:SqlExecutor)=>Promise<T>)=>work(tx)};
 const store=new PostgresIntentVersionStore(db);
 const snapshot={id:"intent_001",tenantId:"tenant_001",actorId:"actor_001",statement:"Improve conversion",desiredOutcome:"conversion",scope:["checkout"],constraints:[],status:"draft" as const,version:1,provenance:{channel:"web" as const,sourceId:"form",capturedAt:"2026-11-08T00:00:00Z"},createdAt:"2026-11-08T00:00:00Z"};
 await store.append({intentId:snapshot.id,version:1,snapshot,changedBy:"actor_001",changedAt:snapshot.createdAt,changeReason:"initial capture"});
 await assert.rejects(()=>store.append({intentId:snapshot.id,version:3,snapshot:{...snapshot,version:3},changedBy:"actor_001",changedAt:snapshot.createdAt,changeReason:"skip"}),/INTENT_VERSION_CONFLICT/);
 assert.equal((await store.history("tenant_001",snapshot.id)).length,1);
});
