import { createHash } from "node:crypto";
import type { SqlDatabase } from "./sql.ts";
export interface Migration { id:string; sql:string; checksum?:string }
export interface MigrationResult { applied:readonly string[]; skipped:readonly string[] }
function checksum(sql:string):string{return createHash("sha256").update(sql,"utf8").digest("hex")}
export async function applyMigrations(db:SqlDatabase,migrations:readonly Migration[]):Promise<MigrationResult>{
 const ids=new Set<string>();for(const m of migrations){if(!/^\d{4}_[a-z0-9_]+\.sql$/.test(m.id)||!m.sql.trim()||ids.has(m.id))throw new Error("MIGRATION_MANIFEST_INVALID");ids.add(m.id);if(m.checksum&&m.checksum!==checksum(m.sql))throw new Error("MIGRATION_CHECKSUM_INVALID:"+m.id);}
 await db.query("create table if not exists schema_migrations (migration_id text primary key, checksum char(64) not null, applied_at timestamptz not null default now())");
 const applied:string[]=[];const skipped:string[]=[];
 for(const migration of [...migrations].sort((a,b)=>a.id.localeCompare(b.id))){
  const digest=checksum(migration.sql);
  const outcome=await db.transaction(async tx=>{
   await tx.query("select pg_advisory_xact_lock(hashtextextended('outcome-platform-migrations',0))");
   const prior=await tx.query<{checksum:string}>("select checksum from schema_migrations where migration_id=$1 for update",[migration.id]);
   if(prior.rows[0]){if(prior.rows[0].checksum!==digest)throw new Error("MIGRATION_CHECKSUM_DRIFT:"+migration.id);return "skipped" as const;}
   await tx.query(migration.sql);
   await tx.query("insert into schema_migrations (migration_id,checksum) values ($1,$2)",[migration.id,digest]);
   return "applied" as const;
  });
  (outcome==="applied"?applied:skipped).push(migration.id);
 }
 return Object.freeze({applied:Object.freeze(applied),skipped:Object.freeze(skipped)});
}
