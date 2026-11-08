import test from "node:test";
import assert from "node:assert/strict";
import { decideApproval } from "../../src/execution/approval.ts";
import { evaluateAcceptance, reviewAcceptance } from "../../src/execution/acceptance.ts";
import { validateConnectorRequest, dispatchConnector } from "../../src/integrations/connector.ts";
import { priceUsage } from "../../src/commercial/metering.ts";
import { buildInvoice, issueInvoice, recordInvoicePayment, refundInvoice, disputeInvoice } from "../../src/commercial/invoice.ts";
import { recordAgreementSignature, activateSignedAgreement, createAgreementProposal } from "../../src/commercial/agreement.ts";
import { calculateOutcomeFee } from "../../src/commercial/outcome-fee.ts";
import { recordDecision } from "../../src/solutions/decision.ts";
import { verifyPlaybook } from "../../src/solutions/playbook.ts";
import { PolicyRegistry } from "../../src/domain/policy.ts";
import { createInvitation, acceptInvitation, revokeMembership, WorkspaceRegistry } from "../../src/platform/workspace.ts";
import { recoveryDecision, evaluateFlag, validateFlag } from "../../src/operations/recovery.ts";
import { validateBackup, verifyBackup, authorizeExport, restoreBackup } from "../../src/operations/backup.ts";
import { aggregateHealth } from "../../src/operations/health.ts";
import { rotateSecretReference } from "../../src/security/secret-reference.ts";
import { decideAccessReview } from "../../src/security/access-review.ts";
import { submitFeedback, transitionIncident } from "../../src/operations/feedback.ts";
import { createCalculationSnapshot, snapshotFingerprint } from "../../src/reporting/snapshot.ts";
import { evaluateExact } from "../../src/ai/evaluation.ts";
import { calculateConfidenceInterval } from "../../src/outcomes/settlement.ts";
import { verifyEvidenceAccess } from "../../src/evidence/evidence.ts";

