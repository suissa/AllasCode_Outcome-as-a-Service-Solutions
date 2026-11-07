export interface TraceContext{traceId:string;spanId:string;tenantId:string;actorId:string;requestId:string;outcomeId?:string;executionId?:string;behaviorId?:string}
export interface Slo{availability:number;latencyP95Ms:number;errorRate:number;windowMinutes:number}
export function validateSlo(s:Slo):void{if(s.availability<0||s.availability>1||s.errorRate<0||s.errorRate>1||s.latencyP95Ms<=0||s.windowMinutes<=0)throw new Error("SLO_INVALID")}
export function correlate<T extends Record<string,unknown>>(context:TraceContext,event:T):Readonly<T & TraceContext>{return Object.freeze({...event,...context})}
