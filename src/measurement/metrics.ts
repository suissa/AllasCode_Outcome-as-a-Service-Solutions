export interface MetricDefinition{id:string;name:string;unit:string;version?:number;aggregation:"sum"|"avg"|"min"|"max"|"count"|"last";direction:"increase"|"decrease"|"target";freshnessMs:number;requiredSources:string[]}export interface Observation{metricId:string;value:number;unit:string;observedAt:string;sourceId:string;confidence:number}export function validateObservation(m:MetricDefinition,o:Observation,now=new Date()):string[]{const e:string[]=[];if(o.metricId!==m.id)e.push("metricId:MISMATCH");if(o.unit!==m.unit)e.push("unit:MISMATCH");if(!Number.isFinite(o.value))e.push("value:NOT_FINITE");if(o.confidence<0||o.confidence>1)e.push("confidence:OUT_OF_RANGE");const age=now.getTime()-Date.parse(o.observedAt);if(age<0)e.push("observedAt:FUTURE");else if(age>m.freshnessMs)e.push("observedAt:STALE");if(!o.sourceId)e.push("sourceId:REQUIRED");return e}
export function validateMetricDefinition(m:MetricDefinition):string[]{
 const errors:string[]=[];if(!m.id||!m.name.trim()||!m.unit.trim())errors.push("METRIC_IDENTITY_REQUIRED");if(!Number.isInteger(m.version??1)||(m.version??1)<1)errors.push("METRIC_VERSION_INVALID");if(!Number.isFinite(m.freshnessMs)||m.freshnessMs<=0)errors.push("METRIC_FRESHNESS_INVALID");if(!m.requiredSources.length||new Set(m.requiredSources).size!==m.requiredSources.length)errors.push("METRIC_SOURCES_INVALID");return errors;
}
export class MetricRegistry {
 private readonly metrics=new Map<string,MetricDefinition[]>();
 register(metric:MetricDefinition):MetricDefinition{
  if(this.metrics.has(metric.id))throw new Error("METRIC_ALREADY_REGISTERED");
  const candidate={...metric,version:metric.version??1};const errors=validateMetricDefinition(candidate);if(errors.length)throw new Error("METRIC_INVALID:"+errors.join(","));
  const saved=Object.freeze({...candidate,requiredSources:[...candidate.requiredSources]});this.metrics.set(metric.id,[saved]);return saved;
 }
 revise(metric:MetricDefinition):MetricDefinition{
  const history=this.metrics.get(metric.id);if(!history)throw new Error("METRIC_NOT_FOUND");
  const candidate={...metric,version:history[history.length-1]!.version!+1};const errors=validateMetricDefinition(candidate);if(errors.length)throw new Error("METRIC_INVALID:"+errors.join(","));
  const saved=Object.freeze({...candidate,requiredSources:[...candidate.requiredSources]});this.metrics.set(metric.id,[...history,saved]);return saved;
 }
 get(id:string):MetricDefinition{const history=this.metrics.get(id);if(!history)throw new Error("METRIC_NOT_FOUND");return history[history.length-1]!}
 history(id:string):readonly MetricDefinition[]{return Object.freeze([...(this.metrics.get(id)??[])])}
}
