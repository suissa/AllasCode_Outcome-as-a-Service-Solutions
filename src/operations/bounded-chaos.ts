export type ChaosFault = "latency" | "timeout" | "connection-reset" | "invalid-response" | "dependency-unavailable";
export interface ChaosScenario { readonly id:string; readonly tenantId:string; readonly fault:ChaosFault; readonly target:string; readonly maxRequests:number; readonly durationMs:number; readonly expectedControl:string; readonly rollbackPlan:string; }
export interface ChaosObservation { readonly scenarioId:string; readonly executed:boolean; readonly requests:number; readonly durationMs:number; readonly controlObserved:boolean; readonly blastRadiusBounded:boolean; readonly rollbackVerified:boolean; readonly notes:string; }
export interface ChaosExecutor { execute(scenario:ChaosScenario, signal:AbortSignal):Promise<ChaosObservation>; }
/** Safety envelope: executor is injected; this layer validates limits and never targets production by default. */
export async function runBoundedChaos(scenario:ChaosScenario, executor:ChaosExecutor, options:{approved:boolean;environment:"sandbox"|"staging"|"production";maxRequestsCap?:number;maxDurationMsCap?:number}):Promise<ChaosObservation>{
  if(!options.approved) throw new Error("CHAOS-APPROVAL-REQUIRED");
  if(options.environment==="production") throw new Error("CHAOS-PRODUCTION-DISALLOWED");
  if(!scenario.tenantId.trim()||!scenario.target.trim()||!scenario.expectedControl.trim()||!scenario.rollbackPlan.trim()) throw new Error("CHAOS-REQUIRED-FIELD");
  if(!Number.isInteger(scenario.maxRequests)||scenario.maxRequests<1||scenario.maxRequests>(options.maxRequestsCap??100)) throw new Error("CHAOS-REQUEST-CAP");
  if(!Number.isInteger(scenario.durationMs)||scenario.durationMs<1||scenario.durationMs>(options.maxDurationMsCap??30_000)) throw new Error("CHAOS-DURATION-CAP");
  const controller=new AbortController(); const timer=setTimeout(()=>controller.abort(),scenario.durationMs);
  try {
    const result=await executor.execute(scenario,controller.signal);
    if(result.requests>scenario.maxRequests||result.durationMs>scenario.durationMs) throw new Error("CHAOS-ENVELOPE-VIOLATION");
    if(!result.blastRadiusBounded) throw new Error("CHAOS-BLAST-RADIUS-UNBOUNDED");
    if(!result.rollbackVerified) throw new Error("CHAOS-ROLLBACK-UNVERIFIED");
    if(!result.controlObserved) throw new Error("CHAOS-CONTROL-NOT-OBSERVED");
    return Object.freeze(result);
  } finally { clearTimeout(timer); }
}
