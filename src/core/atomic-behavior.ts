import type { PropertySchema, ValidationIssue } from "./schema-validator.ts";
import { validateValue } from "./schema-validator.ts";
import type { TenantScope } from "../domain/tenant-scope.ts";
import { assertTenantScope } from "../domain/tenant-scope.ts";
import type { AuditEvent } from "../domain/audit.ts";
import { createAuditEvent } from "../domain/audit.ts";
export interface AtomicBehavior<I,O>{id:string;version:number;input:PropertySchema;authorize:(scope:TenantScope,input:I)=>boolean;execute:(input:I,scope:TenantScope)=>O}
export interface BehaviorContext{scope:TenantScope;now?:Date}
export interface BehaviorResult<O>{output:O;audit:AuditEvent}
export class BehaviorRejected extends Error{constructor(readonly code:string,readonly path:string,readonly issues:readonly ValidationIssue[]=[]){super(code);this.name="BehaviorRejected"}}
/** Validate all input/authority gates before executing a side effect. Audit is emitted only after success. */
export function runAtomicBehavior<I extends Record<string,unknown>,O>(b:AtomicBehavior<I,O>,input:I,ctx:BehaviorContext):BehaviorResult<O>{
 if(!b.id.trim()||b.version<1)throw new BehaviorRejected("BEHAVIOR_MANIFEST_INVALID","manifest");
 const issues=validateValue(input,b.input,"payload");if(issues.length)throw new BehaviorRejected(issues[0]!.code,issues[0]!.path,issues);
 try{assertTenantScope(ctx.scope,{tenantId:ctx.scope.tenantId})}catch{throw new BehaviorRejected("TENANT_SCOPE_INVALID","context.scope")}
 if(!b.authorize(ctx.scope,input))throw new BehaviorRejected("BEHAVIOR_UNAUTHORIZED","authorization");
 const output=b.execute(input,ctx.scope);
 const audit=createAuditEvent({id:`audit_${b.id}_${ctx.scope.correlationId}`,tenantId:ctx.scope.tenantId,actorId:ctx.scope.actorId,action:b.id,subjectType:"atomic_behavior",subjectId:b.id,correlationId:ctx.scope.correlationId,metadata:{version:b.version}},ctx.now);
 return Object.freeze({output,audit});
}
