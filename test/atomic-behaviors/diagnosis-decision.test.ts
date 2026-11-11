import test from "node:test";import assert from "node:assert/strict";import {validateFinding,validateRootCause,validateRootCauseApproval} from "../../src/diagnosis/root-cause.ts";import {recordDecision,reopenDecision,validateDecision} from "../../src/solutions/decision.ts";
test("diagnosis findings and root cause enforce evidence tenant and approval",()=>{const finding={id:"f",tenantId:"tenant_demo",statement:"manual bottleneck",category:"process" as const,evidenceIds:["e"],confidence:.8,impact:"high" as const,constraints:[]};assert.deepEqual(validateFinding(finding),[]);const analysis={tenantId:"tenant_demo",problem:"conversion low",findings:[finding],alternativesConsidered:["pricing","workflow"]};assert.deepEqual(validateRootCause(analysis),[]);assert.equal(validateRootCauseApproval(analysis,"analyst").validatedBy,"analyst");assert.ok(validateRootCause({...analysis,findings:[{...finding,tenantId:"tenant_other"}]}).includes("findings:TENANT_MISMATCH"));});
test("solution decisions require rationale evidence and preserve reopen history",()=>{const d={id:"d",tenantId:"tenant_demo",outcomeId:"o",decidedBy:"owner",decidedAt:"2026-01-01",selectedScenarioId:"s1",rejectedScenarioIds:["s2"],rationale:"best risk-adjusted result",criteria:{cost:1},evidenceIds:["e"],status:"selected" as const};assert.deepEqual(validateDecision(d),[]);const recorded=recordDecision(d);assert.equal(reopenDecision(recorded,"owner","new baseline").status,"reopened");assert.throws(()=>recordDecision({...d,rationale:"",evidenceIds:[]}),/SOLUTION_DECISION_INVALID/);});

test("finding validation rejects malformed, ungrounded and out-of-range properties",()=>{
 const base={id:"f",tenantId:"tenant_demo",statement:"manual bottleneck",category:"process" as const,evidenceIds:["e"],confidence:.8,impact:"high" as const,constraints:["limited staffing"]};
 assert.ok(validateFinding({...base,confidence:Number.NaN}).includes("confidence:OUT_OF_RANGE"));
 assert.ok(validateFinding({...base,evidenceIds:[]}).includes("evidenceIds:REQUIRED"));
 assert.ok(validateFinding({...base,evidenceIds:["e","e"]}).includes("evidenceIds:DUPLICATE"));
 assert.ok(validateFinding({...base,category:"unknown" as never}).includes("category:INVALID"));
 assert.ok(validateFinding({...base,constraints:[" "]}).includes("constraints:INVALID"));
});
test("root cause analysis validates every finding and rejects duplicate or cross-tenant findings",()=>{
 const finding={id:"f",tenantId:"tenant_demo",statement:"manual bottleneck",category:"process" as const,evidenceIds:["e"],confidence:.8,impact:"high" as const,constraints:[]};
 const analysis={tenantId:"tenant_demo",problem:"conversion low",findings:[finding],alternativesConsidered:["pricing","workflow"]};
 assert.ok(validateRootCause({...analysis,findings:[{...finding,confidence:2}]}).includes("findings[0]:INVALID"));
 assert.ok(validateRootCause({...analysis,findings:[finding,{...finding,statement:"second"}]}).includes("findings:DUPLICATE_ID"));
 assert.ok(validateRootCause({...analysis,findings:[{...finding,tenantId:"tenant_other"}]}).includes("findings:TENANT_MISMATCH"));
});
test("root cause approval is independent from finding ownership and validates its timestamp",()=>{
 const finding={id:"f",tenantId:"tenant_demo",statement:"manual bottleneck",category:"process" as const,evidenceIds:["e"],confidence:.8,impact:"high" as const,constraints:[],owner:"analyst"};
 const analysis={tenantId:"tenant_demo",problem:"conversion low",findings:[finding],alternativesConsidered:["pricing","workflow"]};
 assert.throws(()=>validateRootCauseApproval(analysis,"analyst"),/ROOT_CAUSE_APPROVER_NOT_INDEPENDENT/);
 assert.throws(()=>validateRootCauseApproval(analysis,"reviewer",new Date("invalid")),/ROOT_CAUSE_APPROVAL_TIME_INVALID/);
 assert.equal(validateRootCauseApproval(analysis,"reviewer").validatedBy,"reviewer");
});
