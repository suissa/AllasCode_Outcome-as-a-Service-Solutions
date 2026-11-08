import test from "node:test";
import assert from "node:assert/strict";
import { createApiKeyAuthenticator, createScopeAuthorizer, hashApiKeySecret, type ApiKeyRecord } from "../../src/security/api-key-auth.ts";
import type { IncomingMessage } from "node:http";
test("API key authentication hashes secrets and rejects invalid, expired and revoked keys",async()=>{
 const secret="high-entropy-test-secret";let record: ApiKeyRecord={keyId:"key_001",tenantId:"tenant_001",actorId:"actor_001",secretHash:hashApiKeySecret(secret),scopes:["case.read"],expiresAt:"2026-12-01T00:00:00Z"};
 const auth=createApiKeyAuthenticator({getKey:async id=>id===record.keyId?record:undefined},()=>new Date("2026-11-08T00:00:00Z"));
 const request=(token:string)=>({headers:{authorization:"Bearer "+token}} as IncomingMessage);
 assert.equal((await auth(request("key_001."+secret)))?.tenantId,"tenant_001");
 assert.equal(await auth(request("key_001.wrong")),undefined);
 assert.equal(await auth(request("missing."+secret)),undefined);
 record={...record,revokedAt:"2026-11-08T01:00:00Z"};
 assert.equal(await auth(request("key_001."+secret)),undefined);
});
test("scope authorizer denies cross-tenant resources and supports action scopes",()=>{
 const authorize=createScopeAuthorizer();const actor={tenantId:"tenant_001",actorId:"actor_001",roles:["case.read"]};
 assert.equal(authorize(actor,"case.read",{tenantId:"tenant_001"} as never),true);
 assert.equal(authorize(actor,"case.update",{tenantId:"tenant_001"} as never),false);
 assert.equal(authorize(actor,"case.read",{tenantId:"tenant_other"} as never),false);
});
