import type { SqlDatabase } from "../persistence/sql.ts";
import type { IntentVersion } from "./versioning.ts";
export interface IntentVersionStore { append(version:IntentVersion):Promise<void>; history(tenantId:string,intentId:string):Promise<readonly IntentVersion[]> }
interface IntentVersionRow extends Record<string,unknown>{payload:IntentVersion|string}
const decode=(value:IntentVersion|string):IntentVersion=>typeof value==="string"?JSON.parse(value) as IntentVersion:value;
export class PostgresIntentVersionStore implements IntentVersionStore {
 constructor(private readonly db:SqlDatabase){}
 async append(version:IntentVersion):Promise<void>{
  const tenantId=version.snapshot.tenantId;
  if(!tenantId||version.intentId!==version.snapshot.id||version.version!==version.snapshot.version)throw new Error("INTENT_VERSION_SCOPE_INVALID");
  await this.db.transaction(async tx=>{
   await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))",[tenantId+":"+version.intentId]);
   const r=await tx.query<{version:number}>("select version from intent_versions where tenant_id=$1 and intent_id=$2 order by version desc limit 1 for update",[tenantId,version.intentId]);
   const latest=r.rows[0]?.version??0;
   if(version.version!==latest+1)throw new Error("INTENT_VERSION_CONFLICT");
   await tx.query("insert into intent_versions (tenant_id,intent_id,version,payload) values ($1,$2,$3,$4::jsonb)",[tenantId,version.intentId,version.version,JSON.stringify(version)]);
  });
 }
 async history(tenantId:string,intentId:string):Promise<readonly IntentVersion[]>{
  const r=await this.db.query<IntentVersionRow>("select payload from intent_versions where tenant_id=$1 and intent_id=$2 order by version",[tenantId,intentId]);
  return Object.freeze(r.rows.map(row=>decode(row.payload)));
 }
}
