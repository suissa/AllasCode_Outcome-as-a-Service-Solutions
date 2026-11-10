/**
 * OaaS.Quest — Exemplos práticos de agentes autônomos.
 *
 * Runtime que lê content/exemplos.pt-BR.json e renderiza a página completa:
 * herói, navegação por categoria, grades de agentes, tabela de definição de
 * resultado e arquitetura mínima.
 */

const ICONS = {
  headset: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z"/></svg>`,
  "trending-up": `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>`,
  boxes: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42z"/><path d="M7 16.5l-4.74-2.85"/><path d="M7 16.5l5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3z"/><path d="M17 16.5l-5-3"/><path d="M17 16.5l4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8z"/><path d="M12 8L7.26 5.15"/><path d="M12 8l4.74-2.85"/><path d="M12 13.5V8"/></svg>`,
  "shield-check": `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`
};

/** Escapa HTML para segurança. */
function esc(str) {
  const d = document.createElement("div");
  d.textContent = str;
  return d.innerHTML;
}

function renderSources(sources) {
  if (!sources || sources.length === 0) return "";
  return `<div class="exemplos-agent__sources">${sources.map(s =>
    `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`
  ).join("")}</div>`;
}

function renderAgent(agent) {
  return `<article class="exemplos-agent">
    <h3 class="exemplos-agent__name">${esc(agent.name)}</h3>
    <p class="exemplos-agent__action">${esc(agent.action)}</p>
    <div class="exemplos-agent__outcome">${esc(agent.outcome)}</div>
    ${renderSources(agent.sources)}
  </article>`;
}

function renderCategory(cat) {
  const icon = ICONS[cat.icon] || "";
  return `<section class="exemplos-category ex-reveal" id="cat-${esc(cat.id)}">
    <div class="shell">
      <div class="exemplos-category__header">
        <div class="exemplos-category__icon">${icon}</div>
        <h2>${esc(cat.title)}</h2>
      </div>
      <div class="exemplos-agents">
        ${cat.agents.map(renderAgent).join("")}
      </div>
      ${cat.insight ? `<div class="exemplos-insight">${esc(cat.insight)}</div>` : ""}
    </div>
  </section>`;
}

