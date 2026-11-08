import { randomUUID } from "node:crypto";
import type { SqlDatabase } from "../persistence/sql.ts";
export type DurableTaskState = "ready"|"running"|"awaiting_approval"|"succeeded"|"failed"|"cancelled";
export interface DurableTask {
  id: string; tenantId: string; workflowId: string; dependencies: readonly string[];
  state: DurableTaskState; attempt: number; maxAttempts: number; timeoutMs: number;
  idempotencyKey: string; approvalRequired: boolean; approvedBy?: string;
  requestedBy?: string; assignedActorId?: string;
  input: unknown; output?: unknown; errorCode?: string; version: number;
}
export interface WorkflowTaskEvent { id: string; tenantId: string; taskId: string; kind: string; actorId: string; occurredAt: string; detail?: unknown }
export interface WorkflowTaskStore {
  createTask(task: DurableTask): Promise<void>;
  getTask(tenantId: string, taskId: string): Promise<DurableTask|undefined>;
  listTasks(tenantId: string, workflowId: string): Promise<readonly DurableTask[]>;
  transition(tenantId: string, taskId: string, expected: DurableTaskState, next: DurableTask): Promise<boolean>;
  appendEvent(event: WorkflowTaskEvent): Promise<void>;
}
export class WorkflowRuntimeError extends Error { constructor(readonly code: string){ super(code); this.name="WorkflowRuntimeError"; } }
const decodeTask = (value: DurableTask | string): DurableTask => typeof value === "string" ? JSON.parse(value) as DurableTask : value;
export class PostgresWorkflowTaskStore implements WorkflowTaskStore {
  constructor(private readonly db: SqlDatabase) {}
  async createTask(task: DurableTask): Promise<void> {
    await this.db.query("insert into workflow_tasks (tenant_id, workflow_id, task_id, state, payload, version) values ($1,$2,$3,$4,$5::jsonb,1)", [task.tenantId,task.workflowId,task.id,task.state,JSON.stringify(task)]);
  }
  async getTask(tenantId:string,taskId:string):Promise<DurableTask|undefined>{
    const r=await this.db.query<{payload:DurableTask|string}>("select payload from workflow_tasks where tenant_id=$1 and task_id=$2",[tenantId,taskId]);return r.rows[0] ? decodeTask(r.rows[0].payload) : undefined;
  }
  async listTasks(tenantId:string,workflowId:string):Promise<readonly DurableTask[]>{
    const r=await this.db.query<{payload:DurableTask}>("select payload from workflow_tasks where tenant_id=$1 and workflow_id=$2 order by task_id",[tenantId,workflowId]);return Object.freeze(r.rows.map(x=>decodeTask(x.payload)));
  }
  async transition(tenantId:string,taskId:string,expected:DurableTaskState,next:DurableTask):Promise<boolean>{
    const r=await this.db.query("update workflow_tasks set state=$4,payload=$5::jsonb,version=version+1,updated_at=now() where tenant_id=$1 and task_id=$2 and state=$3",[tenantId,taskId,expected,next.state,JSON.stringify({...next,version:next.version+1})]);return r.rowCount===1;
  }
  async appendEvent(event:WorkflowTaskEvent):Promise<void>{
    await this.db.query("insert into workflow_task_events (tenant_id,task_id,event_id,payload) values ($1,$2,$3,$4::jsonb)",[event.tenantId,event.taskId,event.id,JSON.stringify(event)]);
  }
}
export interface TaskExecutionResult { output: unknown }
export type TaskExecutor = (task: DurableTask, signal: AbortSignal) => Promise<TaskExecutionResult>;
export type TaskCompensator = (task: DurableTask, cause: unknown) => Promise<void>;
export class DurableWorkflowRuntime {
  private readonly controllers = new Map<string, AbortController>();
  constructor(private readonly store:WorkflowTaskStore,private readonly now:()=>Date=()=>new Date()){}
  async run(tenantId:string,taskId:string,actorId:string,execute:TaskExecutor,compensate?:TaskCompensator):Promise<DurableTask>{
    const task=await this.store.getTask(tenantId,taskId);if(!task)throw new WorkflowRuntimeError("TASK_NOT_FOUND");
    if(task.state!=="ready")throw new WorkflowRuntimeError("TASK_NOT_READY");
    if(!actorId)throw new WorkflowRuntimeError("TASK_ACTOR_REQUIRED");
    if(task.assignedActorId&&task.assignedActorId!==actorId)throw new WorkflowRuntimeError("TASK_ACTOR_MISMATCH");
    const all=await this.store.listTasks(tenantId,task.workflowId);
    if(!task.dependencies.every(id=>all.some(x=>x.id===id&&x.state==="succeeded")))throw new WorkflowRuntimeError("TASK_DEPENDENCIES_INCOMPLETE");
    if(task.approvalRequired&&!task.approvedBy){
      const waiting={...task,state:"awaiting_approval" as const,version:task.version+1};
      if(!await this.store.transition(tenantId,taskId,"ready",waiting))throw new WorkflowRuntimeError("TASK_CLAIM_CONFLICT");
      await this.event(waiting,"approval_required",actorId);return waiting;
    }
    const running={...task,state:"running" as const,attempt:task.attempt+1,version:task.version+1};
    if(!await this.store.transition(tenantId,taskId,"ready",running))throw new WorkflowRuntimeError("TASK_CLAIM_CONFLICT");
    await this.event(running,"started",actorId);
    const controller=new AbortController();const controllerKey=tenantId+":"+taskId;this.controllers.set(controllerKey,controller);let timer:ReturnType<typeof setTimeout>|undefined;
    try{
      const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new WorkflowRuntimeError("TASK_TIMEOUT"));},running.timeoutMs);});
      const result=await Promise.race([execute(running,controller.signal),timeout]);
      const succeeded={...running,state:"succeeded" as const,output:result.output,version:running.version+1};
      if(!await this.store.transition(tenantId,taskId,"running",succeeded))throw new WorkflowRuntimeError("TASK_STATE_CONFLICT");
      await this.event(succeeded,"succeeded",actorId);return succeeded;
    }catch(error){
      const latest = await this.store.getTask(tenantId,taskId);
      if(latest?.state==="cancelled")return latest;
      if(compensate){try{await compensate(running,error);}catch{error=new WorkflowRuntimeError("TASK_COMPENSATION_FAILED");}}
      const code=error instanceof Error?error.message:"TASK_EXECUTION_FAILED";
      const failed={...running,state:"failed" as const,errorCode:code,version:running.version+1};
      if(!await this.store.transition(tenantId,taskId,"running",failed))throw new WorkflowRuntimeError("TASK_STATE_CONFLICT");
      await this.event(failed,"failed",actorId,{errorCode:code});return failed;
    }finally{if(timer)clearTimeout(timer);this.controllers.delete(controllerKey);}
  }
  async approve(tenantId:string,taskId:string,approverId:string,reason:string):Promise<DurableTask>{
    if(!approverId||!reason.trim())throw new WorkflowRuntimeError("APPROVAL_METADATA_REQUIRED");
    const task=await this.store.getTask(tenantId,taskId);if(!task)throw new WorkflowRuntimeError("TASK_NOT_FOUND");
    if(task.requestedBy&&task.requestedBy===approverId)throw new WorkflowRuntimeError("APPROVER_NOT_INDEPENDENT");
    if(task.state!=="awaiting_approval")throw new WorkflowRuntimeError("TASK_NOT_AWAITING_APPROVAL");
    const next={...task,state:"ready" as const,approvedBy:approverId,version:task.version+1};
    if(!await this.store.transition(tenantId,taskId,"awaiting_approval",next))throw new WorkflowRuntimeError("TASK_STATE_CONFLICT");
    await this.event(next,"approved",approverId,{reason});return next;
  }
  async retry(tenantId:string,taskId:string,actorId:string):Promise<DurableTask>{
    const task=await this.store.getTask(tenantId,taskId);if(!task)throw new WorkflowRuntimeError("TASK_NOT_FOUND");
    if(task.state!=="failed"||task.attempt>=task.maxAttempts)throw new WorkflowRuntimeError("TASK_RETRY_BUDGET_EXHAUSTED");
    const { errorCode: _errorCode, ...withoutError } = task; const next={...withoutError,state:"ready" as const,version:task.version+1};
    if(!await this.store.transition(tenantId,taskId,"failed",next))throw new WorkflowRuntimeError("TASK_STATE_CONFLICT");
    await this.event(next,"retry_scheduled",actorId);return next;
  }
  async cancel(tenantId:string,taskId:string,actorId:string):Promise<DurableTask>{
    const task=await this.store.getTask(tenantId,taskId);if(!task)throw new WorkflowRuntimeError("TASK_NOT_FOUND");
    if(task.state==="succeeded"||task.state==="cancelled")throw new WorkflowRuntimeError("TASK_CANNOT_CANCEL");
    if(task.state==="running")this.controllers.get(tenantId+":"+taskId)?.abort();
    const next={...task,state:"cancelled" as const,version:task.version+1};
    if(!await this.store.transition(tenantId,taskId,task.state,next))throw new WorkflowRuntimeError("TASK_STATE_CONFLICT");
    await this.event(next,"cancelled",actorId);return next;
  }
  private async event(task:DurableTask,kind:string,actorId:string,detail?:unknown):Promise<void>{
    await this.store.appendEvent({id:this.makeId(),tenantId:task.tenantId,taskId:task.id,kind,actorId,occurredAt:this.now().toISOString(),...(detail===undefined?{}:{detail})});
  }
  private makeId():string{return randomUUID();}
}
