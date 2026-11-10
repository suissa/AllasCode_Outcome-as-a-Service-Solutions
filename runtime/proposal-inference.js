(function(global){
"use strict";
function normalizeAnswer(entry){
 if(entry&&typeof entry==="object"&&Object.prototype.hasOwnProperty.call(entry,"value"))return entry.value;
 return entry;
}
function unique(values){return [...new Set(values.filter(Boolean))]}
function buildProposal({graph,discovery,answers,createdAt=new Date().toISOString()}){
 if(!graph||graph.method!=="answer-only-associative-inference")throw new Error("PROPOSAL_GRAPH_INVALID");
 if(!discovery||!Array.isArray(discovery.stages))throw new Error("DISCOVERY_SCHEMA_INVALID");
 const questions=discovery.stages.flatMap(stage=>stage.questions.map(question=>({...question,stageId:stage.id,stageTitle:stage.title})));
 const questionById=new Map(questions.map(question=>[question.id,question]));
 const mappingById=new Map(graph.answerMappings.map(mapping=>[mapping.questionId,mapping]));
 const dimensions=new Map(graph.dimensions.map(item=>[item.id,item]));
 const modules=new Map(graph.modules.map(item=>[item.id,item]));
 const solutions=new Map(graph.solutions.map(item=>[item.id,item]));
 const facts=[],unknowns=[],trace=[],moduleScores=new Map(),solutionHits=new Map();
 const normalized=answers&&typeof answers==="object"?answers:{};
 for(const [questionId,entry] of Object.entries(normalized)){
  const question=questionById.get(questionId),mapping=mappingById.get(questionId);
  if(!question||!mapping)continue;
  const value=normalizeAnswer(entry);
  const isUnknown=value===undefined||value===null||value===""||value==="unknown"||(Array.isArray(value)&&value.length===0);
  if(isUnknown){
   unknowns.push({questionId,label:question.label,reason:"Não informado ou marcado como desconhecido"});
   const unknownMap=mapping.values.$unknown;
   if(unknownMap)trace.push({questionId,answer:"$unknown",dimensionId:unknownMap.dimensionId,kind:"unknown-gap"});
   continue;
  }
  const values=Array.isArray(value)?value:[value];
  for(const item of values){
   if(item==="unknown"){unknowns.push({questionId,label:question.label,reason:"Marcado explicitamente como desconhecido"});continue;}
   const key=question.type==="number"?"$numeric":question.type==="text"?"$text":String(item);
   const association=mapping.values[key]||mapping.values[String(item)];
   if(!association)continue;
   const rendered=Array.isArray(value)?String(item):String(item);
   const fact={questionId,label:question.label,value:item,displayValue:rendered,stageId:question.stageId,dimensionId:association.dimensionId,moduleIds:association.moduleIds||[]};
   facts.push(fact);
   trace.push({questionId,answer:key,dimensionId:association.dimensionId,kind:"answer-context"});
   for(const moduleId of association.moduleIds||[])moduleScores.set(moduleId,(moduleScores.get(moduleId)||0)+1);
   for(const link of association.solutionLinks||[]){
    if(!solutionHits.has(link.solutionId))solutionHits.set(link.solutionId,[]);
    solutionHits.get(link.solutionId).push({signal:link.signal,questionId,answer:item,weight:link.weight||1});
    trace.push({questionId,answer:key,solutionId:link.solutionId,signal:link.signal,kind:"solution-association"});
   }
  }
 }
 for(const question of questions){
  if(!Object.prototype.hasOwnProperty.call(normalized,question.id))unknowns.push({questionId:question.id,label:question.label,reason:"Pergunta ainda não respondida"});
 }
 const candidates=[...solutionHits.entries()].map(([id,hits])=>{
  const solution=solutions.get(id);
  const distinct=unique(hits.map(hit=>hit.signal));
  const total=Math.max(1,solution.signals.length);
  return {...solution,hits,matchedSignals:distinct,signalCount:distinct.length,totalSignals:total,signalCoverage:Math.round(distinct.length/total*100),status:distinct.length>=2?"multiple-signals":"single-signal",module:modules.get(solution.moduleId)};
 }).sort((a,b)=>b.signalCount-a.signalCount||b.signalCoverage-a.signalCoverage||a.name.localeCompare(b.name));
 const usedModules=unique([
  ...[...moduleScores.entries()].filter(([,score])=>score>0).map(([id])=>id),
  ...candidates.map(candidate=>candidate.moduleId)
 ]).map(id=>({...modules.get(id),contextMentions:moduleScores.get(id)||0,linkedSolutions:candidates.filter(candidate=>candidate.moduleId===id).map(candidate=>candidate.id)}));
 const getValue=id=>normalizeAnswer(normalized[id]);
 const profile={
  companyName:getValue("company_name")||"Empresa não identificada",
  segment:getValue("segment")||"Não informado",
  teamSize:getValue("team_size")||"Não informado",
  mainGoal:getValue("main_goal")||getValue("goal_target")||"Objetivo a confirmar",
  desiredOutcome:getValue("goal_target")||"A definir com o cliente",
  deadline:getValue("goal_deadline")||getValue("deadline")||"A combinar",
  priority:getValue("top_priority")||"A confirmar"
 };
 const constraints=questions.filter(q=>["investment","deadline","constraints","approver","diagnosis_validation","growth_capacity"].includes(q.id)).flatMap(q=>{
  const value=getValue(q.id);return value===undefined||value===null||value===""?[]:[{questionId:q.id,label:q.label,value}]
 });
 const metrics=unique(candidates.flatMap(candidate=>candidate.metrics||[]).concat(usedModules.flatMap(module=>module.metrics||[])));
 const evidence=unique(candidates.flatMap(candidate=>candidate.evidence||[]).concat(usedModules.flatMap(module=>module.evidence||[])));
 const deliverables=unique(usedModules.flatMap(module=>module.deliverables||[]));
 const knownCount=facts.length,questionCount=questions.length;
 const completeness=Math.round(knownCount/questionCount*100);
 const associations=trace.filter(item=>item.kind==="solution-association").length;
 const summary=candidates.length
  ? "As respostas indicam frentes que merecem ser exploradas: "+unique(candidates.slice(0,3).map(x=>x.name)).join(", ")+". A priorização ainda depende de validação de contexto, dados e evidências."
  : "As respostas ainda não formam associações suficientes com soluções específicas. A proposta deve começar por esclarecer objetivos, processos e fontes de informação.";
 return {
  schemaVersion:"1.0.0",inferenceMethod:graph.method,createdAt,stage:"pre-data-analysis",profile,
  summary,scope:{modules:usedModules.map(m=>({id:m.id,name:m.name,description:m.description})),deliverables,opportunities:candidates.map(({signals,...candidate})=>candidate),metrics,evidence},
  context:{facts,unknowns,constraints,completeness,answeredFacts:knownCount,totalQuestions:questionCount},
  graphTrace:{associationCount:associations,edgesTraversed:trace,dimensionIds:unique(facts.map(f=>f.dimensionId)),moduleIds:usedModules.map(m=>m.id)},
  governance:{status:"preliminary-hypothesis",dataAnalysisPerformed:false,externalDataUsed:false,causalClaims:false,commercialQuote:false,confidenceLabel:candidates.some(c=>c.status==="multiple-signals")?"Múltiplos sinais declarados":"Sinais iniciais ou contexto insuficiente",limitations:[graph.scope.disclaimer,"A força do sinal representa correspondência com regras declaradas, não probabilidade estatística.","Custos, prazos, arquitetura final e ganhos só podem ser definidos após análise de dados, validação técnica e acordo de escopo."]},
  nextPhase:{title:"Análise e validação de evidências",activities:["Validar respostas e corrigir premissas com o cliente","Solicitar somente as fontes de dados necessárias","Estabelecer linha de base e qualidade dos dados","Testar viabilidade, dependências, riscos e custos","Refinar escopo, indicadores e critérios de aceite"]}
 };
}
global.OaaSProposalInference={buildProposal};
})(window);
