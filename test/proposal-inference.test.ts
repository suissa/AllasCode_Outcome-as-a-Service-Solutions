import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Script, runInNewContext } from "node:vm";

type Question={id:string;label:string;type:string;options?:{value:string;label:string}[];allowUnknown?:boolean};
type Discovery={version:string;engine:{storageKey:string};stages:{id:string;title:string;questions:Question[]}[];solutions:{id:string;signals:string[]}[]};
type Graph={method:string;dimensions:{id:string}[];modules:{id:string}[];solutions:{id:string;moduleId:string;signals:string[]}[];answerMappings:{questionId:string;dimensionId:string;moduleIds:string[];values:Record<string,{dimensionId:string;moduleIds:string[];solutionLinks:{solutionId:string;signal:string}[]}>}[];nodes:{id:string}[];edges:{from:string;to:string}[]};
const readJson=async<T>(path:string)=>JSON.parse(await readFile(path,"utf8")) as T;
const discovery=await readJson<Discovery>("content/discovery.pt-BR.json");
const graph=await readJson<Graph>("content/proposal-graph.pt-BR.json");
const runtime=await readFile("runtime/proposal-inference.js","utf8");
new Script(runtime);
const sandbox:{window:Record<string,any>}={window:{}};
runInNewContext(runtime,sandbox);
const build=sandbox.window.OaaSProposalInference.buildProposal as (args:{graph:Graph;discovery:Discovery;answers:Record<string,unknown>;createdAt?:string})=>any;
const questions=discovery.stages.flatMap(stage=>stage.questions);
const mappings=new Map(graph.answerMappings.map(mapping=>[mapping.questionId,mapping]));
const solutions=new Map(graph.solutions.map(solution=>[solution.id,solution]));
const make=(answers:Record<string,unknown>)=>build({graph,discovery,answers,createdAt:"2026-11-10T00:00:00.000Z"});
const assertValidProposal=(proposal:any)=>{
 assert.equal(proposal.governance.dataAnalysisPerformed,false);
 assert.equal(proposal.governance.externalDataUsed,false);
 assert.equal(proposal.governance.causalClaims,false);
 assert.equal(proposal.governance.commercialQuote,false);
 assert.ok(Array.isArray(proposal.context.facts));
 assert.ok(Array.isArray(proposal.context.unknowns));
 for(const candidate of proposal.scope.opportunities){
  assert.ok(solutions.has(candidate.id),`unknown solution ${candidate.id}`);
  assert.ok(graph.modules.some(module=>module.id===candidate.moduleId),`unknown module ${candidate.moduleId}`);
  assert.ok(candidate.signalCount>0);
  assert.ok(candidate.evidence.length>0);
  assert.ok(["single-signal","multiple-signals"].includes(candidate.status));
 }
};

test("association graph covers every Discovery question and every allowed answer",()=>{
 assert.equal(graph.method,"answer-only-associative-inference");
 assert.equal(graph.answerMappings.length,questions.length);
 assert.equal(new Set(graph.answerMappings.map(mapping=>mapping.questionId)).size,questions.length);
 for(const question of questions){
  const mapping=mappings.get(question.id);
  assert.ok(mapping,`missing mapping for ${question.id}`);
  assert.ok(mapping.values.$unknown,`missing unknown mapping for ${question.id}`);
  if(question.type==="text")assert.ok(mapping.values.$text,`missing free-text mapping for ${question.id}`);
  if(question.type==="number")assert.ok(mapping.values.$numeric,`missing numeric mapping for ${question.id}`);
  for(const option of question.options||[])assert.ok(mapping.values[option.value],`missing ${question.id}=${option.value}`);
  for(const moduleId of mapping.moduleIds)assert.ok(graph.modules.some(module=>module.id===moduleId),`unknown module ${moduleId}`);
 }
});

test("graph nodes and every association edge resolve to existing nodes",()=>{
 const nodeIds=new Set(graph.nodes.map(node=>node.id));
 assert.equal(nodeIds.size,graph.nodes.length,"node identifiers must be unique");
 for(const edge of graph.edges){
  assert.ok(nodeIds.has(edge.from),`missing edge source ${edge.from}`);
  assert.ok(nodeIds.has(edge.to),`missing edge target ${edge.to}`);
 }
 for(const mapping of graph.answerMappings){
  for(const [value,association] of Object.entries(mapping.values)){
   assert.ok(graph.dimensions.some(dimension=>dimension.id===association.dimensionId),`unknown dimension ${mapping.questionId}=${value}`);
   for(const link of association.solutionLinks)assert.ok(solutions.has(link.solutionId),`unknown solution ${link.solutionId}`);
  }
 }
});

test("every categorical answer independently resolves to a valid proposal context",()=>{
 for(const question of questions){
  for(const option of question.options||[]){
   const proposal=make({[question.id]:{value:option.value}});
   assertValidProposal(proposal);
   const isUnknown=option.value==="unknown";
   if(isUnknown)assert.ok(proposal.context.unknowns.some((item:any)=>item.questionId===question.id));
   else assert.ok(proposal.context.facts.some((item:any)=>item.questionId===question.id));
  }
 }
});

