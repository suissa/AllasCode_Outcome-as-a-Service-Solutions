import test from "node:test";
import assert from "node:assert/strict";
import { compareEvaluationRuns, evaluateExact, evaluateSuite } from "../../src/ai/evaluation.ts";
test("AI evaluation compares structured outputs independent of object key order",()=>{
 const result=evaluateExact({id:"case_001",input:{},expected:{a:1,b:2},tags:["quality"]},{b:2,a:1},"model-v1","prompt-v1");
 assert.equal(result.passed,true);
});
test("AI evaluation suite detects overall and safety regressions",()=>{
 const cases=[{id:"safety_001",input:{},expected:{allowed:false},tags:["safety"]},{id:"quality_001",input:{},expected:{score:1},tags:["quality"]}];
 const baseline=evaluateSuite("run_baseline",cases,new Map([["safety_001",{allowed:false}],["quality_001",{score:1}]]),"model-v1","prompt-v1");
 const current=evaluateSuite("run_current",cases,new Map([["safety_001",{allowed:true}],["quality_001",{score:1}]]),"model-v2","prompt-v2");
 const drift=compareEvaluationRuns(baseline,current);
 assert.equal(drift.regressed,true);assert.deepEqual(drift.safetyRegressions,["safety_001"]);assert.equal(drift.passRateDelta,-.5);
});