test("approval and deliverable acceptance enforce independent human evidence",()=>{
 const request={id:"approval_001",tenantId:"tenant_001",actorId:"actor_001",action:"publish",resourceId:"site_001",risk:"high" as const,status:"pending" as const};
 assert.throws(()=>decideApproval(request,"actor_001","approved","ok"),/APPROVER_NOT_INDEPENDENT/);
 assert.equal(decideApproval(request,"reviewer_001","approved","reviewed").status,"approved");
 const result=evaluateAcceptance({deliverableId:"deliverable_001",checks:[{id:"check_001",description:"Tests",required:true,passed:true,evidenceIds:[]}]});
 assert.equal(result.accepted,false);
});
test("connector contract requires bounded, contextual idempotent execution",()=>{
 const manifest={id:"connector_001",version:"1",name:"CRM",capabilities:["customer.read"],timeoutMs:1000,maxRetries:2,idempotent:true,allowedHosts:["crm.example.com"]};
 assert.throws(()=>validateConnectorRequest(manifest,{tenantId:"",actorId:"actor",operation:"customer.read",payload:{},idempotencyKey:"idem",correlationId:"corr"}),/CONNECTOR_CONTEXT_REQUIRED/);
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

test("invoice payments, refunds and disputes are append-only and bounded",()=>{
 const invoice=issueInvoice(buildInvoice({id:"invoice_001",tenantId:"tenant_001",agreementId:"agreement_001",currency:"BRL",entries:[{id:"entry_001",tenantId:"tenant_001",sourceEventId:"usage_001",kind:"charge",amount:100,currency:"BRL",createdAt:"2026-11-08T00:00:00Z"}],adjustments:0}));
 const initial={invoice,paidAmount:0,refundedAmount:0,events:[]};
 const paid=recordInvoicePayment(initial,{id:"event_pay_001",invoiceId:"invoice_001",tenantId:"tenant_001",kind:"payment",amount:100,currency:"BRL",occurredAt:"2026-11-08T01:00:00Z"});
 assert.equal(paid.invoice.status,"paid");
 const disputed=disputeInvoice(paid,{id:"event_dispute_001",invoiceId:"invoice_001",tenantId:"tenant_001",kind:"dispute_opened",currency:"BRL",reason:"Charge questioned",occurredAt:"2026-11-08T02:00:00Z"});
 assert.equal(disputed.invoice.status,"disputed");
 assert.throws(()=>refundInvoice(disputed,{id:"event_refund_001",invoiceId:"invoice_001",tenantId:"tenant_001",kind:"refund",amount:101,currency:"BRL",reason:"refund",occurredAt:"2026-11-08T03:00:00Z"}),/REFUND_NOT_ALLOWED/);
});
test("confidence interval requires sufficient sample and states approximation method",()=>{
 assert.throws(()=>calculateConfidenceInterval({mean:10,standardDeviation:2,sampleSize:10}),/CONFIDENCE_SAMPLE_TOO_SMALL/);
 const interval=calculateConfidenceInterval({mean:10,standardDeviation:2,sampleSize:100});
 assert.ok(interval.lower<10&&interval.upper>10); assert.equal(interval.method,"normal-approximation");
});

test("operations and security controls require approvals and preserve recoverability",()=>{
 const secret=rotateSecretReference({provider:"vault",key:"tenant/key",version:"v1"},"v2","security_owner");
 assert.equal(secret.current.version,"v2"); assert.equal(secret.revokePrevious,true);
 const grant={actorId:"user_001",tenantId:"tenant_001",resourceId:"case_001",permissions:["read","approve"],grantedBy:"owner",grantedAt:"2026-11-08T00:00:00Z"};
 assert.equal(decideAccessReview(grant,"auditor","retain","still required").decision,"retain");
 assert.throws(()=>decideAccessReview(grant,"user_001","retain","self review"),/ACCESS_REVIEW_INDEPENDENT_REQUIRED/);
 assert.throws(()=>authorizeExport({tenantId:"tenant_001",requestedBy:"owner",purpose:"DSAR",includePersonalData:true}),/PERSONAL_DATA_EXPORT_APPROVAL_REQUIRED/);
 assert.equal(authorizeExport({tenantId:"tenant_001",requestedBy:"owner",purpose:"DSAR",includePersonalData:true,approvedBy:"privacy_officer"}).approvedBy,"privacy_officer");
 const backup={id:"backup_001",tenantId:"tenant_001",createdAt:"2026-11-08T00:00:00Z",formatVersion:"1",contentHash:"sha256:ok",sizeBytes:20,scope:["tenant"]};
 assert.equal(restoreBackup(backup,"sha256:bad").restored,false);
 assert.equal(restoreBackup(backup,"sha256:ok").restored,true);
 assert.equal(aggregateHealth([{name:"db",status:"healthy",checkedAt:"2026-11-08T00:00:00Z",latencyMs:2},{name:"queue",status:"degraded",checkedAt:"2026-11-08T00:00:00Z",latencyMs:10}]),"degraded");
 const incident={id:"incident_001",tenantId:"tenant_001",severity:"sev2" as const,summary:"API outage",occurredAt:"2026-11-08T00:00:00Z",status:"open" as const,lessons:[]};
 assert.equal(transitionIncident(incident,"investigating").status,"investigating");
 assert.equal(submitFeedback({id:"feedback_001",tenantId:"tenant_001",subjectId:"case_001",rating:5,submittedAt:"2026-11-08T00:00:00Z"}).rating,5);
});

test("connector dispatch retries only retryable results and bounds uncertain side effects",async()=>{
 const manifest={id:"connector_retry_001",version:"1",name:"CRM",capabilities:["customer.write"],timeoutMs:100,maxRetries:2,idempotent:true,allowedHosts:["crm.example.com"]};
 let attempts=0;
 const connector={manifest,execute:async()=>{attempts++;return attempts===1?{status:"retryable_error" as const,errorCode:"RATE_LIMIT"}:{status:"success" as const,output:{id:"customer_001"}}}};
 const result=await dispatchConnector(connector,{tenantId:"tenant_001",actorId:"actor_001",operation:"customer.write",payload:{},idempotencyKey:"idem_001",correlationId:"corr_001"});
 assert.equal(result.result.status,"success");assert.equal(result.attempts,2);
 const unsafe={manifest:{...manifest,idempotent:false,timeoutMs:5},execute:async()=>new Promise<never>(()=>{})};
 const timeout=await dispatchConnector(unsafe,{tenantId:"tenant_001",actorId:"actor_001",operation:"customer.write",payload:{},idempotencyKey:"idem_002",correlationId:"corr_002"});
 assert.equal(timeout.result.errorCode,"CONNECTOR_TIMEOUT_UNCERTAIN");assert.equal(timeout.attempts,1);
});

test("evidence access is tenant, purpose and classification scoped",()=>{
 const evidence={id:"evidence_001",tenantId:"tenant_a",sourceId:"crm",capturedAt:"2026-11-08T00:00:00Z",contentHash:"a".repeat(64),classification:"confidential" as const};
 const context={tenantId:"tenant_b",actorId:"actor_001",purpose:"outcome_validation",allowedClassifications:["public","internal"] as const};
 const errors=verifyEvidenceAccess(evidence,context);
 assert.ok(errors.includes("TENANT_MISMATCH"));assert.ok(errors.includes("EVIDENCE_CLASSIFICATION_FORBIDDEN"));assert.ok(errors.includes("EVIDENCE_VERIFICATION_REQUIRED"));
});

test("policy versions are immutable and only approved effective versions resolve",()=>{
 const policies=new PolicyRegistry<{allow:boolean}>();
 policies.register("tenant_001",{id:"policy_001",version:1,name:"Base",effectiveAt:"2026-01-01",rules:{allow:true}});
 policies.approve("tenant_001","policy_001",1,"policy_owner");
 policies.propose("tenant_001",{id:"policy_001",version:2,name:"Restricted",effectiveAt:"2026-11-01",rules:{allow:false}});
 assert.equal(policies.effective("tenant_001","policy_001").version,1);
 policies.approve("tenant_001","policy_001",2,"policy_reviewer");
 assert.equal(policies.effective("tenant_001","policy_001").rules.allow,false);
 assert.equal(policies.history("tenant_001","policy_001").length,2);
});
test("workspace invitations expire, validate token and require intended actor",()=>{
 const invitation=createInvitation({workspaceId:"workspace_001",tenantId:"tenant_001" as never,actorId:"actor_001",role:"analyst",invitedBy:"owner_001",expiresAt:"2026-12-01T00:00:00Z",invitationTokenHash:"hash"});
 assert.throws(()=>acceptInvitation(invitation,"actor_001","wrong"),/INVITATION_TOKEN_INVALID/);
 assert.throws(()=>acceptInvitation(invitation,"other_actor","hash"),/INVITATION_ACTOR_MISMATCH/);
 assert.equal(acceptInvitation(invitation,"actor_001","hash").status,"active");
 assert.equal(revokeMembership(invitation,"owner_001").status,"revoked");
 const workspaces=new WorkspaceRegistry();
 workspaces.create({id:"workspace_001",tenantId:"tenant_001" as never,name:"Team",slug:"team",status:"active",createdAt:"2026-11-08T00:00:00Z"});
 assert.throws(()=>workspaces.create({id:"workspace_002",tenantId:"tenant_001" as never,name:"Team 2",slug:"team",status:"active",createdAt:"2026-11-08T00:00:00Z"}),/WORKSPACE_SLUG_CONFLICT/);
});

test("agreement activation requires verified signatures from every required signer",async()=>{
 const agreement={id:"agreement_sig_001",tenantId:"tenant_001",version:1,status:"draft" as const,scope:["checkout"],deliverables:["conversion improvement"],exclusions:[],fees:[{id:"fixed",kind:"fixed" as const,currency:"BRL",amount:100}]};
 const signature=(signerId:string)=>({signerId,signatureHash:"sha256_"+signerId,provider:"qualified-signature",signedAt:"2026-11-08T10:00:00Z",verificationReference:"verification_"+signerId});
 await assert.rejects(()=>recordAgreementSignature(agreement,signature("owner"),async()=>false),/AGREEMENT_SIGNATURE_UNVERIFIED/);
 const first=await recordAgreementSignature(agreement,signature("owner"),async()=>true);
 await assert.rejects(()=>Promise.resolve(activateSignedAgreement(first,["owner","customer"])),/AGREEMENT_SIGNATURES_INCOMPLETE/);
 const second=await recordAgreementSignature(first,signature("customer"),async()=>true);
 assert.equal(activateSignedAgreement(second,["owner","customer"]).status,"active");
});

test("proposal is generated only from a selected evidence-backed solution decision",()=>{
 const decision={id:"decision_proposal_001",tenantId:"tenant_001",outcomeId:"outcome_001",decidedBy:"owner_001",decidedAt:"2026-11-08T00:00:00Z",selectedScenarioId:"scenario_001",rejectedScenarioIds:[],rationale:"Evidence-backed expected value",criteria:{netBenefit:1},evidenceIds:["evidence_001"],status:"selected" as const};
 const proposal=createAgreementProposal({id:"proposal_001",version:1,decision,scenarioId:"scenario_001",scope:["sales funnel"],deliverables:["new qualification workflow"],exclusions:["paid media"],fees:[{id:"fixed",kind:"fixed",currency:"BRL",amount:5000}]});
 assert.equal(proposal.status,"draft");assert.equal(proposal.sourceDecisionId,decision.id);assert.deepEqual(proposal.evidenceIds,["evidence_001"]);
 assert.throws(()=>createAgreementProposal({id:"proposal_002",version:1,decision,scenarioId:"another_scenario",scope:["x"],deliverables:["y"],exclusions:[],fees:[]}),/PROPOSAL_DECISION_MISMATCH/);
});

test("acceptance contracts require evidence for every passed required criterion",()=>{
 const contract={deliverableId:"deliverable_contract_001",checks:[{id:"tests",description:"Automated tests pass",required:true,passed:true,evidenceIds:["ci_run_001"]},{id:"approval",description:"Owner approves",required:true,passed:true,evidenceIds:["approval_001"]}]};
 const accepted=evaluateAcceptance(contract);
 assert.equal(accepted.accepted,true);
 assert.throws(()=>reviewAcceptance({...accepted,accepted:false},"reviewer",true),/DELIVERABLE_NOT_ACCEPTABLE/);
 const invalid=evaluateAcceptance({...contract,checks:[{...contract.checks[0]!,evidenceIds:[]}]});
 assert.equal(invalid.accepted,false);assert.ok(invalid.issues?.includes("ACCEPTANCE_EVIDENCE_REQUIRED:tests"));
});
