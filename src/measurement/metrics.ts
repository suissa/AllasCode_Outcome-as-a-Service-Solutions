export interface MetricDefinition {
 id:string; name:string; unit:string; version?:number;
 aggregation:"sum"|"avg"|"min"|"max"|"count"|"last";
 direction:"increase"|"decrease"|"target"; freshnessMs:number; requiredSources:string[];
}
export interface Observation { metricId:string; value:number; unit:string; observedAt:string; sourceId:string; confidence:number }

export function validateMetricDefinition(m:MetricDefinition):string[]{
 const errors:string[]=[];
 if(typeof m.id!=="string"||!m.id.trim()||typeof m.name!=="string"||!m.name.trim()||typeof m.unit!=="string"||!m.unit.trim()) errors.push("METRIC_IDENTITY_REQUIRED");
 if(!Number.isInteger(m.version??1)||(m.version??1)<1) errors.push("METRIC_VERSION_INVALID");
 if(!Number.isFinite(m.freshnessMs)||m.freshnessMs<=0) errors.push("METRIC_FRESHNESS_INVALID");
 if(!["sum","avg","min","max","count","last"].includes(m.aggregation)) errors.push("METRIC_AGGREGATION_INVALID");
 if(!["increase","decrease","target"].includes(m.direction)) errors.push("METRIC_DIRECTION_INVALID");
 if(!Array.isArray(m.requiredSources)||!m.requiredSources.length||m.requiredSources.some(s=>typeof s!=="string"||!s.trim())||new Set(m.requiredSources).size!==m.requiredSources.length) errors.push("METRIC_SOURCES_INVALID");
 return errors;
}

export function validateObservation(m:MetricDefinition,o:Observation,now=new Date()):string[]{
 const errors:string[]=[];
 if(o.metricId!==m.id) errors.push("metricId:MISMATCH");
 if(o.unit!==m.unit) errors.push("unit:MISMATCH");
 if(!Number.isFinite(o.value)) errors.push("value:NOT_FINITE");
 if(!Number.isFinite(o.confidence)||o.confidence<0||o.confidence>1) errors.push("confidence:OUT_OF_RANGE");
 const observedAt=Date.parse(o.observedAt);
 if(!Number.isFinite(observedAt)) errors.push("observedAt:INVALID");
 else {const age=now.getTime()-observedAt;if(age<0)errors.push("observedAt:FUTURE");else if(age>m.freshnessMs)errors.push("observedAt:STALE");}
 if(typeof o.sourceId!=="string"||!o.sourceId.trim()) errors.push("sourceId:REQUIRED");
 else if(!m.requiredSources.includes(o.sourceId)) errors.push("sourceId:NOT_ALLOWED");
 return errors;
}

export class MetricRegistry {
 private readonly metrics=new Map<string,MetricDefinition[]>();
 register(metric:MetricDefinition):MetricDefinition {
  if(this.metrics.has(metric.id)) throw new Error("METRIC_ALREADY_REGISTERED");
  const candidate={...metric,version:metric.version??1};const errors=validateMetricDefinition(candidate);
  if(errors.length) throw new Error("METRIC_INVALID:"+errors.join(","));
  const saved=Object.freeze({...candidate,requiredSources:Object.freeze([...candidate.requiredSources]) as unknown as string[]});
  this.metrics.set(metric.id,[saved]);return saved;
 }
 revise(metric:MetricDefinition):MetricDefinition {
  const history=this.metrics.get(metric.id);if(!history)throw new Error("METRIC_NOT_FOUND");
  const candidate={...metric,version:history[history.length-1]!.version!+1};const errors=validateMetricDefinition(candidate);
  if(errors.length)throw new Error("METRIC_INVALID:"+errors.join(","));
  const saved=Object.freeze({...candidate,requiredSources:Object.freeze([...candidate.requiredSources]) as unknown as string[]});
  this.metrics.set(metric.id,[...history,saved]);return saved;
 }
 get(id:string):MetricDefinition {const history=this.metrics.get(id);if(!history)throw new Error("METRIC_NOT_FOUND");return history[history.length-1]!}
 history(id:string):readonly MetricDefinition[]{return Object.freeze([...(this.metrics.get(id)??[])])}
}
