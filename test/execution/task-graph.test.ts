import test from "node:test";
import assert from "node:assert/strict";
import { canDispatchTask, executionWaves, transitionExecution, validateTaskGraph, type TaskDefinition } from "../../src/execution/task-graph.ts";
const tasks: TaskDefinition[] = [
 { id:"task_alpha", tenantId:"tenant_demo", title:"Diagnose", dependencies:[], actorKind:"human", actorId:"actor_001", risk:"low", approvalRequired:false, inputSchema:"diagnosis.input.v1", outputSchema:"diagnosis.output.v1", idempotencyKey:"idem_alpha" },
 { id:"task_beta", tenantId:"tenant_demo", title:"Implement", dependencies:["task_alpha"], actorKind:"ai", actorId:"agent_001", risk:"high", approvalRequired:true, inputSchema:"implementation.input.v1", outputSchema:"implementation.output.v1", idempotencyKey:"idem_beta" },
 { id:"task_gamma", tenantId:"tenant_demo", title:"Verify", dependencies:["task_beta"], actorKind:"service", risk:"medium", approvalRequired:false, inputSchema:"verify.input.v1", outputSchema:"verify.output.v1", idempotencyKey:"idem_gamma" },
];
test("task graph validates and schedules deterministic dependency waves",()=>{
 assert.deepEqual(validateTaskGraph(tasks,"tenant_demo"),[]);
 assert.deepEqual(executionWaves(tasks),[["task_alpha"],["task_beta"],["task_gamma"]]);
 assert.equal(canDispatchTask(tasks[1]!,new Set(["task_alpha"]),false),false);
 assert.equal(canDispatchTask(tasks[1]!,new Set(["task_alpha"]),true),true);
});
test("task graph rejects cycles, unknown dependencies and tenant leakage",()=>{
 assert.ok(validateTaskGraph([{...tasks[0]!,dependencies:["task_beta"]},tasks[1]!],"tenant_demo").some(x=>x.code==="TASK_GRAPH_CYCLE"));
 assert.ok(validateTaskGraph([{...tasks[0]!,dependencies:["task_missing"]}],"tenant_demo").some(x=>x.code==="TASK_DEPENDENCY_UNKNOWN"));
 assert.ok(validateTaskGraph([{...tasks[0]!,tenantId:"tenant_other"}],"tenant_demo").some(x=>x.code==="TASK_TENANT_MISMATCH"));
});
test("execution controls enforce legal transitions and count replay",()=>{
 let state={status:"draft" as const,version:1,replayCount:0};
 state=transitionExecution(state,"approve"); state=transitionExecution(state,"start"); state=transitionExecution(state,"pause"); state=transitionExecution(state,"resume"); state=transitionExecution(state,"fail"); state=transitionExecution(state,"replay");
 assert.deepEqual(state,{status:"running",version:7,replayCount:1});
 assert.throws(()=>transitionExecution(state,"pause"),/EXECUTION_TRANSITION_INVALID/);
});
