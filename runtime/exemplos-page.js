/**
 * OaaS.Quest — Exemplos práticos de agentes autônomos.
 *
 * Runtime da página: lê content/exemplos.pt-BR.json e renderiza herói,
 * navegação por categoria, categorias de agentes, tabela de definição de
 * resultado e arquitetura mínima.
 *
 * Uma classe semântica por tipo de elemento; as cores vêm dos tokens de
 * tema (--oq-*). O shell chama mount(page) a cada render: o runtime não
 * depende de window.OaaSPageReady e não duplica listeners.
 */

const ICONS = {
  headset: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M3 18v-6a9 9 0 0 1 18 0v6"/><path d="M21 19a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3v5z"/><path d="M3 19a2 2 0 0 0 2 2h1a2 2 0 0 0 2-2v-3a2 2 0 0 0-2-2H3v5z"/></svg>`,
  "trending-up": `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`,
  wallet: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M21 12V7H5a2 2 0 0 1 0-4h14v4"/><path d="M3 5v14a2 2 0 0 0 2 2h16v-5"/><path d="M18 12a1 1 0 1 0 0 2 1 1 0 0 0 0-2z"/></svg>`,
  boxes: `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M2.97 12.92A2 2 0 0 0 2 14.63v3.24a2 2 0 0 0 .97 1.71l3 1.8a2 2 0 0 0 2.06 0L12 19v-5.5l-5-3-4.03 2.42z"/><path d="M7 16.5l-4.74-2.85"/><path d="M7 16.5l5-3"/><path d="M7 16.5v5.17"/><path d="M12 13.5V19l3.97 2.38a2 2 0 0 0 2.06 0l3-1.8a2 2 0 0 0 .97-1.71v-3.24a2 2 0 0 0-.97-1.71L17 10.5l-5 3z"/><path d="M17 16.5l-5-3"/><path d="M17 16.5l4.74-2.85"/><path d="M17 16.5v5.17"/><path d="M7.97 4.42A2 2 0 0 0 7 6.13v4.37l5 3 5-3V6.13a2 2 0 0 0-.97-1.71l-3-1.8a2 2 0 0 0-2.06 0l-3 1.8z"/><path d="M12 8L7.26 5.15"/><path d="M12 8l4.74-2.85"/><path d="M12 13.5V8"/></svg>`,
  "shield-check": `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/></svg>`
};

/** Escapa HTML para segurança (inclusive aspas, usadas em atributos). */
function esc(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[character]));
}

function renderSources(sources) {
  if (!sources || sources.length === 0) return "";
  return `<div class="exemplos-agent-sources">${sources.map(source =>
    `<a class="exemplos-source-link" href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)}</a>`
  ).join("")}</div>`;
}

function renderAgent(agent) {
  return `<article class="exemplos-agent">
    <h3 class="exemplos-agent-name">${esc(agent.name)}</h3>
    <p class="exemplos-agent-action">${esc(agent.action)}</p>
    <p class="exemplos-agent-outcome">${esc(agent.outcome)}</p>
    ${renderSources(agent.sources)}
  </article>`;
}

function renderCategory(category) {
  const icon = ICONS[category.icon] || "";
  return `<section class="exemplos-category" id="cat-${esc(category.id)}" data-reveal="view">
    <div class="exemplos-shell">
      <div class="exemplos-category-head">
        <div class="exemplos-category-icon">${icon}</div>
        <h2 class="exemplos-section-title">${esc(category.title)}</h2>
      </div>
      <div class="exemplos-agents">
        ${category.agents.map(renderAgent).join("")}
      </div>
      ${category.insight ? `<p class="exemplos-insight">${esc(category.insight)}</p>` : ""}
    </div>
  </section>`;
}

function renderOutcomeTable(data) {
  return `<section class="exemplos-outcomes" id="cat-resultado" data-reveal="view">
    <div class="exemplos-shell">
      <h2 class="exemplos-section-title">${esc(data.title)}</h2>
      <p class="exemplos-section-lead">${esc(data.intro)}</p>
      <div class="exemplos-table-wrap">
        <table class="exemplos-outcome-table">
          <thead>
            <tr>
              <th>Objetivo do cliente</th>
              <th>Resultado mensurável</th>
              <th>Fonte de verdade</th>
            </tr>
          </thead>
          <tbody>
            ${data.rows.map(row => `<tr>
              <td>${esc(row.objective)}</td>
              <td data-label="Resultado mensurável">${esc(row.measurable)}</td>
              <td data-label="Fonte de verdade">${esc(row.source)}</td>
            </tr>`).join("")}
          </tbody>
        </table>
      </div>
    </div>
  </section>`;
}

