import test from "node:test";
import assert from "node:assert/strict";
import { assessDataQuality } from "../../src/measurement/data-quality.ts";
import type { MetricDefinition, Observation } from "../../src/measurement/metrics.ts";

const metric: MetricDefinition = { id:"revenue", name:"Revenue", unit:"BRL", aggregation:"sum", direction:"increase", freshnessMs:60_000, requiredSources:["erp","crm"] };
const now = new Date("2026-11-11T12:00:00.000Z");
const observation = (sourceId:string, overrides:Partial<Observation>={}):Observation => ({metricId:metric.id,value:100,unit:metric.unit,observedAt:now.toISOString(),sourceId,confidence:.9,...overrides});

test("data quality requires every declared source and reports completeness",()=>{
 const result=assessDataQuality(metric,[observation("erp")],metric.requiredSources,now);
 assert.equal(result.valid,true);assert.equal(result.fresh,true);assert.equal(result.complete,false);
 assert.ok(result.issues.includes("SOURCE_MISSING:crm"));
});
test("data quality rejects invalid observations instead of treating them as fresh",()=>{
 const result=assessDataQuality(metric,[observation("erp",{confidence:Number.NaN}),observation("crm",{observedAt:"invalid"})],metric.requiredSources,now);
 assert.equal(result.valid,false);assert.equal(result.fresh,false);
 assert.ok(result.issues.includes("OBSERVATION_INVALID"));assert.ok(result.issues.includes("STALE_OBSERVATION"));
});
test("data quality rejects future observations",()=>{
 const result=assessDataQuality(metric,[observation("erp",{observedAt:"2026-11-11T12:01:00.000Z"}),observation("crm")],metric.requiredSources,now);
 assert.equal(result.fresh,false);assert.ok(result.issues.includes("STALE_OBSERVATION"));
});
