import { randomUUID } from "node:crypto";
import type { SqlDatabase } from "../persistence/sql.ts";
export type AuthorizationEffect = "allow" | "deny";
export type AuthorizationAttributes = Readonly<Record<string,string|number|boolean>>;
export interface AuthorizationRole { tenantId:string; id:string; name:string; permissions:readonly string[]; createdBy:string }
export interface AuthorizationConditions { actor?:AuthorizationAttributes; resource?:AuthorizationAttributes }
export interface AuthorizationGrant {
 tenantId:string; id:string; actorId:string; roleId:string; effect:AuthorizationEffect; workspaceId?:string;
 resourceType?:string; resourceId?:string; conditions:AuthorizationConditions; grantedBy:string; grantedAt:string;
 expiresAt?:string; revokedAt?:string;
}
export interface AuthorizationResource { tenantId:string; type:string; id:string; workspaceId?:string; ownerId?:string; attributes:AuthorizationAttributes }
export interface AuthorizationPrincipal { tenantId:string; actorId:string; attributes:AuthorizationAttributes }
export interface AuthorizationDecision {
 id:string; tenantId:string; actorId:string; action:string; resourceType:string; resourceId:string;
 allowed:boolean; reason:"ALLOW"|"EXPLICIT_DENY"|"NO_MATCHING_GRANT"; matchedGrantIds:readonly string[]; evaluatedAt:string;
}
export interface AuthorizationStore {
 createRole(role:AuthorizationRole):Promise<void>;
 grant(input:Omit<AuthorizationGrant,"grantedAt"|"revokedAt">,now?:Date):Promise<AuthorizationGrant>;
 revoke(tenantId:string,grantId:string,revokedBy:string,now?:Date):Promise<boolean>;
 effectiveGrants(tenantId:string,actorId:string,now?:Date):Promise<readonly (AuthorizationGrant & {permissions:readonly string[]})[]>;
 recordDecision(decision:AuthorizationDecision):Promise<void>;
}
const validId=(v:string)=>/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,127}$/.test(v);
const validPermission=(v:string)=>v==="*"||/^[a-z][a-z0-9_-]*(?:\.[a-z][a-z0-9_-]*)*(?:\.\*)?$/.test(v);
function validConditions(c:AuthorizationConditions):boolean {
 return Object.entries(c.actor??{}).every(([k,v])=>!!k&&["string","number","boolean"].includes(typeof v))
 && Object.entries(c.resource??{}).every(([k,v])=>!!k&&["string","number","boolean"].includes(typeof v));
}
function matches(expected:AuthorizationAttributes|undefined,actual:AuthorizationAttributes):boolean {
 return Object.entries(expected??{}).every(([k,v])=>actual[k]===v);
}
function hasPermission(permissions:readonly string[],action:string):boolean {
 return permissions.some(p=>p==="*"||p===action||(p.endsWith(".*")&&action.startsWith(p.slice(0,-1))));
}
function matchesGrant(g:AuthorizationGrant,r:AuthorizationResource,p:AuthorizationPrincipal):boolean {
 return (!g.workspaceId||g.workspaceId===r.workspaceId)&&(!g.resourceType||g.resourceType===r.type)
 &&(!g.resourceId||g.resourceId===r.id)&&matches(g.conditions.actor,p.attributes)&&matches(g.conditions.resource,{...r.attributes,...(r.ownerId?{ownerId:r.ownerId}:{})});
}
export async function evaluateAuthorization(store:AuthorizationStore,principal:AuthorizationPrincipal,action:string,resource:AuthorizationResource,now=new Date()):Promise<AuthorizationDecision>{
 if(!validId(principal.tenantId)||!validId(principal.actorId)||!action||!resource.type||!resource.id)throw new Error("AUTHORIZATION_CONTEXT_INVALID");
 const base={id:randomUUID(),tenantId:principal.tenantId,actorId:principal.actorId,action,resourceType:resource.type,resourceId:resource.id,evaluatedAt:now.toISOString()};
 const grants=principal.tenantId===resource.tenantId?await store.effectiveGrants(principal.tenantId,principal.actorId,now):[];
 const matching=grants.filter(g=>matchesGrant(g,resource,principal)&&hasPermission(g.permissions,action));
 const deny=matching.some(g=>g.effect==="deny"),allow=matching.some(g=>g.effect==="allow");
 const decision:AuthorizationDecision={...base,allowed:allow&&!deny,reason:deny?"EXPLICIT_DENY":allow?"ALLOW":"NO_MATCHING_GRANT",matchedGrantIds:Object.freeze(matching.map(g=>g.id))};
 await store.recordDecision(decision);
 return decision;
}
interface GrantRow extends Record<string,unknown>{
 tenant_id:string;grant_id:string;actor_id:string;role_id:string;effect:AuthorizationEffect;workspace_id:string|null;
 resource_type:string|null;resource_id:string|null;conditions:AuthorizationConditions|string;granted_by:string;
 granted_at:Date|string;expires_at:Date|string|null;revoked_at:Date|string|null;permissions:string[];
}
const iso=(v:Date|string|null):string|undefined=>v===null?undefined:v instanceof Date?v.toISOString():new Date(v).toISOString();
const conditions=(v:AuthorizationConditions|string):AuthorizationConditions=>typeof v==="string"?JSON.parse(v) as AuthorizationConditions:v;
export class PostgresAuthorizationStore implements AuthorizationStore {
 constructor(private readonly db:SqlDatabase){}
 async createRole(role:AuthorizationRole):Promise<void>{
  if(!validId(role.tenantId)||!validId(role.id)||!role.name.trim()||!validId(role.createdBy)||!role.permissions.length
   ||role.permissions.some(p=>!validPermission(p))||new Set(role.permissions).size!==role.permissions.length)throw new Error("AUTHORIZATION_ROLE_INVALID");
  await this.db.query("insert into authorization_roles (tenant_id,role_id,name,permissions,created_by) values ($1,$2,$3,$4,$5)",[role.tenantId,role.id,role.name.trim(),[...role.permissions],role.createdBy]);
 }
 async grant(input:Omit<AuthorizationGrant,"grantedAt"|"revokedAt">,now=new Date()):Promise<AuthorizationGrant>{
  if(!validId(input.tenantId)||!validId(input.id)||!validId(input.actorId)||!validId(input.roleId)||!validId(input.grantedBy)
   ||!["allow","deny"].includes(input.effect)||!validConditions(input.conditions)||(input.resourceId&&!input.resourceType)
   ||(input.expiresAt&&(Number.isNaN(Date.parse(input.expiresAt))||Date.parse(input.expiresAt)<=now.getTime())))throw new Error("AUTHORIZATION_GRANT_INVALID");
  const g=Object.freeze({...input,grantedAt:now.toISOString()});
  await this.db.query("insert into authorization_grants (tenant_id,grant_id,actor_id,role_id,effect,workspace_id,resource_type,resource_id,conditions,granted_by,granted_at,expires_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10,$11,$12)",[g.tenantId,g.id,g.actorId,g.roleId,g.effect,g.workspaceId??null,g.resourceType??null,g.resourceId??null,JSON.stringify(g.conditions),g.grantedBy,g.grantedAt,g.expiresAt??null]);
  return g;
 }
 async revoke(tenantId:string,grantId:string,revokedBy:string,now=new Date()):Promise<boolean>{
  if(!validId(tenantId)||!validId(grantId)||!validId(revokedBy))throw new Error("AUTHORIZATION_REVOKER_INVALID");
  const r=await this.db.query("update authorization_grants set revoked_at=$3 where tenant_id=$1 and grant_id=$2 and revoked_at is null",[tenantId,grantId,now.toISOString()]);
  return r.rowCount===1;
 }
 async effectiveGrants(tenantId:string,actorId:string,now=new Date()):Promise<readonly (AuthorizationGrant&{permissions:readonly string[]})[]>{
  const r=await this.db.query<GrantRow>("select g.tenant_id,g.grant_id,g.actor_id,g.role_id,g.effect,g.workspace_id,g.resource_type,g.resource_id,g.conditions,g.granted_by,g.granted_at,g.expires_at,g.revoked_at,r.permissions from authorization_grants g join authorization_roles r on r.tenant_id=g.tenant_id and r.role_id=g.role_id where g.tenant_id=$1 and g.actor_id=$2 and g.revoked_at is null and (g.expires_at is null or g.expires_at>$3)",[tenantId,actorId,now.toISOString()]);
  return Object.freeze(r.rows.map(row=>({tenantId:row.tenant_id,id:row.grant_id,actorId:row.actor_id,roleId:row.role_id,effect:row.effect,
   ...(row.workspace_id?{workspaceId:row.workspace_id}:{}),...(row.resource_type?{resourceType:row.resource_type}:{}),...(row.resource_id?{resourceId:row.resource_id}:{}),
   conditions:conditions(row.conditions),grantedBy:row.granted_by,grantedAt:iso(row.granted_at)!,...(iso(row.expires_at)?{expiresAt:iso(row.expires_at)}:{}),
   ...(iso(row.revoked_at)?{revokedAt:iso(row.revoked_at)}:{}),permissions:row.permissions})));
 }
 async recordDecision(d:AuthorizationDecision):Promise<void>{
  await this.db.query("insert into authorization_decisions (tenant_id,decision_id,actor_id,action,resource_type,resource_id,allowed,reason,matched_grant_ids,evaluated_at) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[d.tenantId,d.id,d.actorId,d.action,d.resourceType,d.resourceId,d.allowed,d.reason,[...d.matchedGrantIds],d.evaluatedAt]);
 }
}
