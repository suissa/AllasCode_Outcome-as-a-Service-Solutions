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

test("intent extraction rejects malformed structured output instead of trusting model fields",async()=>{const input={id:"intent_extract_002",tenantId:"tenant_demo_001",actorId:"actor_demo_001",statement:"Improve revenue",desiredOutcome:"",channel:"conversation" as const,sourceId:"chat_002",capturedAt:"2026-11-10T03:00:00Z",createdAt:"2026-11-10T03:01:00Z"};await assert.rejects(()=>extractIntentFields(input,async()=>({desiredOutcome:"revenue",scope:["sales"],confidence:2,ambiguities:[]})),/INTENT_EXTRACTION_CONFIDENCE_INVALID/);await assert.rejects(()=>extractIntentFields(input,async()=>({desiredOutcome:"revenue",scope:[""],confidence:.9,ambiguities:[]})),/INTENT_EXTRACTION_SCOPE_INVALID/);await assert.rejects(()=>extractIntentFields(input,async()=>({desiredOutcome:"revenue",scope:["sales"],deadline:"tomorrow",confidence:.9,ambiguities:[]})),/INTENT_EXTRACTION_DEADLINE_INVALID/);});
test("intent extraction validates ambiguity and constraints and freezes normalized evidence",async()=>{const input={id:"intent_extract_003",tenantId:"tenant_demo_001",actorId:"actor_demo_001",statement:"  Improve sales  ",desiredOutcome:"",channel:"conversation" as const,sourceId:"chat_003",capturedAt:"2026-11-10T03:00:00Z",createdAt:"2026-11-10T03:01:00Z"};const result=await extractIntentFields(input,async(statement)=>({desiredOutcome:"qualified leads",scope:[" inbound sales "],constraints:[" preserve consent "],deadline:"2026-12-01",confidence:.95,ambiguities:[]}));assert.equal(result.status,"captured");if(result.status==="captured"){assert.equal(result.intent.statement,"Improve sales");assert.deepEqual(result.intent.scope,["inbound sales"]);assert.deepEqual(result.intent.constraints,["preserve consent"]);assert.ok(Object.isFrozen(result.extraction));assert.ok(Object.isFrozen(result.extraction.scope));}await assert.rejects(()=>extractIntentFields(input,async()=>({desiredOutcome:"revenue",scope:["sales"],constraints:[""],confidence:.9,ambiguities:[]})),/INTENT_EXTRACTION_CONSTRAINTS_INVALID/);await assert.rejects(()=>extractIntentFields(input,async()=>({desiredOutcome:"revenue",scope:["sales"],confidence:.9,ambiguities:[""]})),/INTENT_EXTRACTION_AMBIGUITY_INVALID/);});
