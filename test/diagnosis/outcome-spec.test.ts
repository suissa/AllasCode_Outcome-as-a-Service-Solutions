import test from "node:test";
import assert from "node:assert/strict";
import { approveBaseline, approveOutcomeTarget, validateBaseline, detectBaselineChange, createBaselineSnapshot, validateTarget } from "../../src/diagnosis/outcome-spec.ts";
import { MetricRegistry, validateObservation } from "../../src/measurement/metrics.ts";
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

test("baseline capture aggregates validated observations and metric definitions are versioned",()=>{
 const snapshot=createBaselineSnapshot(metric,baseline.observations,"2026-Q3",new Date("2026-10-02T00:00:00Z"));
 assert.equal(snapshot.value,11);assert.equal(snapshot.quality,"valid");
 const registry=new MetricRegistry();registry.register(metric);
 assert.equal(registry.revise({...metric,name:"Conversion rate"}).version,2);
 assert.equal(registry.history(metric.id).length,2);
 assert.ok(validateObservation(metric,{...baseline.observations[0]!,observedAt:"2026-10-03T00:00:00Z"},new Date("2026-10-02T00:00:00Z")).includes("observedAt:FUTURE"));
});

test("target specification rejects invalid windows, non-finite values and contradictory direction",()=>{
 const invalid={metricId:metric.id,baseline:11,target:10,unit:metric.unit,periodStart:"2026-10-01T00:00:00Z",periodEnd:"2026-10-01T00:00:00Z",constraints:["","duplicate","duplicate"]};
 assert.ok(validateTarget(invalid).includes("period:INVALID"));
 assert.ok(validateTarget({...invalid,periodEnd:"2026-12-31T00:00:00Z",target:Number.NaN}).includes("values:INVALID"));
 assert.ok(validateTarget({...invalid,periodEnd:"2026-12-31T00:00:00Z"}).includes("target:DIRECTION_CONTRADICTION"));
 assert.ok(validateTarget({...invalid,periodEnd:"2026-12-31T00:00:00Z",target:15,constraints:["risk","risk"]}).includes("constraints:DUPLICATE"));
});
test("baseline and target approval reject invalid actors and timestamps",()=>{
 assert.throws(()=>approveBaseline(baseline,"  "),/BASELINE_APPROVER_REQUIRED/);
 assert.throws(()=>approveBaseline(baseline,"owner",new Date("invalid")),/BASELINE_APPROVAL_TIME_INVALID/);
 const approved=approveBaseline(baseline,"baseline_owner");
 const target={metricId:metric.id,baseline:11,target:15,unit:metric.unit,periodStart:"2026-10-01T00:00:00Z",periodEnd:"2026-12-31T00:00:00Z",constraints:[]};
 assert.throws(()=>approveOutcomeTarget(target,approved,"target_owner",new Date("invalid")),/TARGET_APPROVAL_TIME_INVALID/);
 assert.equal(approveOutcomeTarget(target,approved,"target_owner").baselineSnapshotId,approved.approvedAt);
});
