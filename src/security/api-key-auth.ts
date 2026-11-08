import { createHash, timingSafeEqual } from "node:crypto";
import type { IncomingMessage } from "node:http";
import type { AuthenticatedActor, Authenticate, Authorize } from "../http/server.ts";
export interface ApiKeyRecord { keyId:string; tenantId:string; actorId:string; secretHash:string; scopes:readonly string[]; expiresAt?:string; revokedAt?:string }
export interface ApiKeyStore { getKey(keyId:string):Promise<ApiKeyRecord|undefined> }
export function hashApiKeySecret(secret:string):string { return createHash("sha256").update(secret,"utf8").digest("hex"); }
function constantTimeHexEqual(left:string,right:string):boolean {
  if(!/^[a-f0-9]{64}$/i.test(left)||!/^[a-f0-9]{64}$/i.test(right))return false;
  return timingSafeEqual(Buffer.from(left,"hex"),Buffer.from(right,"hex"));
}
export function createApiKeyAuthenticator(store:ApiKeyStore,now=()=>new Date()):Authenticate {
  return async (request:IncomingMessage):Promise<AuthenticatedActor|undefined>=>{
    const header=request.headers.authorization;
    if(typeof header!=="string"||!header.startsWith("Bearer "))return undefined;
    const token=header.slice(7).trim();const separator=token.indexOf(".");
    if(separator<1||separator===token.length-1)return undefined;
    const keyId=token.slice(0,separator);const secret=token.slice(separator+1);
    const record=await store.getKey(keyId);if(!record)return undefined;
    if(record.revokedAt||record.expiresAt&&Date.parse(record.expiresAt)<=now().getTime())return undefined;
    if(!constantTimeHexEqual(record.secretHash,hashApiKeySecret(secret)))return undefined;
    return Object.freeze({tenantId:record.tenantId,actorId:record.actorId,roles:Object.freeze([...record.scopes])});
  };
}
export function createScopeAuthorizer():Authorize {
  return (actor,action,resource)=>{
    if(resource&&resource.tenantId!==actor.tenantId)return false;
    return actor.roles.includes("*")||actor.roles.includes(action)||actor.roles.includes(action.split(".")[0]+".*");
  };
}

import type { SqlDatabase } from "../persistence/sql.ts";
interface ApiKeyRow extends Record<string, unknown> { key_id:string; tenant_id:string; actor_id:string; secret_hash:string; scopes:string[]; expires_at:Date|string|null; revoked_at:Date|string|null }
export class PostgresApiKeyStore implements ApiKeyStore {
  constructor(private readonly db:SqlDatabase){}
  async getKey(keyId:string):Promise<ApiKeyRecord|undefined>{
    const r=await this.db.query<ApiKeyRow>("select key_id,tenant_id,actor_id,secret_hash,scopes,expires_at,revoked_at from api_keys where key_id=$1",[keyId]);
    const row=r.rows[0];if(!row)return undefined;
    const date=(value:Date|string|null|undefined)=>value===null||value===undefined?undefined:value instanceof Date?value.toISOString():new Date(value).toISOString();
    return {keyId:row.key_id,tenantId:row.tenant_id,actorId:row.actor_id,secretHash:row.secret_hash,scopes:row.scopes,...(date(row.expires_at)?{expiresAt:date(row.expires_at)}:{}),...(date(row.revoked_at)?{revokedAt:date(row.revoked_at)}:{})};
  }
  async createKey(record:ApiKeyRecord):Promise<void>{
    if(!record.keyId||!record.tenantId||!record.actorId||!/^[a-f0-9]{64}$/i.test(record.secretHash)||!record.scopes.length)throw new Error("API_KEY_RECORD_INVALID");
    await this.db.query("insert into api_keys (key_id,tenant_id,actor_id,secret_hash,scopes,expires_at,revoked_at) values ($1,$2,$3,$4,$5,$6,$7)",[record.keyId,record.tenantId,record.actorId,record.secretHash,[...record.scopes],record.expiresAt??null,record.revokedAt??null]);
  }
  async revokeKey(tenantId:string,keyId:string,at=new Date()):Promise<boolean>{
    const r=await this.db.query("update api_keys set revoked_at=$3 where tenant_id=$1 and key_id=$2 and revoked_at is null",[tenantId,keyId,at.toISOString()]);return r.rowCount===1;
  }
}
