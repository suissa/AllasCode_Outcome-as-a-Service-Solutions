(async()=>{'use strict';
const pageRuntime=await window.OaaSPageReady;
const config=pageRuntime.sources.discovery;
const copy=pageRuntime.sources["ui-copy"].discovery;
const root=document.getElementById('app');let index=0,answers={},transitioning=false,showResults=false;
const key=config.engine.storageKey;
let handoffSource=null,handoffMissionSummary=null;
try{const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved&&saved.answers){answers=saved.answers;index=Math.min(saved.index||0,config.stages.length-1);if(saved.source==='chat'){handoffSource=saved.missionId||'chat';handoffMissionSummary=saved.missionSummary||null}}}catch{}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const save=()=>{try{localStorage.setItem(key,JSON.stringify({index,answers,updatedAt:new Date().toISOString(),source:handoffSource?'chat':'discovery',...(handoffSource?{missionId:handoffSource,missionSummary:handoffMissionSummary}: {})}))}catch{}};
const stage=config.stages[index];
function getValue(id){return answers[id]?.value}
function setAnswer(q,value){answers[q.id]={value,status:value===''||value===null?'unknown':'provided',updatedAt:new Date().toISOString()};save()}
function renderQuestion(q){
 const value=getValue(q.id);
 let control='';
 if(q.type==='single'||q.type==='multi'){
  control='<div class="grid gap-2 sm:grid-cols-2">'+q.options.map(o=>'<label class="option"><input type="'+(q.type==='multi'?'checkbox':'radio')+'" name="'+esc(q.id)+'" value="'+esc(o.value)+'" '+(q.type==='multi'?(Array.isArray(value)&&value.includes(o.value)?'checked':''):(value===o.value?'checked':''))+ '><span>'+esc(o.label)+'</span></label>').join('')+'</div>';
 }else if(q.type==='number'||q.type==='text'){
  control='<input class="field" type="'+(q.type==='number'?'number':'text')+'" '+(q.type==='number'?'min="0" step="any"':'')+' data-field="'+esc(q.id)+'" value="'+esc(value??'')+'" placeholder="'+(q.type==='number'?copy.numberPlaceholder:copy.textPlaceholder)+'">';
 }
 const unknown='<button class="text-xs muted underline mt-2" data-unknown="'+esc(q.id)+'">'+copy.unknown+'</button>';
 return '<section class="py-4 border-b last:border-0" style="border-color:var(--border)"><div class="flex gap-3 items-start mb-3"><span class="pill">'+String(q.order).padStart(2,'0')+'</span><div class="min-w-0"><h3 class="font-semibold">'+esc(q.label)+'</h3><p class="text-xs muted mt-1">'+copy.optionalHint+'</p></div></div>'+control+unknown+'</section>';
}
function shell(content){
 const pct=Math.round(((index+(showResults?1:0))/config.stages.length)*100);
 root.innerHTML='<div class="max-w-5xl mx-auto px-4 py-6 md:px-8"><header class="flex items-center justify-between gap-4 mb-7"><div><div class="text-xs tracking-[.2em] accent font-bold">GOALTROPIC</div><div class="text-lg font-semibold">Discovery Engine</div></div><div class="flex items-center gap-2"><span class="pill">'+(showResults?copy.diagnostic:(copy.stage+' '+(index+1)+' / '+config.stages.length))+'</span><button class="button button-secondary text-sm" id="themeToggle" type="button">'+copy.theme+'</button></div></header><div class="progress-track mb-2"><div class="progress-fill" style="width:'+pct+'%"></div></div><div class="flex justify-between text-xs muted mb-6"><span>'+pct+'%'+copy.progressSuffix+'</span><span>'+Object.keys(answers).length+' '+copy.answersSuffix+'</span></div>'+(handoffSource?'<div class="panel p-4 mb-5"><strong class="accent">'+copy.handoffTitle+'</strong><p class="text-xs muted mt-1">'+copy.handoffDescription+'</p></div>':'')+'<main id="screen" class="screen">'+content+'</main><footer class="mt-8 pt-4 border-t text-xs muted flex flex-wrap justify-between gap-2" style="border-color:var(--border)"><span>'+copy.footerStorage+'</span><button id="reset" class="underline">'+copy.reset+'</button></footer></div>';
 document.getElementById('themeToggle').onclick=toggleTheme;document.getElementById('reset').onclick=reset;
}
function renderStage(){
 const s=config.stages[index];
 shell('<div class="panel p-5 md:p-8"><div class="flex flex-wrap items-center gap-2 mb-4"><span class="pill">'+copy.discovery+'</span><span class="text-xs muted">'+copy.phase+' '+(Math.floor(index/5)+1)+'</span></div><h1 class="text-2xl md:text-3xl font-semibold">'+esc(s.title)+'</h1><p class="muted mt-2 mb-5">'+esc(s.description)+'</p><div class="space-y-1">'+s.questions.map(renderQuestion).join('')+'</div><div class="flex flex-wrap items-center justify-between gap-3 pt-6 mt-3 border-t" style="border-color:var(--border)"><button class="button button-secondary" id="back" '+(index===0?'disabled':'')+'>'+copy.back+'</button><div class="flex gap-2"><button class="button button-secondary" id="skip">'+copy.skipStage+'</button><button class="button button-primary" id="next">'+(index===config.stages.length-1?copy.generateDiagnostic:copy.continue)+' →</button></div></div></div>');
 document.querySelectorAll('input[type=radio],input[type=checkbox]').forEach(el=>el.addEventListener('change',()=>{
  const q=s.questions.find(x=>x.id===el.name);if(!q)return;
  if(q.type==='multi'){const vals=[...document.querySelectorAll('input[name="'+q.id+'"]:checked')].map(x=>x.value);setAnswer(q,vals)}
  else setAnswer(q,el.value);
 }));
 document.querySelectorAll('[data-field]').forEach(el=>el.addEventListener('change',()=>{const q=s.questions.find(x=>x.id===el.dataset.field);setAnswer(q,el.value)}));
 document.querySelectorAll('[data-unknown]').forEach(el=>el.addEventListener('click',()=>{const q=s.questions.find(x=>x.id===el.dataset.unknown);setAnswer(q,null);el.textContent=copy.markedUnknown}));
 document.getElementById('back').onclick=()=>navigate(index-1);
 document.getElementById('skip').onclick=()=>navigate(index+1);
 document.getElementById('next').onclick=()=>{document.querySelectorAll('[data-field]').forEach(el=>{const q=s.questions.find(x=>x.id===el.dataset.field);if(el.value)setAnswer(q,el.value)});if(index===config.stages.length-1){showResults=true;showDiagnostic()}else navigate(index+1)};
}
function animate(el,cls,duration){
 return new Promise(resolve=>{
  if(matchMedia('(prefers-reduced-motion: reduce)').matches){resolve();return}
  let done=false;const finish=()=>{if(done)return;done=true;el.classList.remove('animate__animated',cls);resolve()};
  el.style.setProperty('--animate-duration',duration+'ms');el.classList.add('animate__animated',cls);
  el.addEventListener('animationend',e=>{if(e.target===el)finish()},{once:true});
  setTimeout(finish,duration+700);
 });
}
async function navigate(next){
 if(transitioning||next<0||next>=config.stages.length)return;transitioning=true;save();
 const current=document.getElementById('screen');await animate(current,config.animations.exit,config.animations.exitDurationMs);
 index=next;save();renderStage();
 const incoming=document.getElementById('screen');await animate(incoming,config.animations.enter,config.animations.enterDurationMs);
 transitioning=false;window.scrollTo({top:0,behavior:'smooth'});
}
function showDiagnostic(){
 const proposal=window.OaaSProposalInference.buildProposal({graph:pageRuntime.sources["proposal-graph"],discovery:config,answers});
 const results=proposal.scope.opportunities,known=proposal.context.facts,unknown=proposal.context.unknowns;
 const responseRows=known.map(f=>'<div class="flex justify-between gap-4 py-2 border-b text-sm" style="border-color:var(--border)"><span class="muted">'+esc(f.label)+'</span><strong class="text-right">'+esc(f.displayValue)+'</strong></div>').join('');
 const solutionCards=results.length?results.map(r=>'<article class="solution"><div class="flex flex-wrap justify-between gap-2"><h3 class="font-semibold">'+esc(r.name)+'</h3><span class="pill">'+(r.status==='multiple-signals'?copy.consistentSignal:copy.needsEvidence)+'</span></div><p class="text-sm muted mt-2">'+esc(r.description)+'</p><div class="text-xs mt-3"><strong>'+r.signalCount+'</strong> '+copy.signalCountSuffix+''+esc(r.effort)+'</div><div class="mt-3 text-xs"><strong>'+copy.indicators+'</strong> '+esc(r.metrics.join(' · '))+'</div><div class="mt-2 text-xs muted"><strong>'+copy.validateWith+'</strong> '+esc(r.evidence.join(' · '))+'</div></article>').join(''):'<p class="muted">'+copy.noMatches+'</p>';
 shell('<div class="space-y-5"><section class="panel p-5 md:p-7"><span class="pill">'+copy.resultLabel+'</span><h1 class="text-2xl md:text-3xl font-semibold mt-3">'+copy.preliminaryTitle+'</h1><p class="muted mt-2">'+copy.preliminaryDescription+'</p><p class="text-xs muted mt-3">'+esc(proposal.governance.confidenceLabel)+' · '+proposal.graphTrace.associationCount+' associações percorridas</p><div class="grid grid-cols-3 gap-3 mt-6"><div class="p-3 rounded-xl" style="background:var(--surface-2)"><div class="text-2xl font-semibold">'+known.length+'</div><div class="text-xs muted">'+copy.answered+'</div></div><div class="p-3 rounded-xl" style="background:var(--surface-2)"><div class="text-2xl font-semibold">'+unknown.length+'</div><div class="text-xs muted">'+copy.unknownAnswers+'</div></div><div class="p-3 rounded-xl" style="background:var(--surface-2)"><div class="text-2xl font-semibold">'+results.length+'</div><div class="text-xs muted">'+copy.opportunities+'</div></div></div></section><section class="panel p-5 md:p-7"><h2 class="text-xl font-semibold mb-4">'+copy.possibleSolutions+'</h2><div class="grid gap-3">'+solutionCards+'</div></section><section class="panel p-5 md:p-7"><h2 class="text-xl font-semibold mb-3">'+copy.recordedAnswers+'</h2>'+responseRows+'</section><div class="flex flex-wrap justify-between gap-3"><button class="button button-secondary" id="review">'+copy.reviewAnswers+'</button><div class="flex gap-2"><button class="button button-secondary" id="export">'+copy.exportJson+'</button><button class="button button-primary" id="proposal">'+copy.proposalCta+'</button></div></div></div>');
 document.getElementById('review').onclick=async()=>{showResults=false;index=config.stages.length-1;save();renderStage();await animate(document.getElementById('screen'),config.animations.enter,config.animations.enterDurationMs)};
 document.getElementById('proposal').onclick=()=>{save();window.location.href=new URL('../proposta/',document.baseURI).href};
 document.getElementById('export').onclick=()=>{const payload={schemaVersion:config.version,createdAt:proposal.createdAt,source:handoffSource?'chat':'discovery',missionId:handoffSource||undefined,answers,proposal};const blob=new Blob([JSON.stringify(payload,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download='goaltropic-proposta-preliminar.json';a.click();URL.revokeObjectURL(url)};
}
function toggleTheme(){const next=document.documentElement.dataset.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=next;document.body.dataset.theme=next;const t=next==='dark'?{bg:'#080B0F',surface:'#11161D',surface2:'#191F28',text:'#F2F2F0',muted:'#929AA5',accent:'#BC8E4F',border:'#29313C'}:{bg:'#F5F6F8',surface:'#FFFFFF',surface2:'#EDF0F4',text:'#171A20',muted:'#68717D',accent:'#92672D',border:'#D9DEE5'};const r=document.documentElement.style;r.setProperty('--bg',t.bg);r.setProperty('--surface',t.surface);r.setProperty('--surface-2',t.surface2);r.setProperty('--text',t.text);r.setProperty('--muted',t.muted);r.setProperty('--accent',t.accent);r.setProperty('--border',t.border)}
function reset(){if(!confirm(copy.confirmReset))return;answers={};index=0;showResults=false;localStorage.removeItem(key);renderStage()}
if(showResults)showDiagnostic();else renderStage();
})();
