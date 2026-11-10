(function () {
  const esc = v => String(v == null ? "" : v).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const li = xs => (xs || []).map(x => "<li>" + esc(x) + "</li>").join("");
  const feature = (title, body) => '<article class="feature"><h3>' + esc(title) + '</h3><p>' + esc(body) + '</p></article>';
  const classicSection = (id,title,lead,body) => '<section class="classic-section content-section" id="' + id + '"><h2>' + esc(title) + '</h2><p class="section-lead">' + esc(lead || "") + '</p>' + body + '</section>';
  const guildSection = (id,title,lead,body) => '<section class="guild-content-section" id="' + id + '"><div class="guild-section-heading"><small>REGISTRO DA GUILDA</small><h2>' + esc(title) + '</h2><p>' + esc(lead || "") + '</p></div>' + body + '</section>';
  async function start() {
    const pageRuntime = await window.OaaSPageReady;
    const exp = pageRuntime.sources.experience;
    const sectors = pageRuntime.sources["sector-playbooks"]?.sectors || [];
    const team = pageRuntime.sources["agent-team"] || { roles: [] };
    const guild = document.body.classList.contains("guild-page");
    const mode = guild ? "guilda" : "classic";
    const copy = exp.presentation[mode], journey = exp.customerJourney || [];
    const phases = exp["90DayMethod"].phases || [], metrics = exp.measurement;
    const commercial = exp.commercialModel, faq = exp.faq || [];
    const nav = document.querySelector(guild ? ".guild-nav" : ".classic-links");
    const ids = guild ? {method:"metodo",solutions:"especialidades",ninetyDays:"jornada-90",measurement:"orbe",sectors:"reinos",faq:"perguntas"} : {method:"metodo",solutions:"solucoes",ninetyDays:"jornada-90",measurement:"orbe",sectors:"especialidades",faq:"perguntas"};
    if (nav) nav.innerHTML = Object.keys(copy.navigation).map(k => '<a href="#' + ids[k] + '">' + esc(copy.navigation[k]) + '</a>').join("");
    if (!guild) {
      document.title = "OaaS.Quest — " + exp.brand.category;
      const main = document.querySelector("main");
      main.innerHTML =
        '<section class="classic-hero"><div class="classic-eyebrow">' + esc(copy.hero.eyebrow) + '</div><h1>' + esc(copy.hero.title) + '<br><em>' + esc(copy.hero.titleEmphasis) + '</em></h1><p>' + esc(copy.hero.body) + '</p><div class="classic-actions"><a href="#empresarios">' + esc(copy.hero.primaryCta) + '</a><a href="#metodo">' + esc(copy.hero.secondaryCta) + '</a></div></section>' +
        classicSection("metodo",copy.method.title,copy.method.body,'<div class="journey-grid">' + journey.map((s,i)=>feature(String(i+1).padStart(2,"0") + " · " + s.title,s.description)).join("") + '</div>') +
        classicSection("jornada-90",copy.ninetyDays.title,copy.ninetyDays.body,'<div class="timeline-grid">' + phases.map(p=>'<article class="timeline-card"><small>' + esc(p.period) + '</small><h3>' + esc(p.name) + '</h3><p>' + esc(p.goal) + '</p><strong>Entregas</strong><ul>' + li(p.deliverables) + '</ul></article>').join("") + '</div><p class="content-disclaimer">' + esc(copy.ninetyDays.disclaimer) + '</p>') +
        classicSection("solucoes",copy.custom.title,copy.custom.body,'<p class="solution-approach">' + esc(exp.solutionPrinciples.approach) + '</p><div class="feature-grid">' + exp.solutionPrinciples.buildingBlocks.map((p,i)=>feature("Capacidade " + (i+1),p)).join("") + '</div><div class="decision-rules"><strong>Como escolhemos a solução</strong><ul>' + li(exp.solutionPrinciples.decisionRules) + '</ul></div>') +
        classicSection("especialidades","Conhecimento aplicado a diferentes setores","A missão é adaptada ao contexto, às regras e aos indicadores de cada operação.",'<div class="sector-grid">' + sectors.map(s=>'<article class="sector-card"><h3>' + esc(s.name) + '</h3><strong>Resultados buscados</strong><ul>' + li(s.outcomes.slice(0,3)) + '</ul><strong>Indicadores</strong><p>' + esc(s.metrics.slice(0,5).join(" · ")) + '</p></article>').join("") + '</div>') +
        classicSection("orbe",copy.measurement.title,copy.measurement.body,'<div class="feature-grid">' + metrics.dashboardMetrics.map((m,i)=>feature("Indicador " + (i+1),m)).join("") + '</div><p class="content-disclaimer">' + esc(metrics.integrity) + '</p>') +
        classicSection("modelo-comercial",commercial.headline,commercial.principle,'<div class="commercial-grid">' + commercial.components.map(c=>feature(c.name,c.description)).join("") + '</div><p class="content-disclaimer">' + esc(commercial.trustStatement) + '</p>') +
        classicSection("perguntas","Perguntas frequentes","Respostas diretas sobre a jornada, o prazo e a validação.",'<div class="faq-grid">' + faq.map(f=>'<details class="faq-item"><summary>' + esc(f.question) + '</summary><p>' + esc(f.answer) + '</p></details>').join("") + '</div>') +
        '<section class="classic-section closing-section" id="empresarios"><h2>' + esc(copy.closing.title) + '</h2><p class="section-lead">' + esc(copy.closing.body) + '</p><div style="text-align:center"><a class="classic-cta" href="guilda.html">' + esc(copy.closing.cta) + '</a></div></section>';
    } else {
      const welcome = document.querySelector(".guild-welcome");
      if (welcome) welcome.innerHTML = '<div class="guild-emblem">✧</div><h1>' + esc(copy.hero.title) + '</h1><p>' + esc(copy.hero.body) + '</p><div class="guild-hero-actions"><a href="#composer">' + esc(copy.hero.primaryCta) + '</a><a href="#jornada-90">' + esc(copy.hero.secondaryCta) + '</a></div>';
      const jt = document.querySelector(".journal-title"); if (jt) jt.textContent = "Diário da Jornada";
      const jc = document.querySelectorAll(".guild-side .journal-card");
      if (jc[0]) jc[0].querySelector("small").textContent = "MISSÃO ATUAL";
      if (jc[1]) { jc[1].querySelector("small").textContent = "CAMINHOS DA GUILDA"; jc[1].querySelector("p").textContent = "Explore especialidades, ofícios e recursos reunidos para cada missão."; }
      const host = document.getElementById("oq-guild-content");
      if (host) {
        const questNames = ["Chamado da Missão","Reconhecimento do Território","Busca por Oportunidades","Mapa da Jornada","Forjaria da Solução","Vigília da Expedição","Provas da Conquista"];
        const chapterNames = ["Capítulo I · Reconhecimento","Capítulo II · Estratégia","Capítulo III · Forjaria","Capítulo IV · Expedição e Provas","Capítulo V · Conquista e Evolução"];
        host.innerHTML =
          guildSection("metodo",copy.method.title,copy.method.body,'<div class="guild-journey-list">' + journey.map((s,i)=>'<article class="guild-journey-card"><span class="quest-number">' + String(i+1).padStart(2,"0") + '</span><div><h3>' + esc(questNames[i] || s.title) + '</h3><p>' + esc(s.description) + '</p><small>REGISTROS: ' + esc(s.customerReceives.join(" · ")) + '</small></div></article>').join("") + '</div>') +
          guildSection("jornada-90",copy.ninetyDays.title,copy.ninetyDays.body,'<div class="guild-timeline">' + phases.map((p,i)=>'<article class="guild-phase"><small>' + esc(p.period) + '</small><h3>' + esc(chapterNames[i] || p.name) + '</h3><p>' + esc(p.goal) + '</p><strong>Artefatos da etapa</strong><ul>' + li(p.deliverables) + '</ul></article>').join("") + '</div><p class="content-disclaimer">' + esc(copy.ninetyDays.disclaimer) + '</p>') +
          guildSection("especialidades","Os ofícios da Guilda","Cada desafio convoca uma combinação diferente de conhecimentos e ferramentas.",'<div class="guild-role-grid">' + team.roles.map(r=>'<article class="guild-role-card"><small>' + esc(r.id.replace(/-/g," ").toUpperCase()) + '</small><h3>' + esc(r.guildaName || r.name) + '</h3><p>' + esc(r.purpose) + '</p><strong>Artefatos entregues</strong><ul>' + li(r.outputs.slice(0,3)) + '</ul></article>').join("") + '</div>') +
          guildSection("reinos","Reinos e ofícios atendidos","A Guilda adapta sua estratégia às características de cada setor.",'<div class="guild-sector-grid">' + sectors.map(s=>'<article class="guild-sector-card"><h3>' + esc(s.guildaName || s.name) + '</h3><p class="sector-real-name">' + esc(s.name) + '</p><strong>Conquistas possíveis</strong><ul>' + li(s.outcomes.slice(0,3)) + '</ul><strong>Orbe de métricas</strong><p>' + esc(s.metrics.slice(0,5).join(" · ")) + '</p></article>').join("") + '</div>') +
          guildSection("orbe",copy.measurement.title,copy.measurement.body,'<div class="guild-orb-grid">' + metrics.dashboardMetrics.map(m=>'<div class="orb-item"><span>✧</span>' + esc(m) + '</div>').join("") + '</div><p class="content-disclaimer">' + esc(metrics.integrity) + '</p>') +
          guildSection("tesouro","Acordos e recompensas",commercial.principle,'<div class="guild-role-grid">' + commercial.components.map(c=>'<article class="guild-role-card"><h3>' + esc(c.name) + '</h3><p>' + esc(c.description) + '</p></article>').join("") + '</div><p class="content-disclaimer">' + esc(commercial.trustStatement) + '</p>') +
          guildSection("perguntas","Perguntas ao Mestre","Informações importantes antes de aceitar uma missão.",'<div class="faq-grid">' + faq.map(f=>'<details class="faq-item"><summary>' + esc(f.question) + '</summary><p>' + esc(f.answer) + '</p></details>').join("") + '</div>') +
          '<section class="guild-final-call"><h2>' + esc(copy.closing.title) + '</h2><p>' + esc(copy.closing.body) + '</p><a href="#composer">' + esc(copy.closing.cta) + '</a></section>';
      }
    }
    document.querySelectorAll('a[href^="#"]').forEach(a=>a.addEventListener("click",()=>{if(window.OQ) OQ.logInteraction(mode,"content-navigation",{target:a.getAttribute("href")});}));
    if (window.OQ) OQ.logInteraction(mode,"content-loaded",{schemaVersion:exp.schemaVersion,sectorCount:sectors.length,roleCount:team.roles.length});
  }
  const boot=()=>Promise.all([window.OQReady,window.OaaSPageReady]).then(()=>start()).catch(error=>{
    console.error("Falha ao carregar conteúdo OaaS.Quest",error);
    const host=document.getElementById("oq-guild-content"); if(host) host.textContent="Não foi possível carregar os registros da Guilda. Atualize a página para tentar novamente.";
  });
  if(document.readyState==="loading") document.addEventListener("DOMContentLoaded",boot,{once:true});
  else boot();
})();