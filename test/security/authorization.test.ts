import test from "node:test";
import assert from "node:assert/strict";
import { evaluateAuthorization,PostgresAuthorizationStore,type AuthorizationGrant,type AuthorizationRole } from "../../src/security/authorization.ts";
import type { SqlDatabase,SqlExecutor } from "../../src/persistence/sql.ts";
test("persistent RBAC/ABAC scopes roles, workspace, attributes and deny precedence",async()=>{
 const roles=new Map<string,AuthorizationRole>(),grants=new Map<string,AuthorizationGrant&{permissions:readonly string[]}>(),decisions:unknown[]=[];
 const key=(t:string,id:string)=>t+":"+id;
 const executor:SqlExecutor={query:async<T extends Record<string,unknown>>(sql:string,p:readonly unknown[]=[]):Promise<{rows:T[];rowCount:number}>=>{
  if(sql.includes("insert into authorization_roles")){const r={tenantId:String(p[0]),id:String(p[1]),name:String(p[2]),permissions:p[3] as string[],createdBy:String(p[4])};roles.set(key(r.tenantId,r.id),r);}
  else if(sql.includes("insert into authorization_grants")){const role=roles.get(key(String(p[0]),String(p[3])));if(!role)throw Error("ROLE_NOT_FOUND");const g={tenantId:String(p[0]),id:String(p[1]),actorId:String(p[2]),roleId:String(p[3]),effect:p[4] as "allow"|"deny",...(p[5]?{workspaceId:String(p[5])}:{}),...(p[6]?{resourceType:String(p[6])}:{}),...(p[7]?{resourceId:String(p[7])}:{}),conditions:JSON.parse(String(p[8])),grantedBy:String(p[9]),grantedAt:String(p[10]),permissions:role.permissions};grants.set(key(g.tenantId,g.id),g);}
  else if(sql.includes("update authorization_grants")){const g=grants.get(key(String(p[0]),String(p[1])));if(g){grants.set(key(g.tenantId,g.id),{...g,revokedAt:String(p[2])});return{rows:[],rowCount:1};}return{rows:[],rowCount:0};}
  else if(sql.includes("select g.tenant_id")){const found=[...grants.values()].filter(g=>g.tenantId===String(p[0])&&g.actorId===String(p[1])&&!g.revokedAt);return{rows:found.map(g=>({tenant_id:g.tenantId,grant_id:g.id,actor_id:g.actorId,role_id:g.roleId,effect:g.effect,workspace_id:g.workspaceId??null,resource_type:g.resourceType??null,resource_id:g.resourceId??null,conditions:g.conditions,granted_by:g.grantedBy,granted_at:g.grantedAt,expires_at:null,revoked_at:g.revokedAt??null,permissions:g.permissions})) as unknown as T[],rowCount:found.length};}
  else if(sql.includes("insert into authorization_decisions"))decisions.push(p);
  return{rows:[],rowCount:1};
 }};
 const db:SqlDatabase={query:executor.query,transaction:async<T>(work:(tx:SqlExecutor)=>Promise<T>)=>work(executor)},store=new PostgresAuthorizationStore(db);
 await store.createRole({tenantId:"tenant_1",id:"analyst",name:"Analyst",permissions:["case.read"],createdBy:"owner"});
 await store.createRole({tenantId:"tenant_1",id:"restricted",name:"Restricted",permissions:["case.read"],createdBy:"owner"});
 await store.grant({tenantId:"tenant_1",id:"allow_1",actorId:"actor_1",roleId:"analyst",effect:"allow",workspaceId:"workspace_1",conditions:{actor:{region:"br"},resource:{classification:"internal"}},grantedBy:"owner"});
 const actor={tenantId:"tenant_1",actorId:"actor_1",attributes:{region:"br"}},resource={tenantId:"tenant_1",type:"case",id:"case_1",workspaceId:"workspace_1",attributes:{classification:"internal"}};
 assert.equal((await evaluateAuthorization(store,actor,"case.read",resource)).allowed,true);
 assert.equal((await evaluateAuthorization(store,actor,"case.read",{...resource,workspaceId:"workspace_2"})).allowed,false);
 assert.equal((await evaluateAuthorization(store,{...actor,attributes:{region:"us"}},"case.read",resource)).allowed,false);
 await store.grant({tenantId:"tenant_1",id:"deny_1",actorId:"actor_1",roleId:"restricted",effect:"deny",resourceType:"case",grantedBy:"owner",conditions:{}});
 const denied=await evaluateAuthorization(store,actor,"case.read",resource);assert.equal(denied.allowed,false);assert.equal(denied.reason,"EXPLICIT_DENY");
 assert.equal(await store.revoke("tenant_1","deny_1","owner"),true);
 assert.equal((await evaluateAuthorization(store,actor,"case.read",resource)).allowed,true);
 assert.equal(decisions.length,5);assert.equal(await store.revoke("tenant_1","missing","owner"),false);
});
test("authorization validates role/grant contracts and denies cross-tenant resources",async()=>{
 const decisions:unknown[]=[];const store={effectiveGrants:async()=>[],recordDecision:async(d:unknown)=>{decisions.push(d);}} as unknown as PostgresAuthorizationStore;
 await assert.rejects(()=>new PostgresAuthorizationStore({} as SqlDatabase).createRole({tenantId:"t",id:"r",name:"bad",permissions:[],createdBy:"a"}),/AUTHORIZATION_ROLE_INVALID/);
 const d=await evaluateAuthorization(store,{tenantId:"tenant_1",actorId:"actor_1",attributes:{}},"case.read",{tenantId:"tenant_2",type:"case",id:"c",attributes:{}});
 assert.equal(d.allowed,false);assert.equal(d.reason,"NO_MATCHING_GRANT");assert.equal(decisions.length,1);
});
