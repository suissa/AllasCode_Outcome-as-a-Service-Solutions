import test from "node:test";
import assert from "node:assert/strict";
import { DurableWorkflowRuntime, type DurableTask, type WorkflowTaskStore } from "../../src/execution/durable-runtime.ts";
class MemoryStore implements WorkflowTaskStore {
 tasks=new Map<string,DurableTask>(); events:unknown[]=[];
 async createTask(t:DurableTask){this.tasks.set(t.id,t)}
 async getTask(tenant:string,id:string){const t=this.tasks.get(id);return t?.tenantId===tenant?t:undefined}
 async listTasks(tenant:string,workflow:string){return [...this.tasks.values()].filter(t=>t.tenantId===tenant&&t.workflowId===workflow)}
 async transition(tenant:string,id:string,expected:DurableTask["state"],next:DurableTask){const t=this.tasks.get(id);if(!t||t.tenantId!==tenant||t.state!==expected)return false;this.tasks.set(id,next);return true}
 async appendEvent(e:unknown){this.events.push(e)}
}
const task=(id:string,overrides:Partial<DurableTask>={}):DurableTask=>({id,tenantId:"tenant_001",workflowId:"workflow_001",dependencies:[],state:"ready",attempt:0,maxAttempts:2,timeoutMs:1000,idempotencyKey:"idem_"+id,approvalRequired:false,input:{},version:1,...overrides});
test("durable runtime checks dependencies and persists task completion",async()=>{
 const store=new MemoryStore();await store.createTask(task("task_parent"));await store.createTask(task("task_child",{dependencies:["task_parent"]}));
 const runtime=new DurableWorkflowRuntime(store,()=>new Date("2026-11-08T10:00:00Z"));
 await assert.rejects(()=>runtime.run("tenant_001","task_child","actor",async()=>({output:true})),/TASK_DEPENDENCIES_INCOMPLETE/);
 await runtime.run("tenant_001","task_parent","actor",async()=>({output:{ok:true}}));
 const child=await runtime.run("tenant_001","task_child","actor",async()=>({output:{done:true}}));
 assert.equal(child.state,"succeeded");assert.equal(store.events.length,4);
});
test("durable runtime enforces approval, retry budget and cancellation",async()=>{
 const store=new MemoryStore();await store.createTask(task("task_approval",{approvalRequired:true}));
 const runtime=new DurableWorkflowRuntime(store);
 const waiting=await runtime.run("tenant_001","task_approval","requester",async()=>({output:null}));
 assert.equal(waiting.state,"awaiting_approval");
 await runtime.approve("tenant_001","task_approval","reviewer","approved after review");
 const failed=await runtime.run("tenant_001","task_approval","reviewer",async()=>{throw new Error("TEMPORARY")});
 assert.equal(failed.state,"failed");
 const ready=await runtime.retry("tenant_001","task_approval","reviewer");assert.equal(ready.state,"ready");
 const cancelled=await runtime.cancel("tenant_001","task_approval","reviewer");assert.equal(cancelled.state,"cancelled");
});
test("durable runtime times out and invokes compensation",async()=>{
 const store=new MemoryStore();await store.createTask(task("task_timeout",{timeoutMs:5}));
 const runtime=new DurableWorkflowRuntime(store);
 let compensated=false;
 const result=await runtime.run("tenant_001","task_timeout","actor",async(_task,signal)=>new Promise((_resolve,reject)=>{signal.addEventListener("abort",()=>reject(new Error("ABORTED")));}),async()=>{compensated=true;});
 assert.equal(result.state,"failed");assert.equal(result.errorCode,"TASK_TIMEOUT");assert.equal(compensated,true);
});

test("durable runtime requires independent approval and cancels running work",async()=>{
 const store=new MemoryStore();await store.createTask(task("task_cancel",{approvalRequired:true,requestedBy:"owner"}));
 const runtime=new DurableWorkflowRuntime(store);
 await runtime.run("tenant_001","task_cancel","owner",async()=>({output:null}));
 await assert.rejects(()=>runtime.approve("tenant_001","task_cancel","owner","self approval"),/APPROVER_NOT_INDEPENDENT/);
 await runtime.approve("tenant_001","task_cancel","reviewer","independent approval");
 let started!:()=>void;const began=new Promise<void>(resolve=>{started=resolve;});
 const running=runtime.run("tenant_001","task_cancel","reviewer",async(_task,signal)=>new Promise((_resolve,reject)=>{started();signal.addEventListener("abort",()=>reject(new Error("ABORTED")));}));
 await began;
 const cancelled=await runtime.cancel("tenant_001","task_cancel","reviewer");
 assert.equal(cancelled.state,"cancelled");
 assert.equal((await running).state,"cancelled");
});

test("durable runtime pauses and resumes active work and escalates blocked tasks",async()=>{
 const store=new MemoryStore();await store.createTask(task("task_pause"));
 const runtime=new DurableWorkflowRuntime(store);
 let started!:()=>void;const began=new Promise<void>(resolve=>{started=resolve;});
 const pending=runtime.run("tenant_001","task_pause","actor",async(_task,signal)=>new Promise((_resolve,reject)=>{started();signal.addEventListener("abort",()=>reject(new Error("ABORTED")));}));
 await began;
 assert.equal((await runtime.pause("tenant_001","task_pause","operator","awaiting clarification")).state,"paused");
 assert.equal((await pending).state,"paused");
 assert.equal((await runtime.resume("tenant_001","task_pause","operator","clarification resolved")).state,"ready");
 assert.equal((await runtime.run("tenant_001","task_pause","actor",async()=>({output:"done"}))).state,"succeeded");
 await store.createTask(task("task_block"));
 assert.equal((await runtime.block("tenant_001","task_block","operator","ambiguous request")).state,"blocked");
 assert.equal((await runtime.unblock("tenant_001","task_block","reviewer","clarified scope")).state,"ready");
 assert.equal((await runtime.cancel("tenant_001","task_block","owner")).state,"cancelled");
});
