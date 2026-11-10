/**
 * Renderer da página Site (OaaS.Quest).
 *
 * Monta a página institucional a partir do conteúdo externo em content/*.json.
 * A copy vem inteira do manifesto; o runtime só estrutura e mede.
 * Uma classe semântica por tipo de elemento — as cores vêm dos tokens de tema.
 */


const esc = value =>
  String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

const pad = n => String(n).padStart(2, "0");

const ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEVRON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const TREND = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M3 17l5.5-5.5 3.5 3.5L21 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 6h6v6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const NAV = [
  { key: "method", href: "#metodo" },
  { key: "solutions", href: "#solucoes" },
  { key: "ninetyDays", href: "#ciclo-90" },
  { key: "measurement", href: "#metricas" },
  { key: "sectors", href: "#setores" },
  { key: "faq", href: "#duvidas" }
];

function renderHero(exp, copy) {
  return `<section class="hero">
    <div class="hero-grid">
      <div class="hero-copy">
        <span class="hero-badge">${TREND}</span>
        <h1 class="hero-title" data-words><span class="hero-lead">${esc(copy.hero.title)}</span><span class="hero-accent">${esc(copy.hero.titleEmphasis)}</span></h1>
        <p class="hero-text" data-reveal data-delay="350">${esc(copy.hero.body)}</p>
        <div class="hero-actions" data-reveal data-delay="500">
          <a class="cta" href="/chat">${esc(copy.hero.primaryCta)}${ARROW}</a>
          <a class="cta" data-variant="ghost" href="#metodo">${esc(copy.hero.secondaryCta)}</a>
        </div>
        <p class="hero-note" data-reveal data-delay="620">${esc(exp.brand.promise)}</p>
      </div>
    </div>
  </section>`;
}

function renderPanel(exp, copy) {
  const steps = exp.customerJourney.slice(0, 3);
  return `<section class="section" data-density="compact" id="como-funciona">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">${esc(copy.method.title)}</h2>
        <p class="section-lead">${esc(copy.method.body)}</p>
      </div>
      <div class="panel">
        <div class="panel-grid">
          ${steps.map((step, index) => `<article class="panel-card">
            <h3 class="panel-card-title">${esc(step.title)}</h3>
            <p class="panel-card-text">${esc(step.description)}</p>
            <p class="panel-card-meta">${esc((step.customerReceives || [])[0] || "")}</p>
          </article>`).join("")}
        </div>
      </div>
    </div>
  </section>`;
}

