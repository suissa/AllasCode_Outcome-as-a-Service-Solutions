import test from "node:test";
import assert from "node:assert/strict";
import { approveBaseline, approveOutcomeTarget, validateBaseline, detectBaselineChange } from "../../src/diagnosis/outcome-spec.ts";
const metric={id:"metric_conversion",name:"Conversion",unit:"percent",aggregation:"avg" as const,direction:"increase" as const,freshnessMs:86400000,requiredSources:["analytics"]};
const baseline={metric,observations:[{metricId:metric.id,value:10,unit:metric.unit,observedAt:"2026-10-01T00:00:00Z",sourceId:"analytics",confidence:.9},{metricId:metric.id,value:12,unit:metric.unit,observedAt:"2026-10-02T00:00:00Z",sourceId:"analytics",confidence:.95}],value:11,period:"2026-Q3",quality:"valid" as const};
test("baseline approval checks source metric, quality and aggregation math",()=>{
 assert.deepEqual(validateBaseline(baseline),[]);
 const approved=approveBaseline(baseline,"baseline_owner");
 assert.equal(approved.approvedBy,"baseline_owner");
 assert.throws(()=>approveBaseline({...baseline,value:99},"owner"),/BASELINE_AGGREGATION_MISMATCH/);
 assert.throws(()=>approveBaseline({...baseline,quality:"stale"},"owner"),/BASELINE_QUALITY_NOT_VALID/);
});
test("target binds to approved baseline and requires an independent approver",()=>{
 const approved=approveBaseline(baseline,"baseline_owner");
 const target={metricId:metric.id,baseline:11,target:15,unit:metric.unit,periodStart:"2026-10-01",periodEnd:"2026-12-31",constraints:[]};
 assert.throws(()=>approveOutcomeTarget(target,approved,"baseline_owner"),/TARGET_APPROVER_INDEPENDENT_REQUIRED/);
 assert.equal(approveOutcomeTarget(target,approved,"target_owner").approvedBy,"target_owner");
 assert.throws(()=>approveOutcomeTarget({...target,baseline:10},approved,"target_owner"),/TARGET_BASELINE_MISMATCH/);
 assert.equal(detectBaselineChange(baseline,{...baseline,value:12}),true);
});