function renderArchitecture(data) {
  return `<section class="exemplos-architecture" id="cat-arquitetura" data-reveal="view">
    <div class="exemplos-shell">
      <h2 class="exemplos-section-title">${esc(data.title)}</h2>
      <p class="exemplos-section-lead">${esc(data.intro)}</p>
      <div class="exemplos-layers">
        ${data.layers.map((layer, index) => `<div class="exemplos-layer">
          <div class="exemplos-layer-index">${index + 1}</div>
          <div class="exemplos-layer-content">
            <h3 class="exemplos-layer-title">${esc(layer.name)}</h3>
            <p class="exemplos-layer-text">${esc(layer.description)}</p>
          </div>
        </div>`).join("")}
      </div>
      <p class="exemplos-closing">${renderClosing(data.closing)}</p>
    </div>
  </section>`;
}

/** Destaca as duas frases-chave do fechamento sem interpolar HTML do conteúdo. */
function renderClosing(text) {
  return esc(text)
    .replace("provar o resultado", "<strong>provar o resultado</strong>")
    .replace(
      "&quot;cobrar por resultado&quot; vira uma promessa comercial, não um modelo operacional",
      "<strong>&quot;cobrar por resultado&quot; vira uma promessa comercial, não um modelo operacional</strong>"
    );
}

function renderHero(meta) {
  return `<section class="exemplos-hero">
    <div class="exemplos-hero-grid" aria-hidden="true"></div>
    <div class="exemplos-shell">
      <div class="exemplos-hero-content">
        <h1 class="exemplos-hero-title">Agentes autônomos com <em>resultados verificáveis</em></h1>
        <p class="exemplos-hero-intro">${esc(meta.intro)}</p>
        <div class="exemplos-hero-sources">
          ${meta.introSources.map(source =>
            `<a class="exemplos-source-link" href="${esc(source.url)}" target="_blank" rel="noopener">${esc(source.label)}</a>`
          ).join("")}
        </div>
      </div>
    </div>
  </section>`;
}

function renderSectionNav(categories) {
  const items = [
    ...categories.map(category => ({ id: category.id, label: category.title })),
    { id: "resultado", label: "Como definir o resultado" },
    { id: "arquitetura", label: "Arquitetura mínima" }
  ];
  return `<nav class="exemplos-index" aria-label="Categorias de agentes">
    <div class="exemplos-shell">
      <div class="exemplos-index-list">
        ${items.map(item =>
          `<a class="exemplos-index-link" href="#cat-${esc(item.id)}">${esc(item.label)}</a>`
        ).join("")}
      </div>
    </div>
  </nav>`;
}

/** Scroll-spy: marca o item da navegação que corresponde à seção visível. */
let scrollSpy = null;

function initScrollSpy() {
  if (scrollSpy) {
    scrollSpy.disconnect();
    scrollSpy = null;
  }

  const navItems = document.querySelectorAll(".exemplos-index-link");
  const targets = [];
  for (const item of navItems) {
    const hash = item.getAttribute("href");
    if (!hash) continue;
    const element = document.querySelector(hash);
    if (element) targets.push({ element, navItem: item });
  }
  if (targets.length === 0) return;

  scrollSpy = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const match = targets.find(target => target.element === entry.target);
      if (match) match.isVisible = entry.isIntersecting;
    }
    const visible = targets.find(target => target.isVisible);
    for (const target of targets) {
      target.navItem.setAttribute("aria-current", target === visible ? "true" : "false");
    }
  }, { rootMargin: "-20% 0px -60% 0px" });

  for (const target of targets) scrollSpy.observe(target.element);
}

/** Preenche os links de navegação do header. */
function initNavLinks(categories) {
  const nav = document.getElementById("nav-links");
  if (!nav) return;

  const links = [
    ...categories.map(category => ({ href: `#cat-${category.id}`, label: category.title })),
    { href: "#cat-resultado", label: "Resultado" },
    { href: "#cat-arquitetura", label: "Arquitetura" }
  ];

  nav.innerHTML = links.map(link =>
    `<a class="exemplos-nav-link" href="${esc(link.href)}">${esc(link.label)}</a>`
  ).join("");
}

/** Monta a página: o shell chama mount(page) a cada render. */
export async function mount(page) {
  const data = page && page.sources ? page.sources.exemplos : null;
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

  const footerLine = document.getElementById("footer-line");
  if (footerLine) {
    footerLine.textContent = `OaaS.Quest — Outcome as a Service · ${new Date().getFullYear()}`;
  }

  if (window.OQ) {
    window.OQ.logInteraction("exemplos", "content-loaded", { categories: data.categories.length });
  }
}
