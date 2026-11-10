/**
 * Renderer da página Modo Clássico (OaaS.Quest).
 *
 * Monta a página institucional a partir do conteúdo externo em content/*.json.
 * A copy vem inteira do manifesto; o runtime só estrutura e mede.
 */

const esc = value =>
  String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

const pad = n => String(n).padStart(2, "0");

const ARROW = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const CHEVRON = '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true"><path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

const NAV = [
  { key: "method", href: "#metodo" },
  { key: "solutions", href: "#solucoes" },
  { key: "ninetyDays", href: "#ciclo-90" },
  { key: "measurement", href: "#metricas" },
  { key: "sectors", href: "#setores" },
  { key: "faq", href: "#duvidas" }
];

function renderHero(exp, copy) {
  const journey = exp.customerJourney;
  const cycle = exp["90DayMethod"];
  return `<section class="hero">
    <div class="hero__grid shell">
      <div class="hero__copy">
        <h1 class="hero__title">${esc(copy.hero.title)}<span>${esc(copy.hero.titleEmphasis)}</span></h1>
        <p class="hero__body">${esc(copy.hero.body)}</p>
        <div class="hero__actions">
          <a class="btn btn--primary" href="/guilda">${esc(copy.hero.primaryCta)}${ARROW}</a>
          <a class="btn btn--ghost" href="#metodo">${esc(copy.hero.secondaryCta)}</a>
        </div>
        <p class="hero__note">${esc(exp.brand.promise)}</p>
      </div>
      <aside class="panel">
        <div class="panel__head">
          <span class="panel__title">${esc(copy.navigation.method)}</span>
          <span class="panel__meta mono">${journey.length} etapas</span>
        </div>
        <ol class="cycle">
          ${journey.map((step, index) => `<li class="cycle__node"><span class="cycle__num mono">${pad(index + 1)}</span><span class="cycle__name">${esc(step.title)}</span></li>`).join("")}
        </ol>
        <a class="panel__foot" href="#ciclo-90">${esc(cycle.shortName)}${ARROW}</a>
      </aside>
    </div>
  </section>`;
}

