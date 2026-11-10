(function(global){
'use strict';
function normalize(value){return Array.isArray(value)?value:[value]}
function infer(config,graph,answers){
 const answerMap=new Map(graph.answerNodes.map(n=>[n.id,n]));
 const solutionMap=new Map(config.solutions.map(s=>[s.id,s]));
 const solutionHits=new Map(config.solutions.map(s=>[s.id,[]]));
 const ignored=[];
 const observed=[];
 for(const [questionId,entry] of Object.entries(answers||{})){
  const value=entry&&Object.prototype.hasOwnProperty.call(entry,'value')?entry.value:entry;
  if(value===null||value===undefined||value===''||(Array.isArray(value)&&value.length===0)){ignored.push({questionId,reason:'unanswered'});continue}
  for(const selected of normalize(value)){
   if(selected===null||selected===undefined||selected===''||selected==='unknown'){ignored.push({questionId,value:selected,reason:'unknown'});continue}
   const nodeId='answer:'+questionId+':'+String(selected);
   if(!answerMap.has(nodeId)){ignored.push({questionId,value:selected,reason:'unmapped'});continue}
   observed.push(nodeId);
  }
 }
 const observedSet=new Set(observed);
 for(const edge of graph.edges){
  if(edge.relation!=='supports'||!observedSet.has(edge.from))continue;
  const solutionId=edge.to.replace(/^solution:/,'');
  if(solutionHits.has(solutionId))solutionHits.get(solutionId).push(edge.from);
 }
 const proposals=config.solutions.map(solution=>{
  const hits=[...new Set(solutionHits.get(solution.id))];
  const applicable=solution.signals.filter(signal=>{
   const split=signal.split(':');const q=split.shift(),v=split.join(':');
   return observedSet.has('answer:'+q+':'+v);
  });
  const missing=solution.signals.filter(signal=>!applicable.includes(signal));
  return {...solution,matchedNodes:hits,matchedSignals:applicable,missingSignals:missing,associationCount:hits.length,status:hits.length>=2?'candidate':hits.length===1?'review':'not_indicated'};
 }).filter(item=>item.status!=='not_indicated')
 .sort((a,b)=>b.associationCount-a.associationCount||a.id.localeCompare(b.id));
 const known=Object.keys(answers||{}).filter(id=>{const v=answers[id]?.value;return v!==null&&v!==undefined&&v!==''});
 const goal=answers?.main_goal?.value??null;
 const kpi=answers?.primary_kpi?.value??null;
 const constraints=answers?.constraints?.value??[];
 const proposal={
  kind:'preliminary-solution-proposal',version:'1.0.0',basis:'client-answers-and-curated-association-graph-only',
  generatedAt:new Date().toISOString(),
  boundary:'No operational datasets, financial records, analytics, external sources or inferred company facts were used.',
  scope:{declaredGoal:goal,successIndicator:kpi,target:answers?.target_value?.value??null,baseline:answers?.baseline_value?.value??null,deadline:answers?.deadline?.value??answers?.goal_deadline?.value??null,investment:answers?.investment?.value??null,constraints:Array.isArray(constraints)?constraints:constraints?[constraints]:[]},
  proposals,observedAnswerNodes:[...observedSet],ignoredAnswers:ignored,
  coverage:{answeredQuestions:known.length,totalQuestions:config.stages.reduce((n,s)=>n+s.questions.length,0),matchedAssociations:proposals.reduce((n,p)=>n+p.associationCount,0)},
  nextSteps:['Validar as respostas e corrigir premissas com o cliente','Solicitar somente as evidências necessárias para cada hipótese','Analisar dados e estabelecer a linha de base','Refinar escopo, entregáveis, indicadores e critérios de aceite']
 };
 return proposal;
}
global.OaaSInference={infer};
})(globalThis);
