import type{MetricDefinition,Observation}from "../measurement/metrics.ts";
export interface BaselineSnapshot{metric:MetricDefinition;observations:Observation[];value:number;period:string;quality:"valid"|"incomplete"|"stale";approvedBy?:string;approvedAt?:string}
export interface OutcomeTarget{metricId:string;baseline:number;target:number;unit:string;periodStart:string;periodEnd:string;constraints:string[];version?:number;baselineSnapshotId?:string;approvedBy?:string;approvedAt?:string}
export function validateBaseline(b:BaselineSnapshot,tolerance=1e-9):string[]{
 const errors:string[]=[];
 if(!b.metric.id||!b.metric.unit)errors.push("METRIC_DEFINITION_REQUIRED");
 if(!Number.isFinite(b.value))errors.push("BASELINE_VALUE_INVALID");
 if(!b.observations.length)errors.push("BASELINE_OBSERVATIONS_REQUIRED");
 if(b.quality!=="valid")errors.push("BASELINE_QUALITY_NOT_VALID");
 for(const o of b.observations){if(o.metricId!==b.metric.id||o.unit!==b.metric.unit)errors.push("BASELINE_METRIC_MISMATCH");if(!Number.isFinite(o.value)||!Number.isFinite(o.confidence)||o.confidence<0||o.confidence>1||Number.isNaN(Date.parse(o.observedAt)))errors.push("BASELINE_OBSERVATION_INVALID");}
 if(b.observations.length&&Number.isFinite(b.value)){
  const values=b.observations.map(o=>o.value);const sorted=[...b.observations].sort((a,z)=>Date.parse(a.observedAt)-Date.parse(z.observedAt));
  const expected=b.metric.aggregation==="sum"?values.reduce((x,y)=>x+y,0):b.metric.aggregation==="avg"?values.reduce((x,y)=>x+y,0)/values.length:b.metric.aggregation==="min"?Math.min(...values):b.metric.aggregation==="max"?Math.max(...values):b.metric.aggregation==="count"?values.length:sorted[sorted.length-1]!.value;
  if(Math.abs(expected-b.value)>tolerance)errors.push("BASELINE_AGGREGATION_MISMATCH");
 }
 return [...new Set(errors)];
}
export function approveBaseline(b:BaselineSnapshot,actor:string,at=new Date()):BaselineSnapshot{const errors=validateBaseline(b);if(errors.length)throw new Error("BASELINE_INVALID:"+errors.join(","));if(!actor)throw new Error("BASELINE_APPROVER_REQUIRED");return Object.freeze({...b,approvedBy:actor,approvedAt:at.toISOString()})}
export function detectBaselineChange(a:BaselineSnapshot,b:BaselineSnapshot,tolerance=0):boolean{if(!Number.isFinite(tolerance)||tolerance<0)throw new Error("BASELINE_TOLERANCE_INVALID");return a.metric.id!==b.metric.id||a.metric.unit!==b.metric.unit||Math.abs(a.value-b.value)>tolerance||a.period!==b.period}
export function validateTarget(t:OutcomeTarget):string[]{const e:string[]=[];if(!t.metricId)e.push("metricId:REQUIRED");if(t.unit.trim()==="")e.push("unit:REQUIRED");if(!Number.isFinite(t.baseline)||!Number.isFinite(t.target))e.push("values:INVALID");if(Number.isNaN(Date.parse(t.periodStart))||Number.isNaN(Date.parse(t.periodEnd))||Date.parse(t.periodEnd)<=Date.parse(t.periodStart))e.push("period:INVALID");return e}
export function approveOutcomeTarget(t:OutcomeTarget,b:BaselineSnapshot,actor:string,at=new Date()):OutcomeTarget{
 if(!b.approvedBy||!b.approvedAt)throw new Error("BASELINE_APPROVAL_REQUIRED");
 if(!actor||actor===b.approvedBy)throw new Error("TARGET_APPROVER_INDEPENDENT_REQUIRED");
 const errors=validateTarget(t);if(errors.length)throw new Error("TARGET_INVALID:"+errors.join(","));
 if(t.metricId!==b.metric.id||t.unit!==b.metric.unit||t.baseline!==b.value)throw new Error("TARGET_BASELINE_MISMATCH");
 return Object.freeze({...t,version:t.version??1,baselineSnapshotId:b.approvedAt,approvedBy:actor,approvedAt:at.toISOString()});
}

import { assessDataQuality } from "../measurement/data-quality.ts";
export function createBaselineSnapshot(metric:MetricDefinition,observations:readonly Observation[],period:string,now=new Date()):BaselineSnapshot{
 if(!period.trim()||!observations.length)throw new Error("BASELINE_OBSERVATIONS_REQUIRED");
 const values=observations.map(o=>o.value);
 if(values.some(v=>!Number.isFinite(v)))throw new Error("BASELINE_OBSERVATION_INVALID");
 const ordered=[...observations].sort((a,b)=>Date.parse(a.observedAt)-Date.parse(b.observedAt));
 const value=metric.aggregation==="sum"?values.reduce((a,b)=>a+b,0):metric.aggregation==="avg"?values.reduce((a,b)=>a+b,0)/values.length:metric.aggregation==="min"?Math.min(...values):metric.aggregation==="max"?Math.max(...values):metric.aggregation==="count"?values.length:ordered[ordered.length-1]!.value;
 const quality=assessDataQuality(metric,observations,metric.requiredSources,now);
 const status=quality.valid&&quality.fresh&&quality.complete?"valid":!quality.fresh?"stale":"incomplete";
 return Object.freeze({metric,observations:[...observations],value,period,quality:status});
}