test("every possible selection subset for each multi-select question is covered",()=>{
 for(const question of questions.filter(item=>item.type==="multi")){
  const options=(question.options||[]).map(option=>option.value);
  const combinations=1<<options.length;
  for(let mask=0;mask<combinations;mask++){
   const selected=options.filter((_,index)=>(mask&(1<<index))!==0);
   const proposal=make({[question.id]:{value:selected}});
   assertValidProposal(proposal);
   const facts=proposal.context.facts.filter((item:any)=>item.questionId===question.id);
   const expected=selected.filter(value=>value!=="unknown").length;
   assert.equal(facts.length,expected,`${question.id} subset ${selected.join(",")}`);
  }
 }
});

test("every solution signal is reachable from its exact customer answer",()=>{
 for(const solution of graph.solutions){
  for(const signal of solution.signals){
   const separator=signal.indexOf(":");
   const questionId=signal.slice(0,separator),value=signal.slice(separator+1);
   assert.ok(mappings.get(questionId)?.values[value],`unmapped signal ${signal}`);
   const proposal=make({[questionId]:{value}});
   assertValidProposal(proposal);
   assert.ok(proposal.scope.opportunities.some((candidate:any)=>candidate.id===solution.id),`answer ${signal} did not reach ${solution.id}`);
  }
 }
});

test("all pairs of distinct signal answers combine without losing traceability",()=>{
 const signals=graph.solutions.flatMap(solution=>solution.signals.map(signal=>({solutionId:solution.id,signal})));
 for(let i=0;i<signals.length;i++)for(let j=i+1;j<signals.length;j++){
  const first=signals.at(i),second=signals.at(j);
  if(!first||!second)continue;
  const split=(signal:string):[string,string]=>{const at=signal.indexOf(":");return [signal.slice(0,at),signal.slice(at+1)]};
  const firstParts=split(first.signal),secondParts=split(second.signal);
  const q1:string=firstParts[0],v1:string=firstParts[1],q2:string=secondParts[0],v2:string=secondParts[1];
  if(q1===q2&&v1!==v2)continue;
  const answerSet:Record<string,unknown>={};
  answerSet[q1]={value:v1};answerSet[q2]={value:v2};
  const proposal=make(answerSet);
  assertValidProposal(proposal);
  assert.ok(proposal.graphTrace.edgesTraversed.length>=2);
  assert.ok(proposal.context.facts.length>=1);
 }
});

test("unknown, unanswered, and not-applicable values are not invented as problem evidence",()=>{
 for(const answers of [{},{lead_registration:{value:"unknown"}},{lead_registration:{value:null}},{lead_registration:{value:"none"}},{has_inventory:{value:"no"}}]){
  const proposal=make(answers);
  assertValidProposal(proposal);
  if(Object.keys(answers).length===0)assert.equal(proposal.scope.opportunities.length,0);
  const lead=answers["lead_registration"] as {value?:unknown}|undefined;
  if(lead?.value==="unknown"||lead?.value===null)assert.equal(proposal.scope.opportunities.length,0);
 }
});

test("numeric and free-text answers are preserved as context, not converted into unsupported signals",()=>{
 for(const value of [0,1,12.5,1000000]){
  const proposal=make({monthly_revenue:{value}});
  assertValidProposal(proposal);
  assert.equal(proposal.context.facts[0].value,value);
  assert.equal(proposal.scope.opportunities.length,0);
 }
 const text="<script>alert('x')</script> objetivo livre";
 const proposal=make({goal_target:{value:text}});
 assertValidProposal(proposal);
 assert.equal(proposal.context.facts[0].value,text);
 assert.equal(proposal.scope.opportunities.length,0);
});

test("proposal inference is deterministic and explicitly precedes data analysis",()=>{
 const answers={segment:{value:"retail"},lead_registration:{value:"none"},abandonment_tracking:{value:"no"},investment:{value:"limited"}};
 const first=make(answers),second=make(answers);
 assert.equal(JSON.stringify(first),JSON.stringify(second));
 assert.equal(first.stage,"pre-data-analysis");
 assert.equal(first.governance.status,"preliminary-hypothesis");
 assert.ok(first.governance.limitations.length>=3);
 assert.ok(first.nextPhase.activities.length>=4);
});

test("proposal report has a print-to-PDF action and A4 print stylesheet",async()=>{
 const report=await readFile("runtime/proposal-report.js","utf8");
 const css=await readFile("layouts/proposal.css","utf8");
 const layout=await readJson<{scripts:string[]}>("layouts/proposal.json");
 const page=await readJson<{route:string;entry:string;layout:string;contentRefs:string[]}>("pages/pt-BR/proposal.json");
 new Script(report);
 assert.ok(report.includes("window.print()"));
 assert.ok(report.includes("goaltropic.discovery.v1")===false);
 assert.ok(css.includes("@page{size:A4"));
 assert.ok(css.includes("@media print"));
 assert.ok(layout.scripts.includes("runtime/proposal-inference.js"));
 assert.ok(layout.scripts.includes("runtime/proposal-report.js"));
 assert.equal(page.route,"/proposta");
 assert.ok(page.contentRefs.includes("proposal-graph"));
 await readFile(page.entry,"utf8");
});
