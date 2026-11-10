(async()=>{'use strict';
const page=await window.OaaSPageReady;
const graph=page.sources["proposal-graph"],discovery=page.sources.discovery,copy=page.sources["ui-copy"].proposal;
const mount=document.getElementById("proposal-report");
const esc=value=>String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const list=items=>items&&items.length?'<div class="list">'+items.map(item=>'<div class="list-item">'+esc(item)+'</div>').join("")+'</div>':'<p class="muted">'+copy.noModules+'</p>';
const section=(number,title,body)=>'<section class="section"><div class="section-heading"><span class="section-index">'+number+'</span><h2>'+title+'</h2></div>'+body+'</section>';
const questionMap=new Map(discovery.stages.flatMap(stage=>stage.questions.map(q=>[q.id,q])));
function displayAnswer(fact){
 const q=questionMap.get(fact.questionId);
 if(!q)return fact.displayValue;
 if(Array.isArray(q.options)){const option=q.options.find(o=>o.value===String(fact.value));if(option)return option.label}
 return fact.displayValue;
}
function render(){
 let saved=null;
 try{saved=JSON.parse(localStorage.getItem(discovery.engine.storageKey)||"null")}catch{}
 if(!saved||!saved.answers||!Object.keys(saved.answers).length){
  mount.innerHTML='<div class="empty report"><div class="toolbar-brand">'+copy.brand+'</div><h1>'+copy.emptyState+'</h1><a class="action primary" href="../descoberta/">'+copy.back+'</a></div>';return;
 }
 const proposal=window.OaaSProposalInference.buildProposal({graph,discovery,answers:saved.answers,createdAt:new Date().toISOString()});
 const p=proposal.profile,ctx=proposal.context,scope=proposal.scope;
 const date=new Intl.DateTimeFormat("pt-BR",{dateStyle:"long"}).format(new Date(proposal.createdAt));
 const candidateCards=scope.opportunities.length?scope.opportunities.map(item=>'<article class="card"><div class="flex flex-wrap justify-between gap-2"><span class="tag">'+(item.status==="multiple-signals"?copy.statusMultiple:copy.statusSingle)+'</span><span class="tag">'+esc(item.module?.name||item.moduleId)+'</span></div><h3 style="margin-top:12px">'+esc(item.name)+'</h3><p>'+esc(item.description)+'</p><div class="card-meta">'+copy.matched+': '+item.signalCount+' '+copy.of+' '+item.totalSignals+' · '+copy.strength+': '+item.signalCoverage+'%<br>'+copy.relatedMetrics+': '+esc((item.metrics||[]).join(" · "))+'<br>'+copy.requiresValidation+': '+esc((item.evidence||[]).join(" · "))+'</div></article>').join(""):'<p class="muted">'+copy.noOpportunities+'</p>';
 const moduleCards=scope.modules.length?'<div class="card-grid">'+scope.modules.map(m=>'<article class="card"><span class="tag">'+copy.moduleDescription+'</span><h3 style="margin-top:10px">'+esc(m.name)+'</h3><p>'+esc(m.description)+'</p></article>').join("")+'</div>':'<p class="muted">'+copy.noModules+'</p>';
 const contextRows=ctx.facts.map(f=>'<div class="kv"><span class="muted">'+esc(f.label)+'</span><strong>'+esc(displayAnswer(f))+'</strong></div>').join("");
 const constraintRows=ctx.constraints.map(f=>'<div class="kv"><span class="muted">'+esc(f.label)+'</span><strong>'+esc(Array.isArray(f.value)?f.value.join(", "):f.value)+'</strong></div>').join("");
 const unknownList=ctx.unknowns.map(x=>x.label);
 const trace=proposal.graphTrace.edgesTraversed.map(t=>{
  const question=questionMap.get(t.questionId);
  const answer=t.answer==="$unknown"?"Não informado":question?.options?.find(o=>o.value===t.answer)?.label||t.answer;
  const target=t.solutionId?scope.opportunities.find(x=>x.id===t.solutionId)?.name||t.solutionId:t.dimensionId;
  return '<div class="trace-item"><strong>'+esc(question?.label||t.questionId)+'</strong> → '+esc(answer)+' → '+esc(target)+' <span class="muted">('+esc(t.kind)+')</span></div>';
 }).join("");
 const assumptions=list(copy.assumptionsList);
 mount.innerHTML='<div class="toolbar no-print"><div class="toolbar-brand">'+copy.brand+'</div><div class="toolbar-actions"><a class="action" href="../descoberta/">'+copy.back+'</a><button class="action primary" id="printProposal">'+copy.exportPdf+'</button></div></div><article class="report"><header class="cover"><div class="eyebrow">'+copy.eyebrow+'</div><h1>'+copy.title+'</h1><p class="subtitle">'+copy.subtitle+'</p><div class="cover-meta"><div><span>'+copy.preparedFor+'</span><strong>'+esc(p.companyName)+'</strong></div><div><span>'+copy.generated+'</span><strong>'+date+'</strong></div><div><span>'+copy.preliminary+'</span><strong>'+esc(copy.statusSingle)+'</strong></div></div></header><div class="report-body"><div class="notice"><strong>'+copy.dataAnalysisNotice+'</strong></div><div class="stats"><div class="stat"><strong>'+ctx.answeredFacts+'</strong><span>'+copy.facts+'</span></div><div class="stat"><strong>'+ctx.completeness+'%</strong><span>'+copy.completeness+'</span></div><div class="stat"><strong>'+scope.opportunities.length+'</strong><span>'+copy.opportunities+'</span></div></div>'+section("01",copy.executiveSummary,'<p class="lead">'+esc(proposal.summary)+'</p><div class="columns" style="margin-top:18px"><div><div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.12em">'+copy.preparedFor+'</div><div style="font-weight:700">'+esc(p.companyName)+'</div><div class="muted" style="font-size:12px">'+esc(p.segment)+' · '+esc(p.teamSize)+'</div></div><div><div class="muted" style="font-size:10px;text-transform:uppercase;letter-spacing:.12em">Objetivo declarado</div><div style="font-weight:700">'+esc(p.desiredOutcome||p.mainGoal)+'</div><div class="muted" style="font-size:12px">Horizonte: '+esc(p.deadline)+'</div></div></div>')+section("02",copy.opportunities,'<div class="card-grid">'+candidateCards+'</div>')+section("03",copy.scope,moduleCards)+section("04",copy.deliverables,list(scope.deliverables))+section("05",copy.metrics,list(scope.metrics))+section("06",copy.evidence,list(scope.evidence))+section("07",copy.context,'<div>'+contextRows+'</div>')+section("08",copy.constraints,(constraintRows?'<div>'+constraintRows+'</div>':'<p class="muted">'+copy.noConstraints+'</p>')+'<h3 style="margin:18px 0 10px">'+copy.unknowns+'</h3>'+list(unknownList))+section("09",copy.assumptions,assumptions)+section("10",copy.trace,'<details><summary>'+copy.trace+' · '+proposal.graphTrace.associationCount+' '+copy.matched.toLowerCase()+'</summary><div class="trace-list">'+(trace||'<p class="muted">'+copy.noOpportunities+'</p>')+'</div></details>')+section("11",copy.next,'<h3>'+esc(proposal.nextPhase.title)+'</h3><p class="muted" style="font-size:13px;margin:8px 0 14px">'+copy.stageDescription+'</p>'+list(proposal.nextPhase.activities))+'<section class="section"><div class="notice"><strong>'+copy.disclaimerTitle+'.</strong><br>'+esc(proposal.governance.limitations.join(" "))+'<br><br>'+copy.scopeNotice+'</div></section><footer class="footer"><span>'+copy.footer+'</span><span>'+copy.brand+' · '+date+'</span></footer></div></article>';
 document.getElementById("printProposal").onclick=()=>window.print();
}
render();
})();