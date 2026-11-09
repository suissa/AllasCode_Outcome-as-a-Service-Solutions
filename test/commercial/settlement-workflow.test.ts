import test from "node:test";
import assert from "node:assert/strict";
import { planSettlementActions, executeSettlementPlan } from "../../src/commercial/settlement-workflow.ts";
test("settlement planner holds disputed or unaccepted outcomes and pays only accepted results",()=>{
 const base={tenantId:"tenant_001",outcomeId:"outcome_001",agreementId:"agreement_001",accepted:true,achieved:true,disputed:false,paymentCaptured:true,currency:"BRL",feeAmount:100,bonusAmount:20,refundableAmount:50};
 assert.deepEqual(planSettlementActions({...base,accepted:false}).map(a=>a.kind),["hold"]);
 assert.deepEqual(planSettlementActions({...base,disputed:true}).map(a=>a.kind),["open_dispute","hold"]);
 assert.deepEqual(planSettlementActions(base).map(a=>a.kind),["issue_fee_invoice","credit_bonus"]);
 assert.deepEqual(planSettlementActions({...base,achieved:false}).map(a=>a.kind),["refund"]);
});
test("settlement executor uses ordered idempotent actions and stops on provider failure",async()=>{
 const actions=planSettlementActions({tenantId:"tenant_001",outcomeId:"outcome_002",agreementId:"agreement_001",accepted:true,achieved:true,disputed:false,currency:"BRL",feeAmount:100,bonusAmount:20,refundableAmount:0});
 let count=0;const result=await executeSettlementPlan(actions,{execute:async action=>{count++;if(action.kind==="credit_bonus")throw new Error("PROVIDER_UNAVAILABLE");return{externalReference:"external_"+action.id};}});
 assert.equal(count,2);assert.equal(result.completed.length,1);assert.equal(result.failed?.errorCode,"PROVIDER_UNAVAILABLE");
});
