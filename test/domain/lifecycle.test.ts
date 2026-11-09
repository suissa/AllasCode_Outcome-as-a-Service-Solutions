import test from "node:test";
import assert from "node:assert/strict";
import { transition, transitionLifecycle, assertLifecycleDefinition, InvalidTransitionError,
 LifecycleApprovalRequiredError, LifecycleGuardRejectedError, LifecycleRevisionConflictError } from "../../src/domain/lifecycle.ts";
const table=[
 {from:"draft" as const,to:"active" as const,action:"publish",requiresApproval:true,guard:(ctx:Readonly<Record<string,unknown>>)=>ctx.reviewed===true},
 {from:"active" as const,to:"closed" as const,action:"close"},
 {from:"active" as const,to:"paused" as const,action:"pause"},
 {from:"paused" as const,to:"active" as const,action:"resume"},
];
const machine={name:"outcome-case",initial:"draft" as const,states:["draft","active","paused","closed"] as const,transitions:table,terminal:["closed"] as const};
const identity={entityId:"case_abc",tenantId:"tenant_abc",actorId:"actor_abc",correlationId:"corr_abc"};
test("approval and contextual guard are independently enforced",()=>{
 assert.throws(()=>transition("draft","publish",table),LifecycleApprovalRequiredError);
 assert.throws(()=>transitionLifecycle(machine,"draft",0,{action:"publish",approved:true,context:{reviewed:false}},identity),LifecycleGuardRejectedError);
 assert.equal(transition("draft","publish",table,true),"active");
});
test("rejects illegal actions and terminal transitions",()=>{
 assert.throws(()=>transition("draft","close",table),InvalidTransitionError);
 assert.throws(()=>assertLifecycleDefinition({...machine,transitions:[...table,{from:"closed",to:"draft",action:"reopen"}]}),/LIFECYCLE_TERMINAL_STATE_INVALID/);
});
test("transition emits immutable event and uses expected revision as CAS guard",()=>{
 const result=transitionLifecycle(machine,"draft",4,{action:"publish",approved:true,expectedRevision:4,context:{reviewed:true}},identity,new Date("2026-01-01T00:00:00Z"));
 assert.equal(result.state,"active");assert.equal(result.revision,5);
 assert.deepEqual(result.event,{machine:"outcome-case",...identity,action:"publish",from:"draft",to:"active",revision:5,occurredAt:"2026-01-01T00:00:00.000Z"});
 assert.ok(Object.isFrozen(result));assert.ok(Object.isFrozen(result.event));
 assert.throws(()=>transitionLifecycle(machine,"draft",4,{action:"publish",approved:true,expectedRevision:3,context:{reviewed:true}},identity),LifecycleRevisionConflictError);
});
test("definition rejects ambiguous edges and malformed states",()=>{
 assert.throws(()=>assertLifecycleDefinition({...machine,transitions:[...table,table[0]]}),/LIFECYCLE_TRANSITION_AMBIGUOUS/);
 assert.throws(()=>assertLifecycleDefinition({...machine,initial:"unknown" as never}),/LIFECYCLE_DEFINITION_INVALID/);
});
