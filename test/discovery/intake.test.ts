import test from "node:test";
import assert from "node:assert/strict";
import { captureIntent, normalizeIntentEnvelope, extractIntentFields } from "../../src/intent/intent.ts";
import { createDiscoveryForQualifiedIntent } from "../../src/discovery/intake.ts";
test("captures and normalizes channel intent with provenance",()=>{
 const captured=captureIntent({id:"intent_demo_002",tenantId:"tenant_demo_001",actorId:"actor_demo_001",statement:"  Reduce churn  ",desiredOutcome:" retention ",scope:[" sales ","sales"],constraints:[" LGPD "],channel:"conversation",sourceId:" whatsapp_001 ",capturedAt:"2026-11-08T10:00:00Z",createdAt:"2026-11-08T10:00:00Z"});
 assert.equal(captured.statement,"Reduce churn"); assert.deepEqual(captured.scope,["sales"]); assert.equal(captured.provenance.channel,"conversation");
});
test("rejects intent without provenance and builds discovery tasks",()=>{
 assert.throws(()=>captureIntent({id:"intent_demo_003",tenantId:"tenant_demo_001",actorId:"actor_demo_001",statement:"x",desiredOutcome:"y",channel:"api",sourceId:"",capturedAt:"bad",createdAt:"bad"}),/INTENT_PROVENANCE_INVALID/);
 const intent=captureIntent({id:"intent_demo_004",tenantId:"tenant_demo_001",actorId:"actor_demo_001",statement:"Improve conversion",desiredOutcome:"conversion_rate",scope:["checkout"],channel:"web",sourceId:"form_1",capturedAt:"2026-11-08T10:00:00Z",createdAt:"2026-11-08T10:00:00Z"});
 const tasks=createDiscoveryForQualifiedIntent(intent,"actor_consultant");
 assert.equal(tasks.length,4); assert.ok(tasks.every(task=>task.status==="pending"&&task.ownerId==="actor_consultant"));
});

test("intent extraction uses confidence and ambiguity to request clarification",async()=>{
 const input={id:"intent_extract_001",tenantId:"tenant_demo_001",actorId:"actor_demo_001",statement:"Improve sales",desiredOutcome:"",channel:"conversation" as const,sourceId:"whatsapp_001",capturedAt:"2026-11-08T10:00:00Z",createdAt:"2026-11-08T10:00:00Z"};
 const pending=await extractIntentFields(input,async()=>({desiredOutcome:"increase qualified leads",scope:[],confidence:.55,ambiguities:["which customer segment?"]}));
 assert.equal(pending.status,"needs_clarification");
 if(pending.status==="needs_clarification")assert.ok(pending.questions.length>=3);
 const captured=await extractIntentFields({...input,deadline:"2026-12-01"},async()=>({desiredOutcome:"qualified leads",scope:["inbound sales"],constraints:["LGPD"],confidence:.95,ambiguities:[]}));
 assert.equal(captured.status,"captured");
 if(captured.status==="captured")assert.deepEqual(captured.intent.scope,["inbound sales"]);
});
