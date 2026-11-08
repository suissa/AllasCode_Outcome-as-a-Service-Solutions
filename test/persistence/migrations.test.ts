import test from "node:test";
import assert from "node:assert/strict";
import { applyMigrations } from "../../src/persistence/migrations.ts";
import type { SqlDatabase, SqlExecutor } from "../../src/persistence/sql.ts";
test("migration runner applies in order and skips matching checksums",async()=>{
 const rows=new Map<string,string>();const statements:string[]=[];
 const tx:SqlExecutor={query:async<T extends Record<string,unknown>>(sql:string,params:readonly unknown[]=[]):Promise<{rows:T[];rowCount:number}>=>{
  statements.push(sql);
  if(sql.includes("select checksum")){const checksum=rows.get(String(params[0]));return{rows:(checksum?[{checksum}]:[]) as unknown as T[],rowCount:checksum?1:0};}
  if(sql.includes("insert into schema_migrations")){rows.set(String(params[0]),String(params[1]));return{rows:[],rowCount:1};}
  return{rows:[],rowCount:1};
 }};
 const db:SqlDatabase={query:tx.query,transaction:async<T>(work:(executor:SqlExecutor)=>Promise<T>)=>work(tx)};
 const migrations=[{id:"0002_workflow_tasks.sql",sql:"create table workflow_tasks (id text)"},{id:"0001_outcome_platform.sql",sql:"create table outcome_cases (id text)"}];
 const first=await applyMigrations(db,migrations);assert.deepEqual(first.applied,["0001_outcome_platform.sql","0002_workflow_tasks.sql"]);
 const second=await applyMigrations(db,migrations);assert.equal(second.skipped.length,2);
 await assert.rejects(()=>applyMigrations(db,[{id:"0001_outcome_platform.sql",sql:"different"}]),/MIGRATION_CHECKSUM_DRIFT/);
});
test("migration runner rejects duplicate and malformed migration IDs",async()=>{
 const db={} as SqlDatabase;
 await assert.rejects(()=>applyMigrations(db,[{id:"bad",sql:"select 1"}]),/MIGRATION_MANIFEST_INVALID/);
});
