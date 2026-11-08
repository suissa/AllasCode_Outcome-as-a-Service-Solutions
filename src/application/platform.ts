import type { AuditEvent } from "../domain/audit.ts";
import { createAuditEvent } from "../domain/audit.ts";
import type { OutcomeCase } from "./outcome-case.ts";
import { startOutcomeCase, recordOutcomeEvidence, recordObservation, settleOutcomeCase, disputeOutcomeCase } from "./outcome-case.ts";
import type { EvidenceRecord } from "../evidence/evidence.ts";
import type { Observation } from "../measurement/metrics.ts";

export interface CommandContext { tenantId:string; actorId:string; correlationId:string; idempotencyKey:string }
export interface PlatformCommandResult<T> { value:T; replayed:boolean }
export class PlatformError extends Error { constructor(readonly code:string){super(code);this.name="PlatformError"} }

/** Small executable reference runtime: tenant-scoped storage, audited commands and replay-safe writes. */
export class OutcomePlatform {
  private readonly cases=new Map<string,OutcomeCase>();
  private readonly audits:AuditEvent[]=[];
  private readonly idempotency=new Map<string,{fingerprint:string;result:unknown}>();
  private sequence=0;
  private key(c:CommandContext,id:string){return `${c.tenantId}:${id}`}
  private assertContext(c:CommandContext){if(!c.tenantId||!c.actorId||!c.correlationId||!c.idempotencyKey)throw new PlatformError("COMMAND_CONTEXT_REQUIRED")}
  private command<T>(ctx:CommandContext,action:string,subjectId:string,fingerprint:string,execute:()=>T):PlatformCommandResult<T>{
    this.assertContext(ctx);const idem=`${ctx.tenantId}:${ctx.idempotencyKey}`,old=this.idempotency.get(idem);
    if(old){if(old.fingerprint!==fingerprint)throw new PlatformError("IDEMPOTENCY_CONFLICT");return {value:old.result as T,replayed:true}}
    const before=this.cases.get(this.key(ctx,subjectId));const value=execute();
    this.cases.set(this.key(ctx,subjectId),value as OutcomeCase);
    this.audits.push(createAuditEvent({id:`audit_${++this.sequence}`,tenantId:ctx.tenantId,actorId:ctx.actorId,action,subjectType:"OutcomeCase",subjectId,correlationId:ctx.correlationId,before:before?.stage,after:(value as OutcomeCase).stage,metadata:{idempotencyKey:ctx.idempotencyKey}}));
    this.idempotency.set(idem,{fingerprint,result:value});return {value,replayed:false};
  }
  register(c:OutcomeCase){if(!c.id||!c.tenantId)throw new PlatformError("CASE_ID_TENANT_REQUIRED");const k=`${c.tenantId}:${c.id}`;if(this.cases.has(k))throw new PlatformError("CASE_ALREADY_EXISTS");this.cases.set(k,Object.freeze(c));return c}
  get(tenantId:string,id:string):OutcomeCase{const c=this.cases.get(`${tenantId}:${id}`);if(!c)throw new PlatformError("CASE_NOT_FOUND");return c}
  start(ctx:CommandContext,id:string){return this.command(ctx,"case.start",id,"start",()=>startOutcomeCase(this.get(ctx.tenantId,id)))}
  addEvidence(ctx:CommandContext,id:string,e:EvidenceRecord,hash:string){return this.command(ctx,"case.evidence",id,`evidence:${e.id}:${hash}`,()=>recordOutcomeEvidence(this.get(ctx.tenantId,id),e,hash))}
  observe(ctx:CommandContext,id:string,o:Observation){return this.command(ctx,"case.observe",id,`observe:${o.metricId}:${o.timestamp}:${o.value}`,()=>recordObservation(this.get(ctx.tenantId,id),o))}
  settle(ctx:CommandContext,id:string,index:number,methodology:string,reportId:string,now=new Date()){return this.command(ctx,"case.settle",id,`settle:${index}:${methodology}:${reportId}`,()=>settleOutcomeCase(this.get(ctx.tenantId,id),index,methodology,reportId,now))}
  dispute(ctx:CommandContext,id:string,reason:string){return this.command(ctx,"case.dispute",id,`dispute:${reason}`,()=>disputeOutcomeCase(this.get(ctx.tenantId,id),reason))}
  auditTrail(tenantId:string):readonly AuditEvent[]{return Object.freeze(this.audits.filter(a=>a.tenantId===tenantId))}
}
