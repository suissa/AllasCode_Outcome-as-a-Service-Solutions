export interface TraceContext{traceId:string;spanId:string;tenantId:string;actorId:string;requestId:string;outcomeId?:string;executionId?:string;behaviorId?:string}
export interface Slo{availability:number;latencyP95Ms:number;errorRate:number;windowMinutes:number}
export function validateSlo(s:Slo):void{if(!Number.isFinite(s.availability)||s.availability<0||s.availability>1||!Number.isFinite(s.errorRate)||s.errorRate<0||s.errorRate>1||!Number.isFinite(s.latencyP95Ms)||s.latencyP95Ms<=0||!Number.isFinite(s.windowMinutes)||s.windowMinutes<=0)throw new Error("SLO_INVALID")}
export function correlate<T extends Record<string,unknown>>(context:TraceContext,event:T):Readonly<T & TraceContext>{return Object.freeze({...event,...context})}

export interface SloEvent { occurredAt:string; latencyMs:number; failed:boolean }
export interface SloWindowResult { sampleSize:number; availability:number; errorRate:number; latencyP95Ms:number; windowStart:string; windowEnd:string; breaches:readonly {metric:string;observed:number;target:number}[] }
export function evaluateSloWindow(slo:Slo,events:readonly SloEvent[],now=new Date(),minimumSamples=1):SloWindowResult{
 validateSlo(slo);if(!Number.isInteger(minimumSamples)||minimumSamples<1)throw new Error("SLO_MINIMUM_SAMPLES_INVALID");
 const start=now.getTime()-slo.windowMinutes*60_000;
 const window=events.filter(e=>{const at=Date.parse(e.occurredAt);return Number.isFinite(at)&&at>=start&&at<=now.getTime()});
 if(window.length<minimumSamples)throw new Error("SLO_INSUFFICIENT_SAMPLES");
 if(window.some(e=>!Number.isFinite(e.latencyMs)||e.latencyMs<0))throw new Error("SLO_EVENT_INVALID");
 const failed=window.filter(e=>e.failed).length;const availability=(window.length-failed)/window.length;const errorRate=failed/window.length;
 const latencies=window.map(e=>e.latencyMs).sort((a,b)=>a-b);const p95=latencies[Math.max(0,Math.ceil(latencies.length*.95)-1)]!;
 const breaches:{metric:string;observed:number;target:number}[]=[];
 if(availability<slo.availability)breaches.push({metric:"availability",observed:availability,target:slo.availability});
 if(errorRate>slo.errorRate)breaches.push({metric:"errorRate",observed:errorRate,target:slo.errorRate});
 if(p95>slo.latencyP95Ms)breaches.push({metric:"latencyP95Ms",observed:p95,target:slo.latencyP95Ms});
 return Object.freeze({sampleSize:window.length,availability,errorRate,latencyP95Ms:p95,windowStart:new Date(start).toISOString(),windowEnd:now.toISOString(),breaches:Object.freeze(breaches)});
}
export interface Anomaly { index:number; value:number; zScore:number }
export function detectAnomalies(values:readonly number[],threshold=3):readonly Anomaly[]{
 if(values.length<3||!Number.isFinite(threshold)||threshold<=0||values.some(v=>!Number.isFinite(v)))throw new Error("ANOMALY_INPUT_INVALID");
 const sorted=[...values].sort((a,b)=>a-b);const median=sorted.length%2?sorted[Math.floor(sorted.length/2)]!:(sorted[sorted.length/2-1]!+sorted[sorted.length/2]!)/2;const deviations=values.map(v=>Math.abs(v-median)).sort((a,b)=>a-b);const mad=deviations.length%2?deviations[Math.floor(deviations.length/2)]!:(deviations[deviations.length/2-1]!+deviations[deviations.length/2]!)/2;
 return Object.freeze(values.flatMap((value,index)=>{const z=mad===0?(value===median?0:Math.sign(value-median)*Number.POSITIVE_INFINITY):0.6745*(value-median)/mad;return Math.abs(z)>=threshold?[Object.freeze({index,value,zScore:z})]:[];}));
}
