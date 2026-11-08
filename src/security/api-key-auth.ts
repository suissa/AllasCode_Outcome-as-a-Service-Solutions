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
