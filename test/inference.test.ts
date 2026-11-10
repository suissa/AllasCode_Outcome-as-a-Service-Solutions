import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";

const root=process.cwd();
const read=async (path:string)=>JSON.parse(await readFile(join(root,path),"utf8"));
async function fixture(){
 const [config,graph,source]=await Promise.all([
  read("content/discovery.pt-BR.json"),
  read("content/inference-graph.pt-BR.json"),
  readFile(join(root,"runtime/inference.js"),"utf8")
 ]);
 const sandbox:Record<string,any>={};
 runInNewContext(source,{globalThis:sandbox});
 return {config,graph,infer:sandbox.OaaSInference.infer};
}
test("every configured answer option has an explicit graph node, including options without proposal edges",async()=>{
 const {config,graph}=await fixture();
 const nodes=new Set(graph.answerNodes.map(n=>n.id));
 let options=0;
 for(const stage of config.stages)for(const q of stage.questions)for(const option of q.options||[]){
  options++;
  assert.ok(nodes.has("answer:"+q.id+":"+option.value),`missing graph node for ${q.id}=${option.value}`);
 }
 assert.ok(options>0);
 assert.equal(new Set(graph.answerNodes.map(n=>n.id)).size,graph.answerNodes.length,"answer graph node IDs must be unique");
});
test("every configured solution signal resolves to a graph edge and an existing answer option",async()=>{
 const {config,graph}=await fixture();
 const edges=new Set(graph.edges.map(e=>e.from+"->"+e.to));
 const questions=new Map(config.stages.flatMap(s=>s.questions.map(q=>[q.id,q])));
 let signals=0;
 for(const solution of config.solutions)for(const signal of solution.signals){
  const [questionId,...parts]=signal.split(":");const value=parts.join(":");
  const question=questions.get(questionId);
  assert.ok(question,`unknown question in signal ${signal}`);
  assert.ok(question.options.some(o=>o.value===value),`unknown answer value in signal ${signal}`);
  if(value!=="unknown"){
   signals++;
   assert.ok(edges.has("answer:"+signal+"->solution:"+solution.id),`missing edge for ${solution.id} / ${signal}`);
  }
 }
 assert.ok(signals>0);
});
test("each answer option is evaluated independently and only linked answers create proposals",async()=>{
 const {config,graph,infer}=await fixture();
 for(const stage of config.stages)for(const q of stage.questions)for(const option of q.options||[]){
  const result=infer(config,graph,{[q.id]:{value:option.value}});
  const expected=config.solutions.filter(s=>s.signals.includes(q.id+":"+option.value)&&option.value!=="unknown").map(s=>s.id).sort();
  const actual=result.proposals.map(p=>p.id).sort();
  assert.deepEqual(actual,expected,`unexpected proposal mapping for ${q.id}=${option.value}`);
 }
});
test("unanswered, null, empty and explicit unknown values never create proposals",async()=>{
 const {config,graph,infer}=await fixture();
 for(const value of [undefined,null,"","unknown",[]]){
  const result=infer(config,graph,{lead_registration:{value},conversion_tracking:{value}});
  assert.equal(result.proposals.length,0);
 }
 const empty=infer(config,graph,{});
 assert.equal(empty.proposals.length,0);
});
test("two independent matched associations create a candidate, one creates review only",async()=>{
 const {config,graph,infer}=await fixture();
 const result=infer(config,graph,{
  lead_registration:{value:"none"},
  abandonment_tracking:{value:"no"}
 });
 const recovery=result.proposals.find(p=>p.id==="SOL-SALES-001");
 assert.ok(recovery);
 assert.equal(recovery.associationCount,2);
 assert.equal(recovery.status,"candidate");
 const single=infer(config,graph,{lead_registration:{value:"none"}});
 assert.equal(single.proposals.find(p=>p.id==="SOL-SALES-001")?.status,"review");
});
test("multi-select answers can activate multiple associations and unknown values remain ignored",async()=>{
 const {config,graph,infer}=await fixture();
 const result=infer(config,graph,{systems:{value:["erp","manual","unknown"]},integration:{value:"no"}});
 assert.ok(result.observedAnswerNodes.includes("answer:systems:erp"));
 assert.ok(result.observedAnswerNodes.includes("answer:systems:manual"));
 assert.ok(!result.observedAnswerNodes.includes("answer:systems:unknown"));
 assert.ok(result.ignoredAnswers.some(x=>x.reason==="unknown"));
});
test("proposal exposes declared client scope and explicitly excludes external datasets",async()=>{
 const {config,graph,infer}=await fixture();
 const result=infer(config,graph,{main_goal:{value:"sales"},primary_kpi:{value:"revenue"},target_value:{value:"R$ 50 mil"},constraints:{value:["financial"]}});
 assert.equal(result.kind,"preliminary-solution-proposal");
 assert.equal(result.basis,"client-answers-and-curated-association-graph-only");
 assert.equal(result.scope.declaredGoal,"sales");
 assert.equal(result.scope.successIndicator,"revenue");
 assert.equal(result.scope.target,"R$ 50 mil");
 assert.deepEqual(result.scope.constraints,["financial"]);
 assert.match(result.boundary,/No operational datasets/);
 assert.equal(result.coverage.totalQuestions,config.stages.reduce((n,s)=>n+s.questions.length,0));
});
