import type{MetricDefinition,Observation}from "./metrics.ts";
import{validateMetricDefinition,validateObservation}from "./metrics.ts";
export interface DataQuality{valid:boolean;fresh:boolean;complete:boolean;confidence:number;issues:string[]}
export function assessDataQuality(m:MetricDefinition,observations:readonly Observation[],expectedSources:readonly string[]=m.requiredSources,now=new Date()):DataQuality{
 const issues:string[]=[];
 if(validateMetricDefinition(m).length)issues.push("METRIC_DEFINITION_INVALID");
 if(!observations.length)issues.push("NO_OBSERVATIONS");
 const sources=new Set(observations.map(o=>o.sourceId));
 for(const source of expectedSources)if(!sources.has(source))issues.push("SOURCE_MISSING:"+source);
 let fresh=true,valid=true;
 for(const observation of observations){
  const errors=validateObservation(m,observation,now);
  if(errors.some(error=>error.startsWith("observedAt:")))fresh=false;
  if(errors.length)valid=false;
 }
 if(!fresh)issues.push("STALE_OBSERVATION");
 if(!valid)issues.push("OBSERVATION_INVALID");
 const complete=expectedSources.every(source=>sources.has(source));
 const confidence=observations.length&&observations.every(o=>Number.isFinite(o.confidence)&&o.confidence>=0&&o.confidence<=1)
  ?observations.reduce((sum,o)=>sum+o.confidence,0)/observations.length:0;
 return{valid,fresh,complete,confidence,issues:[...new Set(issues)]};
}
