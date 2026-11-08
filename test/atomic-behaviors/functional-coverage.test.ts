import test from "node:test";
import assert from "node:assert/strict";
import { decideApproval } from "../../src/execution/approval.ts";
import { evaluateAcceptance } from "../../src/execution/acceptance.ts";
import { validateConnectorRequest } from "../../src/integrations/connector.ts";
import { priceUsage } from "../../src/commercial/metering.ts";
import { calculateOutcomeFee } from "../../src/commercial/outcome-fee.ts";
import { recordDecision } from "../../src/solutions/decision.ts";
import { verifyPlaybook } from "../../src/solutions/playbook.ts";
import { recoveryDecision, evaluateFlag, validateFlag } from "../../src/operations/recovery.ts";
import { validateBackup, verifyBackup } from "../../src/operations/backup.ts";
import { createCalculationSnapshot, snapshotFingerprint } from "../../src/reporting/snapshot.ts";
import { evaluateExact } from "../../src/ai/evaluation.ts";

test("approval and deliverable acceptance enforce independent human evidence",()=>{
 const request={id:"approval_001",tenantId:"tenant_001",actorId:"actor_001",action:"publish",resourceId:"site_001",risk:"high" as const,status:"pending" as const};
 assert.throws(()=>decideApproval(request,"actor_001","approved","ok"),/APPROVER_NOT_INDEPENDENT/);
 assert.equal(decideApproval(request,"reviewer_001","approved","reviewed").status,"approved");
 const result=evaluateAcceptance({deliverableId:"deliverable_001",checks:[{id:"check_001",description:"Tests",required:true,passed:true,evidenceIds:[]}]});
 assert.equal(result.accepted,false);
});
test("connector contract requires bounded, contextual idempotent execution",()=>{
 const manifest={id:"connector_001",version:"1",name:"CRM",capabilities:["customer.read"],timeoutMs:1000,maxRetries:2,idempotent:true,allowedHosts:["crm.example.com"]};
 assert.throws(()=>validateConnectorRequest(manifest,{tenantId:"",actorId:"actor",operation:"read",payload:{},idempotencyKey:"idem",correlationId:"corr"}),/CONNECTOR_CONTEXT_REQUIRED/);
 assert.doesNotThrow(()=>validateConnectorRequest(manifest,{tenantId:"tenant",actorId:"actor",operation:"read",payload:{},idempotencyKey:"idem",correlationId:"corr"}));
});
test("commercial metering and outcome fee apply deterministic caps and direction",()=>{
 const entry=priceUsage({id:"usage_001",tenantId:"tenant_001",actorId:"actor_001",quantity:3,unit:"task",occurredAt:"2026-11-08T10:00:00Z",idempotencyKey:"idem_001"},10,"BRL");
 assert.equal(entry.amount,30);
 const fee=calculateOutcomeFee({rate:.1,floor:5,cap:20,metricDirection:"increase",baseline:100,target:200},150,1000,"BRL");
 assert.equal(fee.progress,.5); assert.equal(fee.fee,20);
});
test("solution decision and playbook require evidence-backed verification",()=>{
 const decision=recordDecision({id:"decision_001",tenantId:"tenant_001",outcomeId:"outcome_001",decidedBy:"owner_001",decidedAt:"2026-11-08T10:00:00Z",selectedScenarioId:"scenario_a",rejectedScenarioIds:["scenario_b"],rationale:"Best net benefit",criteria:{cost:1},evidenceIds:["evidence_001"],status:"selected"});
 assert.equal(decision.status,"selected");
 assert.throws(()=>recordDecision({...decision,evidenceIds:[]}),/SOLUTION_DECISION_INVALID/);
 assert.equal(verifyPlaybook({id:"playbook_001",version:1,name:"Onboarding",steps:[{behaviorId:"behavior_001",inputSchema:"in.v1",outputSchema:"out.v1",approvalRequired:true}],evidenceBasis:["evidence_001"]},"reviewer").verifiedBy,"reviewer");
});
test("recovery reconciles unknown side effects and feature flags stay bounded",()=>{
 assert.equal(recoveryDecision({operationId:"op",idempotencyKey:"idem",sideEffectStatus:"unknown",attempt:0,maxAttempts:3}),"reconcile");
 assert.equal(recoveryDecision({operationId:"op",idempotencyKey:"idem",sideEffectStatus:"not_applied",attempt:0,maxAttempts:3}),"retry");
 const flag={name:"beta",enabled:true,percentage:20,allowlist:["actor"],updatedBy:"owner",updatedAt:"2026-11-08T00:00:00Z"};
 assert.equal(evaluateFlag(flag,"actor",99),true); assert.equal(evaluateFlag(flag,"other",30),false);
 assert.throws(()=>validateFlag({...flag,percentage:101}),/FEATURE_FLAG_PERCENTAGE_INVALID/);
});
test("backup and calculation snapshots preserve verifiable evidence inputs",()=>{
 const backup={id:"backup_001",tenantId:"tenant_001",createdAt:"2026-11-08T10:00:00Z",formatVersion:"1",contentHash:"hash",sizeBytes:100,scope:["tenant"]};
 validateBackup(backup); assert.equal(verifyBackup(backup,"hash"),true);
 const snapshot=createCalculationSnapshot({id:"snapshot_001",outcomeId:"outcome_001",specVersion:1,methodVersion:"did-v1",inputEvidenceHashes:["sha256:abc"],result:{baseline:10,target:20,observed:15,absoluteChange:5,targetProgress:.5,confidence:.8,achieved:false}});
 assert.ok(snapshotFingerprint(snapshot).includes("sha256:abc"));
 assert.equal(evaluateExact({id:"eval_001",input:{},expected:{ok:true},tags:["safety"]},{ok:true},"model-v1","prompt-v1").passed,true);
});