function renderOutcomeTable(data) {
  return `<section class="exemplos-outcomes ex-reveal" id="cat-resultado">
    <div class="shell">
      <h2>${esc(data.title)}</h2>
      <p class="exemplos-outcomes__intro">${esc(data.intro)}</p>
      <table class="exemplos-outcomes__table">
        <thead>
          <tr>
            <th>Objetivo do cliente</th>
            <th>Resultado mensurável</th>
            <th>Fonte de verdade</th>
          </tr>
        </thead>
        <tbody>
          ${data.rows.map(r => `<tr>
            <td>${esc(r.objective)}</td>
            <td data-label="Resultado mensurável">${esc(r.measurable)}</td>
            <td data-label="Fonte de verdade">${esc(r.source)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </section>`;
}

function renderArchitecture(data) {
  return `<section class="exemplos-arch ex-reveal" id="cat-arquitetura">
    <div class="shell">
      <h2>${esc(data.title)}</h2>
      <p class="exemplos-arch__intro">${esc(data.intro)}</p>
      <div class="exemplos-arch__layers">
        ${data.layers.map((layer, i) => `<div class="exemplos-arch__layer">
          <div class="exemplos-arch__layer-index">
            <div class="exemplos-arch__layer-dot">${i + 1}</div>
            <div class="exemplos-arch__layer-connector"></div>
          </div>
          <div class="exemplos-arch__layer-content">
            <h3>${esc(layer.name)}</h3>
            <p>${esc(layer.description)}</p>
          </div>
        </div>`).join("")}
      </div>
      <div class="exemplos-arch__closing">
        ${data.closing.replace(
          /provar o resultado/,
          "<strong>provar o resultado</strong>"
        ).replace(
          /\"cobrar por resultado\" vira uma promessa comercial, não um modelo operacional/,
          "<strong>\"cobrar por resultado\" vira uma promessa comercial, não um modelo operacional</strong>"
        )}
      </div>
    </div>
  </section>`;
}

function renderHero(meta) {
  return `<section class="exemplos-hero">
    <div class="exemplos-hero__grid" aria-hidden="true"></div>
    <div class="shell">
      <div class="exemplos-hero__content">
        <div class="exemplos-hero__tag">Exemplos práticos</div>
        <h1>Agentes autônomos com <em>resultados verificáveis</em></h1>
        <p class="exemplos-hero__intro">${esc(meta.intro)}</p>
        <div class="exemplos-hero__sources">
          ${meta.introSources.map(s =>
            `<a href="${esc(s.url)}" target="_blank" rel="noopener">${esc(s.label)}</a>`
          ).join("")}
        </div>
      </div>
    </div>
  </section>`;
}

function renderSectionNav(categories) {
  const items = [
    ...categories.map(c => ({ id: c.id, label: c.title })),
    { id: "resultado", label: "Como definir o resultado" },
    { id: "arquitetura", label: "Arquitetura mínima" }
  ];
  return `<nav class="exemplos-section-nav" aria-label="Categorias de agentes">
    <div class="shell">
      <div class="exemplos-section-nav__list">
        ${items.map(item =>
          `<a class="exemplos-section-nav__item" href="#cat-${esc(item.id)}">${esc(item.label)}</a>`
        ).join("")}
      </div>
    </div>
  </nav>`;
}

/** Scroll-spy: marca o item da navegação que corresponde à seção visível. */
function initScrollSpy() {
  const navItems = document.querySelectorAll(".exemplos-section-nav__item");
  const targets = [];
  for (const item of navItems) {
    const hash = item.getAttribute("href");
    if (!hash) continue;
    const el = document.querySelector(hash);
    if (el) targets.push({ el, navItem: item });
  }
  if (targets.length === 0) return;

  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const match = targets.find(t => t.el === entry.target);
      if (match) match.isVisible = entry.isIntersecting;
    }
    const visible = targets.find(t => t.isVisible);
    for (const t of targets) {
      t.navItem.setAttribute("aria-current", t === visible ? "true" : "false");
    }
  }, { rootMargin: "-20% 0px -60% 0px" });

  for (const t of targets) observer.observe(t.el);
}

/** Preenche links de navegação no header. */
function initNavLinks(categories) {
  const nav = document.getElementById("nav-links");
  if (!nav) return;

  const links = [
    ...categories.map(c => ({ href: `#cat-${c.id}`, label: c.title })),
    { href: "#cat-resultado", label: "Resultado" },
    { href: "#cat-arquitetura", label: "Arquitetura" }
  ];

  nav.innerHTML = links.map(l =>
    `<a class="nav__link" href="${esc(l.href)}">${esc(l.label)}</a>`
  ).join("");
}

/** Ponto de entrada: espera OaaSPageReady e renderiza tudo. */
async function init() {
  const page = await window.OaaSPageReady;
  const data = page.sources.exemplos;
  if (!data) {
    console.error("Conteúdo de exemplos não encontrado.");
    return;
  }

  const main = document.getElementById("oaas-main");
  if (!main) return;

  main.innerHTML = [
    renderHero(data.meta),
    renderSectionNav(data.categories),
    ...data.categories.map(renderCategory),
    renderOutcomeTable(data.outcomeDefinition),
    renderArchitecture(data.architecture)
  ].join("");

  initNavLinks(data.categories);
  initScrollSpy();

  // Rodapé
  const footerLine = document.getElementById("footer-line");
  if (footerLine) {
    footerLine.textContent = `OaaS.Quest — Outcome as a Service · ${new Date().getFullYear()}`;
  }
}

init();