function renderAudience(exp) {
  return `<section class="section section--tight" id="para-quem">
    <div class="shell">
      <div class="section__head reveal--soft">
        <h2 class="section__title">Para quem é</h2>
        <p class="section__lead">${esc(exp.positioning.subheadline)}</p>
      </div>
      <div class="diffs diffs--three">
        ${exp.positioning.audiences.map((item, index) => `<div class="diff"><span class="diff__num mono">${pad(index + 1)}</span><p class="diff__text">${esc(item)}</p></div>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderDifferentiators(exp) {
  return `<section class="section section--tight" id="diferenciais">
    <div class="shell">
      <div class="section__head reveal--soft">
        <h2 class="section__title">Diferenciais</h2>
      </div>
      <div class="diffs">
        ${exp.differentiators.map(item => `<div class="diff"><h3 class="diff__title">${esc(item.title)}</h3><p class="diff__text">${esc(item.description)}</p></div>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderMethod(exp, copy) {
  const journey = exp.customerJourney;
  return `<section class="section" id="metodo">
    <div class="shell">
      <div class="section__head reveal--soft">
        <h2 class="section__title">${esc(copy.method.title)}</h2>
        <p class="section__lead">${esc(copy.method.body)}</p>
      </div>
      <ol class="steps">
        <span class="steps__spine" aria-hidden="true"></span>
        <span class="steps__spine steps__spine--fill" aria-hidden="true"></span>
        ${journey.map((step, index) => `<li class="step">
          <span class="step__index mono">${pad(index + 1)}</span>
          <div>
            <h3 class="step__title">${esc(step.title)}</h3>
            <p class="step__text">${esc(step.description)}</p>
          </div>
          <ul class="step__receives">
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
    <div class="shell">
      <div class="section__head reveal--soft">
        <h2 class="section__title">${esc(copy.custom.title)}</h2>
        <p class="section__lead">${esc(copy.custom.body)}</p>
      </div>
      <div class="split">
        <div>
          <p class="commercial__principle">${esc(principles.approach)}</p>
          <ul class="blocks">
            ${principles.buildingBlocks.map(item => `<li>${esc(item)}</li>`).join("")}
          </ul>
        </div>
        <div>
          <h3 class="measure__title">Como escolhemos a solução</h3>
          <ol class="rules">
            ${principles.decisionRules.map(item => `<li>${esc(item)}</li>`).join("")}
          </ol>
        </div>
      </div>
    </div>
  </section>`;
}

function renderNot(exp) {
  return `<section class="section section--tight band" id="o-que-nao-e">
    <div class="shell">
      <div class="section__head reveal--soft">
        <h2 class="section__title">O que a OaaS.Quest não é</h2>
        <span class="band__rule reveal-draw" aria-hidden="true"></span>
      </div>
      <ul class="nots">
        ${exp.positioning.not.map(item => `<li>${esc(item)}</li>`).join("")}
      </ul>
    </div>
  </section>`;
}

function renderCycle(exp, copy) {
  const cycle = exp["90DayMethod"];
  return `<section class="section" id="ciclo-90">
    <div class="shell">
      <div class="section__head reveal--soft">
        <h2 class="section__title">${esc(copy.ninetyDays.title)}</h2>
        <p class="section__lead">${esc(copy.ninetyDays.body)}</p>
      </div>
      <p class="promise">${esc(cycle.promise)}</p>
      <div class="phases">
        ${cycle.phases.map(phase => `<article class="phase">
          <span class="phase__period mono">${esc(phase.period)}</span>
          <div>
            <h3 class="phase__name">${esc(phase.name)}</h3>
            <p class="phase__goal">${esc(phase.goal)}</p>
          </div>
          <ul class="phase__list">
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
    <div class="shell">
      <div class="section__head reveal--soft">
        <h2 class="section__title">${esc(copy.measurement.title)}</h2>
        <p class="section__lead">${esc(copy.measurement.body)}</p>
      </div>
      <div class="measure">
        <div class="measure__col">
          <h3 class="measure__title">Definido antes da execução</h3>
          <ul class="measure__list measure__list--grid">
            ${measurement.requiredBeforeExecution.map(item => `<li>${esc(item)}</li>`).join("")}
          </ul>
        </div>
        <div class="measure__col">
          <h3 class="measure__title">Acompanhado na operação</h3>
          <ul class="measure__list">
            ${measurement.dashboardMetrics.map(item => `<li>${esc(item)}</li>`).join("")}
          </ul>
        </div>
      </div>
      <div class="measure__foot">
        <div>
          <h3 class="measure__title">Cadência de acompanhamento</h3>
          <div class="cadence">
            ${Object.keys(cadenceLabels).filter(key => cadence[key]).map(key => `<div class="cadence__row"><span class="cadence__key">${esc(cadenceLabels[key])}</span><span class="cadence__value">${esc(cadence[key])}</span></div>`).join("")}
          </div>
        </div>
        <p class="integrity">${esc(measurement.integrity)}</p>
      </div>
    </div>
  </section>`;
}

function renderSectors(exp, sectors, copy) {
  return `<section class="section" id="setores">
    <div class="shell">
      <div class="section__head reveal--soft">
        <h2 class="section__title">${esc(copy.navigation.sectors)}</h2>
      </div>
      <div class="sectors">
        ${sectors.map(sector => `<article class="sector">
          <h3 class="sector__name">${esc(sector.name)}</h3>
          <ul class="sector__outcomes">
            ${(sector.outcomes || []).slice(0, 3).map(item => `<li>${esc(item)}</li>`).join("")}
          </ul>
          <p class="sector__metrics mono">${esc((sector.metrics || []).slice(0, 4).join(" · "))}</p>
        </article>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderCommercial(exp) {
  const commercial = exp.commercialModel;
  return `<section class="section" id="modelo-comercial">
    <div class="shell">
      <div class="section__head reveal--soft">
        <h2 class="section__title">${esc(commercial.headline)}</h2>
      </div>
      <div class="commercial">
        <p class="commercial__principle">${esc(commercial.principle)}</p>
        <ul class="commercial__items">
          ${commercial.components.map(item => `<li class="commercial__item"><span class="commercial__name">${esc(item.name)}</span><span class="commercial__desc">${esc(item.description)}</span></li>`).join("")}
        </ul>
      </div>
      <p class="trust">${esc(commercial.trustStatement)}</p>
    </div>
  </section>`;
}

function renderFaq(exp, copy) {
  return `<section class="section" id="duvidas">
    <div class="shell">
      <div class="section__head reveal--soft">
        <h2 class="section__title">${esc(copy.navigation.faq)}</h2>
      </div>
      <div class="faq">
        ${exp.faq.map(item => `<details class="faq__item"><summary>${esc(item.question)}${CHEVRON}</summary><div class="faq__answer">${esc(item.answer)}</div></details>`).join("")}
      </div>
    </div>
  </section>`;
}

function renderClosing(exp, copy) {
  return `<section class="section closing band">
    <div class="shell closing__inner">
      <div>
        <h2 class="closing__title">${esc(copy.closing.title)}</h2>
        <p class="closing__body">${esc(copy.closing.body)}</p>
      </div>
      <div class="closing__actions">
        <a class="btn btn--light" href="/guilda">${esc(copy.closing.cta)}${ARROW}</a>
        <a class="closing__ghost" href="#duvidas">${esc(copy.navigation.faq)}${ARROW}</a>
      </div>
    </div>
  </section>`;
}

function watchSections(nav) {
  const links = new Map(nav.map(link => [link.getAttribute("href").slice(1), link]));
  const sections = [...links.keys()].map(id => document.getElementById(id)).filter(Boolean);
  if (!sections.length || typeof IntersectionObserver !== "function") return;
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const link = links.get(entry.target.id);
      if (!link) return;
      if (entry.isIntersecting) link.setAttribute("aria-current", "true");
      else link.removeAttribute("aria-current");
    });
  }, { rootMargin: "-45% 0px -50% 0px", threshold: 0 });
  sections.forEach(section => observer.observe(section));
}

Promise.all([window.OQReady, window.OaaSPageReady]).then(() => {
  const runtime = window.OaaSPage;
  const exp = runtime.sources.experience;
  const copy = exp.presentation.classic;
  const sectors = runtime.sources["sector-playbooks"]?.sectors || [];

  const nav = document.getElementById("nav-links");
  if (nav) {
    nav.innerHTML = NAV.map(item => `<a class="nav__link" href="${item.href}">${esc(copy.navigation[item.key])}</a>`).join("");
  }

  const navCta = document.getElementById("nav-cta");
  if (navCta) navCta.textContent = copy.hero.primaryCta;

  const main = document.getElementById("oaas-main");
  if (main) {
    main.innerHTML = [
      renderHero(exp, copy),
      renderAudience(exp),
      renderDifferentiators(exp),
      renderMethod(exp, copy),
      renderSolutions(exp, copy),
      renderNot(exp),
      renderCycle(exp, copy),
      renderMeasurement(exp, copy),
      renderSectors(exp, sectors, copy),
      renderCommercial(exp),
      renderFaq(exp, copy),
      renderClosing(exp, copy)
    ].join("");
  }

  const footerLine = document.getElementById("footer-line");
  if (footerLine) footerLine.textContent = exp.brand.tagline;

  if (nav) watchSections([...nav.querySelectorAll(".nav__link")]);

  if (window.OQ) OQ.logInteraction("classico", "content-loaded", { sections: 12 });
});
