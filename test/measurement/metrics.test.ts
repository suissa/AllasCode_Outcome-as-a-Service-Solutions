import test from "node:test";import assert from "node:assert/strict";import{validateObservation,validateMetricDefinition}from "../../src/measurement/metrics.ts";const m={id:"metric_time",name:"time",unit:"minute",aggregation:"avg" as const,direction:"decrease" as const,freshnessMs:86400000,requiredSources:["crm"]};test("accepts a fresh matching observation",()=>assert.deepEqual(validateObservation(m,{metricId:m.id,value:20,unit:m.unit,observedAt:new Date().toISOString(),sourceId:"crm",confidence:.9}),[]));test("rejects unit mismatch and confidence outside range",()=>assert.deepEqual(validateObservation(m,{metricId:m.id,value:20,unit:"hour",observedAt:new Date().toISOString(),sourceId:"crm",confidence:2}),["unit:MISMATCH","confidence:OUT_OF_RANGE"]));
test("rejects malformed timestamps, non-finite confidence and undeclared sources",()=>{
 const base={metricId:m.id,value:20,unit:m.unit,sourceId:"crm",confidence:.9};
 assert.ok(validateObservation(m,{...base,observedAt:"not-a-date"}).includes("observedAt:INVALID"));
 assert.ok(validateObservation(m,{...base,confidence:Number.NaN,observedAt:new Date().toISOString()}).includes("confidence:OUT_OF_RANGE"));
 assert.ok(validateObservation(m,{...base,sourceId:"unknown",observedAt:new Date().toISOString()}).includes("sourceId:NOT_ALLOWED"));
});
test("metric definitions reject unsupported aggregation and direction",()=>{
 assert.ok(validateMetricDefinition({...m,aggregation:"median" as never}).includes("METRIC_AGGREGATION_INVALID"));
 assert.ok(validateMetricDefinition({...m,direction:"sideways" as never}).includes("METRIC_DIRECTION_INVALID"));
});
