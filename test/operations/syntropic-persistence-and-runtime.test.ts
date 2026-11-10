import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {MemoryAppendOnlyLedger} from "../../src/operations/evidence-ledger.js";
import {FormalProofRegistry} from "../../src/operations/formal-proof-registry.js";
import {runBoundedChaos} from "../../src/operations/bounded-chaos.js";
import {invokeZigRuntime} from "../../src/operations/zig-runtime-contract.js";

describe("append-only evidence ledger",()=>{
 it("chains events and verifies integrity",async()=>{const l=new MemoryAppendOnlyLedger<{x:number}>();await l.append({tenantId:"t1",eventId:"e1",eventType:"x",occurredAt:"2026-11-10T00:00:00Z",payload:{x:1}});await l.append({tenantId:"t1",eventId:"e2",eventType:"x",occurredAt:"2026-11-10T00:00:01Z",payload:{x:2}});assert.deepEqual(await l.verifyTenant("t1"),{valid:true,checked:2});});
 it("prevents duplicate event IDs and isolates tenants",async()=>{const l=new MemoryAppendOnlyLedger<{x:number}>();await l.append({tenantId:"a",eventId:"e",eventType:"x",occurredAt:"2026-11-10T00:00:00Z",payload:{x:1}});await assert.rejects(l.append({tenantId:"a",eventId:"e",eventType:"x",occurredAt:"2026-11-10T00:00:00Z",payload:{x:2}}),/LEDGER-DUPLICATE-EVENT/);assert.equal((await l.readTenant("b")).length,0);});
});
describe("formal proof registry",()=>{
 it("accepts exact versioned obligations and rejects absent proof",async()=>{const l=new MemoryAppendOnlyLedger<any>(),r=new FormalProofRegistry(l);const req=[{specificationId:"policy",version:"1",obligations:["tenant-isolation"]}];assert.equal((await r.verify("t",req)).satisfied,false);await r.register({proofId:"p1",tenantId:"t",specificationId:"policy",specificationVersion:"1",checker:"agda",checkerVersion:"2.8",verdict:"passed",artifactDigest:"sha256:abc",checkedAt:"2026-11-10T00:00:00Z",obligations:["tenant-isolation"]});assert.equal((await r.verify("t",req)).satisfied,true);});
 it("does not accept a proof from another tenant",async()=>{const l=new MemoryAppendOnlyLedger<any>(),r=new FormalProofRegistry(l);await r.register({proofId:"p1",tenantId:"other",specificationId:"policy",specificationVersion:"1",checker:"agda",checkerVersion:"2.8",verdict:"passed",artifactDigest:"sha256:abc",checkedAt:"2026-11-10T00:00:00Z",obligations:["tenant-isolation"]});assert.equal((await r.verify("t",[{specificationId:"policy",version:"1",obligations:["tenant-isolation"]}])).satisfied,false);});
});
describe("bounded chaos",()=>{
 const s={id:"c1",tenantId:"t",fault:"timeout" as const,target:"staging-connector",maxRequests:5,durationMs:1000,expectedControl:"fail-closed",rollbackPlan:"restore baseline"};
 it("rejects unapproved or production experiments",async()=>{const e={execute:async()=>({scenarioId:"c1",executed:true,requests:1,durationMs:1,controlObserved:true,blastRadiusBounded:true,rollbackVerified:true,notes:"ok"})};await assert.rejects(runBoundedChaos(s,e,{approved:false,environment:"staging"}),/CHAOS-APPROVAL-REQUIRED/);await assert.rejects(runBoundedChaos(s,e,{approved:true,environment:"production"}),/CHAOS-PRODUCTION-DISALLOWED/);});
 it("requires observed control and rollback",async()=>{const e={execute:async()=>({scenarioId:"c1",executed:true,requests:1,durationMs:1,controlObserved:false,blastRadiusBounded:true,rollbackVerified:true,notes:""})};await assert.rejects(runBoundedChaos(s,e,{approved:true,environment:"staging"}),/CHAOS-CONTROL-NOT-OBSERVED/);});
});
describe("Zig runtime contract",()=>{
 it("checks correlation and output digest",async()=>{const request={protocolVersion:"1" as const,tenantId:"t",executionId:"x1",behaviorId:"b1",command:"execute-approved-behavior" as const,inputDigest:"sha256:a",policyDigest:"sha256:b",proofRefs:[]};const transport={invoke:async()=>({protocolVersion:"1" as const,executionId:"x1",status:"completed" as const,outputDigest:"sha256:c",evidenceRefs:[]})};assert.equal((await invokeZigRuntime(transport,request,new AbortController().signal)).status,"completed");});
 it("rejects mismatched execution correlation",async()=>{const request={protocolVersion:"1" as const,tenantId:"t",executionId:"x1",behaviorId:"b1",command:"validate-contract" as const,inputDigest:"sha256:a",policyDigest:"sha256:b",proofRefs:[]};const transport={invoke:async()=>({protocolVersion:"1" as const,executionId:"wrong",status:"accepted" as const,evidenceRefs:[]})};await assert.rejects(invokeZigRuntime(transport,request,new AbortController().signal),/ZIG-CONTRACT-CORRELATION-MISMATCH/);});
});
