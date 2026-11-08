import test from "node:test";
import assert from "node:assert/strict";
import {startOutcomeCase,recordOutcomeEvidence,recordObservation,settleOutcomeCase,disputeOutcomeCase,OutcomeCaseError,validateOutcomeCase,setControlBaseline,recordControlObservation} from "../../src/application/outcome-case.ts";
import type {OutcomeCase} from "../../src/application/outcome-case.ts";
const metric={id:"revenue",name:"Revenue",unit:"BRL",aggregation:"sum" as const,direction:"increase" as const,freshnessMs:86400000,requiredSources:["erp"]};
const base:OutcomeCase={id:"outcome_growth",tenantId:"tenant_acme",stage:"specified",spec:{metric,baseline:100,target:150,direction:"increase",periodStart:"2026-01-01",periodEnd:"2026-02-01",attribution:"direct",approvedBy:"owner"},evidence:[],observations:[]};
const evidence={id:"evidence_sales",tenantId:"tenant_acme",sourceId:"erp_export",capturedAt:"2026-01-31T10:00:00Z",contentHash:"sha256:abc",classification:"internal" as const};
const observation={metricId:"revenue",value:160,unit:"BRL",observedAt:"2026-01-31T10:00:00Z",sourceId:"erp",confidence:.95};
test("end-to-end case records tenant-bound evidence and settles with a report",()=>{
 let c=startOutcomeCase(base); c=recordOutcomeEvidence(c,evidence,"sha256:abc");c=recordObservation(c,observation);
 c=settleOutcomeCase(c,0,"direct attribution","report_growth",new Date("2026-02-01T00:00:00Z"));
 assert.equal(c.stage,"settled");assert.equal(c.result?.achieved,true);assert.equal(c.report?.evidenceIds[0],"evidence_sales");
});
test("rejects cross-tenant evidence without mutating original case",()=>{
 const c=startOutcomeCase(base);
 assert.throws(()=>recordOutcomeEvidence(c,{...evidence,tenantId:"tenant_other"},"sha256:abc"),(e:unknown)=>e instanceof OutcomeCaseError&&e.code==="TENANT_MISMATCH");
 assert.equal(c.evidence.length,0);
});
test("refuses settlement without evidence and invalid dispute transitions",()=>{
 const c=recordObservation(startOutcomeCase(base),observation);
 assert.throws(()=>settleOutcomeCase(c,0,"method","report"),(e:unknown)=>e instanceof OutcomeCaseError&&e.code==="EVIDENCE_REQUIRED");
 assert.throws(()=>disputeOutcomeCase(c,"reason"),(e:unknown)=>e instanceof OutcomeCaseError&&e.code==="CASE_NOT_SETTLED");
});
test("requires a non-empty reason for dispute",()=>{
 let c=startOutcomeCase(base);c=recordOutcomeEvidence(c,evidence,"sha256:abc");c=recordObservation(c,observation);c=settleOutcomeCase(c,0,"method","report");
 assert.throws(()=>disputeOutcomeCase(c," "), (e:unknown)=>e instanceof OutcomeCaseError&&e.code==="DISPUTE_REASON_REQUIRED");
 assert.equal(disputeOutcomeCase(c,"baseline source mismatch").stage,"disputed");
});

test("case validation rejects wrong initial stage, invalid period and cross-tenant evidence",()=>{
 assert.ok(validateOutcomeCase(base).length===0);
 assert.ok(validateOutcomeCase({...base,stage:"active"}).includes("CASE_INITIAL_STAGE_INVALID"));
 assert.ok(validateOutcomeCase({...base,spec:{...base.spec,periodEnd:"2025-01-01"}}).includes("OUTCOME_PERIOD_INVALID"));
 assert.ok(validateOutcomeCase({...base,evidence:[{...evidence,tenantId:"tenant_other"}]}).includes("TENANT_MISMATCH"));
});
test("observation validation rejects invalid confidence and duplicate source timestamps",()=>{
 const c=startOutcomeCase(base);
 assert.throws(()=>recordObservation(c,{...observation,confidence:2}),/OBSERVATION_INVALID/);
 const once=recordObservation(c,observation);
 assert.throws(()=>recordObservation(once,observation),/OBSERVATION_DUPLICATE/);
});

test("experimental settlement applies difference-in-differences and records attribution",()=>{
 const experimental={...base,spec:{...base.spec,attribution:"experimental" as const}};
 let c=startOutcomeCase(experimental);
 c=recordOutcomeEvidence(c,evidence,"sha256:abc");
 c=recordObservation(c,observation);
 assert.throws(()=>settleOutcomeCase(c,0,"difference-in-differences","report_exp"),/CONTROL_GROUP_REQUIRED/);
 c=setControlBaseline(c,50);
 c=recordControlObservation(c,{...observation,value:55,sourceId:"control_group"});
 c=settleOutcomeCase(c,0,"difference-in-differences","report_exp");
 assert.equal(c.result?.attribution?.adjustedChange,55);
 assert.equal(c.result?.observed,155);
 assert.equal(c.result?.achieved,true);
});
