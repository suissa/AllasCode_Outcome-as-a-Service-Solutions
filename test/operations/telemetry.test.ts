import test from "node:test";
import assert from "node:assert/strict";
import { detectAnomalies, evaluateSloWindow } from "../../src/operations/telemetry.ts";
test("SLO window computes availability, error rate, p95 latency and breaches",()=>{
 const now=new Date("2026-11-08T12:00:00Z");const events=Array.from({length:100},(_,i)=>({occurredAt:new Date(now.getTime()-i*1000).toISOString(),latencyMs:i<6?500:100,failed:i<2}));
 const result=evaluateSloWindow({availability:.99,errorRate:.01,latencyP95Ms:200,windowMinutes:10},events,now,50);
 assert.equal(result.sampleSize,100);assert.equal(result.availability,.98);assert.equal(result.errorRate,.02);assert.ok(result.breaches.some(b=>b.metric==="availability"));assert.ok(result.breaches.some(b=>b.metric==="latencyP95Ms"));
});
test("robust anomaly detection finds outliers without assuming normal distributions",()=>{
 const anomalies=detectAnomalies([10,10,10,100]);
 assert.deepEqual(anomalies.map(a=>a.index),[3]);
 assert.throws(()=>detectAnomalies([1,2]),/ANOMALY_INPUT_INVALID/);
});