function renderAudience(exp) {
  return `<section class="section" data-density="compact" id="para-quem">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">Para quem é</h2>
        <p class="section-lead">${esc(exp.positioning.subheadline)}</p>
      </div>
      <div class="audience-grid">
        ${exp.positioning.audiences.map(item => `<p class="audience">${esc(item)}</p>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderDifferentiators(exp) {
  return `<section class="section" data-density="compact" id="diferenciais">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">Diferenciais</h2>
      </div>
      <div class="panel">
        <div class="panel-grid">
          ${exp.differentiators.slice(0, 3).map((item, index) => `<article class="panel-card">
            <h3 class="panel-card-title">${esc(item.title)}</h3>
            <p class="panel-card-text">${esc(item.description)}</p>
            <p class="panel-card-meta">Diferencial ${pad(index + 1)}</p>
          </article>`).join("")}
        </div>
      </div>
    </div>
  </section>`;
}

function renderMethod(exp, copy) {
  const journey = exp.customerJourney;
  return `<section class="section" id="metodo">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">${esc(copy.method.title)}</h2>
        <p class="section-lead">${esc(copy.method.body)}</p>
      </div>
      <ol class="steps">
        ${journey.map((step, index) => `<li class="step">
          <span class="step-index">${pad(index + 1)}</span>
          <div>
            <h3 class="step-title">${esc(step.title)}</h3>
            <p class="step-text">${esc(step.description)}</p>
          </div>
          <ul class="step-receives">
            ${(step.customerReceives || []).map(item => `<li>${esc(item)}</li>`).join("")}
          </ul>
        </li>`).join("")}
      </ol>
    </div>
  </section>`;
}

function renderSolutions(exp, copy) {
  const principles = exp.solutionPrinciples;
  return `<section class="section" id="solucoes">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">${esc(copy.custom.title)}</h2>
        <p class="section-lead">${esc(copy.custom.body)}</p>
      </div>
      <div class="split">
        <div>
          <p class="split-approach">${esc(principles.approach)}</p>
          <ul class="blocks">
            ${principles.buildingBlocks.map(item => `<li>${esc(item)}</li>`).join("")}
          </ul>
        </div>
        <div>
          <h3 class="measure-title">Como escolhemos a solução</h3>
          <ol class="rules">
            ${principles.decisionRules.map(item => `<li>${esc(item)}</li>`).join("")}
          </ol>
        </div>
      </div>
    </div>
  </section>`;
}

function renderNot(exp) {
  return `<section class="section" data-density="compact" id="o-que-nao-e">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">O que a OaaS.Quest não é</h2>
      </div>
      <ul class="nots">
        ${exp.positioning.not.map(item => `<li class="not-item">${esc(item)}</li>`).join("")}
      </ul>
    </div>
  </section>`;
}

function renderCycle(exp, copy) {
  const cycle = exp["90DayMethod"];
  return `<section class="section" id="ciclo-90">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">${esc(copy.ninetyDays.title)}</h2>
        <p class="section-lead">${esc(copy.ninetyDays.body)}</p>
      </div>
      <p class="promise">${esc(cycle.promise)}</p>
      <div class="phases">
        ${cycle.phases.map(phase => `<article class="phase">
          <span class="phase-period">${esc(phase.period)}</span>
          <div>
            <h3 class="phase-name">${esc(phase.name)}</h3>
            <p class="phase-goal">${esc(phase.goal)}</p>
          </div>
          <ul class="phase-list">
            ${(phase.deliverables || []).map(item => `<li>${esc(item)}</li>`).join("")}
          </ul>
        </article>`).join("")}
      </div>
      <p class="footnote">${esc(copy.ninetyDays.disclaimer)} ${esc(cycle.qualificationNote)}</p>
    </div>
  </section>`;
}

function renderMeasurement(exp, copy) {
  const measurement = exp.measurement;
  const cadence = measurement.cadence || {};
  const cadenceLabels = { daily: "Diário", weekly: "Semanal", monthly: "Mensal", quarterly: "Trimestral" };
  return `<section class="section" id="metricas">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">${esc(copy.measurement.title)}</h2>
        <p class="section-lead">${esc(copy.measurement.body)}</p>
      </div>
      <div class="measure">
        <div class="measure-col">
          <h3 class="measure-title">Definido antes da execução</h3>
          <ul class="measure-list">
            ${measurement.requiredBeforeExecution.map(item => `<li>${esc(item)}</li>`).join("")}
          </ul>
        </div>
        <div class="measure-col">
          <h3 class="measure-title">Acompanhado na operação</h3>
          <ul class="measure-list">
            ${measurement.dashboardMetrics.map(item => `<li>${esc(item)}</li>`).join("")}
          </ul>
        </div>
      </div>
      <div class="measure-foot">
        <div>
          <h3 class="measure-title">Cadência de acompanhamento</h3>
          <div class="cadence">
            ${Object.keys(cadenceLabels).filter(key => cadence[key]).map(key => `<div class="cadence-row"><span class="cadence-key">${esc(cadenceLabels[key])}</span><span class="cadence-value">${esc(cadence[key])}</span></div>`).join("")}
          </div>
        </div>
        <p class="integrity">${esc(measurement.integrity)}</p>
      </div>
    </div>
  </section>`;
}

function renderSectors(sectors, copy) {
  return `<section class="section" id="setores">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">${esc(copy.navigation.sectors)}</h2>
      </div>
      <div class="sectors">
        ${sectors.map(sector => `<article class="sector">
          <h3 class="sector-name">${esc(sector.name)}</h3>
          <ul class="sector-outcomes">
            ${(sector.outcomes || []).slice(0, 3).map(item => `<li>${esc(item)}</li>`).join("")}
          </ul>
          <p class="sector-metrics">${esc((sector.metrics || []).slice(0, 4).join(" · "))}</p>
        </article>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderCommercial(exp) {
  const commercial = exp.commercialModel;
  return `<section class="section" id="modelo-comercial">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">${esc(commercial.headline)}</h2>
      </div>
      <div class="commercial">
        <p class="commercial-principle">${esc(commercial.principle)}</p>
        <ul class="commercial-items">
          ${commercial.components.map(item => `<li class="commercial-item"><span class="commercial-name">${esc(item.name)}</span><span class="commercial-desc">${esc(item.description)}</span></li>`).join("")}
        </ul>
      </div>
      <p class="trust">${esc(commercial.trustStatement)}</p>
    </div>
  </section>`;
}

function renderFaq(exp, copy) {
  return `<section class="section" id="duvidas">
    <div class="section-inner">
      <div class="section-head">
        <h2 class="section-title">${esc(copy.navigation.faq)}</h2>
      </div>
      <div class="faq">
        ${exp.faq.map(item => `<details class="faq-item"><summary>${esc(item.question)}${CHEVRON}</summary><div class="faq-answer">${esc(item.answer)}</div></details>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderClosing(exp, copy) {
  return `<section class="closing">
    <div class="closing-inner">
      <div>
        <h2 class="closing-title">${esc(copy.closing.title)}</h2>
        <p class="closing-body">${esc(copy.closing.body)}</p>
      </div>
      <div class="closing-actions">
        <a class="cta" href="/chat">${esc(copy.closing.cta)}${ARROW}</a>
        <a class="cta" data-variant="ghost" href="#duvidas">${esc(copy.navigation.faq)}${ARROW}</a>
      </div>
    </div>
  </section>`;
}

let sectionObserver = null;

function watchSections(links) {
  const sections = links
    .map(link => link.getAttribute("href").slice(1))
    .map(id => document.getElementById(id))
    .filter(Boolean);
  if (!sections.length || typeof IntersectionObserver !== "function") return;
  // A navegacao client-side reexecuta o runtime: o observador anterior e solto.
  if (sectionObserver) sectionObserver.disconnect();
  sectionObserver = new IntersectionObserver(
    entries => {
      entries.forEach(entry => {
        const active = entry.isIntersecting;
        links.forEach(link => {
          if (link.getAttribute("href") === "#" + entry.target.id) {
            if (active) link.setAttribute("aria-current", "true");
            else link.removeAttribute("aria-current");
          }
        });
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach(section => sectionObserver.observe(section));
}

export function mount(page) {
  const exp = page.sources.experience;
  const copy = exp.presentation.site;
  const sectors = page.sources["sector-playbooks"]?.sectors || [];

  const strip = document.getElementById("section-strip");

  if (strip) {
    strip.innerHTML = NAV.map(item => `<a class="strip-link" href="${item.href}">${esc(copy.navigation[item.key])}</a>`).join("");
  }

  const navCta = document.getElementById("nav-cta");
  if (navCta) navCta.textContent = copy.hero.primaryCta;

  const main = document.getElementById("oaas-main");
  if (main) {
    main.innerHTML = [
      renderHero(exp, copy),
      renderPanel(exp, copy),
      renderAudience(exp),
      renderDifferentiators(exp),
      renderMethod(exp, copy),
      renderSolutions(exp, copy),
      renderNot(exp),
      renderCycle(exp, copy),
      renderMeasurement(exp, copy),
      renderSectors(sectors, copy),
      renderCommercial(exp),
      renderFaq(exp, copy),
      renderClosing(exp, copy)
    ].join("");
  }


  const footerLine = document.getElementById("footer-line");
  if (footerLine) footerLine.textContent = exp.brand.tagline;

  const links = [...(strip ? strip.querySelectorAll(".strip-link") : [])];
  if (links.length) watchSections(links);

  if (window.OQ) OQ.logInteraction("site", "content-loaded", { sections: 13 });
}
