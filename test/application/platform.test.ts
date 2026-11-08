import {test} from "node:test";import assert from "node:assert/strict";
import {OutcomePlatform,PlatformError} from "../../src/application/platform.ts";
import type {OutcomeCase,CommandContext} from "../../src/application/outcome-case.ts";
const metric={id:"revenue",name:"Revenue",unit:"BRL",aggregation:"sum" as const};
const initial:OutcomeCase={id:"case1",tenantId:"tenantA",stage:"specified",spec:{metric,baseline:100,target:150,direction:"increase",periodStart:"2026-01-01",periodEnd:"2026-02-01",attribution:"direct",approvedBy:"owner"},evidence:[],observations:[]};
const ctx=(key:string,tenantId="tenantA"):CommandContext=>({tenantId,actorId:"owner",correlationId:"corr-"+key,idempotencyKey:key});
test("platform runs approved case to settlement with tenant-isolated audit",()=>{
 const p=new OutcomePlatform();p.register(initial);assert.equal(p.start(ctx("start"),"case1").value.stage,"active");
 const ev={id:"ev1",tenantId:"tenantA",kind:"document",uri:"evidence://1",hash:"abc",capturedAt:"2026-01-02",source:"ledger"} as any;
 p.addEvidence(ctx("evidence"),"case1",ev,"abc");
 p.observe(ctx("observe"),"case1",{metricId:"revenue",value:160,unit:"BRL",timestamp:"2026-02-01",confidence:0.95,source:"ledger"});
 const settled=p.settle(ctx("settle"),"case1",0,"ledger reconciliation","report1").value;
 assert.equal(settled.stage,"settled");assert.equal(settled.result?.achieved,true);assert.equal(settled.report?.evidenceIds[0],"ev1");
 assert.equal(p.auditTrail("tenantA").length,4);assert.equal(p.auditTrail("tenantB").length,0);
});
test("idempotency replays without duplicate audit and rejects changed payload",()=>{
 const p=new OutcomePlatform();p.register(initial);const c=ctx("start");
 p.start(c,"case1");assert.equal(p.start(c,"case1").replayed,true);assert.equal(p.auditTrail("tenantA").length,1);
 assert.throws(()=>p.addEvidence(c,"case1",{id:"x"} as any,"hash"),e=>e instanceof PlatformError&&e.code==="IDEMPOTENCY_CONFLICT");
});
test("tenant cannot read or mutate another tenant case",()=>{
 const p=new OutcomePlatform();p.register(initial);assert.throws(()=>p.get("tenantB","case1"),e=>e instanceof PlatformError&&e.code==="CASE_NOT_FOUND");
 assert.throws(()=>p.start(ctx("start","tenantB"),"case1"),e=>e instanceof PlatformError&&e.code==="CASE_NOT_FOUND");
});
test("missing command context fails closed before mutation",()=>{
 const p=new OutcomePlatform();p.register(initial);assert.throws(()=>p.start({...ctx("x"),actorId:""},"case1"),e=>e instanceof PlatformError&&e.code==="COMMAND_CONTEXT_REQUIRED");
 assert.equal(p.get("tenantA","case1").stage,"specified");assert.equal(p.auditTrail("tenantA").length,0);
});
