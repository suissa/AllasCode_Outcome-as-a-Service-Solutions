/**
 * Conteudo editorial do Chat de missao (OaaS.Quest).
 *
 * Exporta mount(page): o shell chama a cada render, entao a navegacao
 * client-side reexecuta o runtime sem reimportar o modulo e sem duplicar
 * listeners.
 *
 * Nenhum texto de produto e escrito aqui: os titulos vem de
 * content/experience.pt-BR.json. As classes seguem o namespace chat-*,
 * uma classe semantica por elemento.
 */

const ORB_ICON =
  '<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="7"></circle><circle cx="12" cy="12" r="2.4"></circle></svg>';

const esc = value =>
  String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

const list = items => (items || []).map(item => "<li>" + esc(item) + "</li>").join("");

const section = (id, title, lead, body) =>
  '<section class="chat-section" id="' + id + '">' +
  '<div class="chat-section-heading"><h2 class="chat-section-title">' + esc(title) + "</h2>" +
  (lead ? "<p>" + esc(lead) + "</p>" : "") +
  "</div>" + body + "</section>";

export function mount(page) {
  const experience = page.sources.experience;
  const sectors = page.sources["sector-playbooks"]?.sectors || [];
  const team = page.sources["agent-team"] || { roles: [] };
  const copy = experience.presentation.chat;
  const journey = experience.customerJourney || [];
  const phases = experience["90DayMethod"].phases || [];
  const metrics = experience.measurement;
  const commercial = experience.commercialModel;
  const faq = experience.faq || [];

  const nav = document.querySelector(".chat-nav-sections");
  const ids = {
    method: "metodo",
    solutions: "especialidades",
    ninetyDays: "jornada-90",
    measurement: "orbe",
    sectors: "reinos",
    faq: "perguntas"
  };
  if (nav) {
    nav.innerHTML = Object.keys(copy.navigation)
      .map(key => '<a class="chat-link" href="#' + ids[key] + '">' + esc(copy.navigation[key]) + "</a>")
      .join("");
  }

  const welcome = document.querySelector(".chat-welcome");
  if (welcome) {
    welcome.innerHTML =
      '<div class="chat-emblem"><svg viewBox="0 0 32 32" width="30" height="30" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="16" cy="16" r="11"></circle><path d="M11 18.5 16 11l5 7.5"></path><path d="M12.5 21.5h7"></path></svg></div>' +
      "<h1>" + esc(copy.hero.title) + "</h1>" +
      "<p>" + esc(copy.hero.body) + "</p>" +
      '<div class="chat-hero-actions">' +
      '<a href="#composer">' + esc(copy.hero.primaryCta) + "</a>" +
      '<a href="#jornada-90">' + esc(copy.hero.secondaryCta) + "</a>" +
      "</div>";
  }

  const journalTitle = document.querySelector(".chat-journal-title");
  if (journalTitle) journalTitle.textContent = "Diário da Jornada";

  const host = document.getElementById("chat-content");
  if (host) {
    const questNames = [
      "Chamado da Missão",
      "Reconhecimento do Território",
      "Busca por Oportunidades",
      "Mapa da Jornada",
      "Forjaria da Solução",
      "Vigília da Expedição",
      "Provas da Conquista"
    ];
    const chapterNames = [
      "Capítulo I · Reconhecimento",
      "Capítulo II · Estratégia",
      "Capítulo III · Forjaria",
      "Capítulo IV · Expedição e Provas",
      "Capítulo V · Conquista e Evolução"
    ];

    host.innerHTML = [
      section(
        "metodo",
        copy.method.title,
        copy.method.body,
        '<div class="chat-journey-list">' +
          journey
            .map(
              (step, index) =>
                '<article class="chat-journey-card">' +
                '<span class="chat-journey-index">' + String(index + 1).padStart(2, "0") + "</span>" +
                "<div>" +
                "<h3>" + esc(questNames[index] || step.title) + "</h3>" +
                "<p>" + esc(step.description) + "</p>" +
                "<small>REGISTROS: " + esc((step.customerReceives || []).join(" · ")) + "</small>" +
                "</div></article>"
            )
            .join("") +
          "</div>"
      ),
      section(
        "jornada-90",
        copy.ninetyDays.title,
        copy.ninetyDays.body,
        '<div class="chat-timeline">' +
          phases
            .map(
              (phase, index) =>
                '<article class="chat-phase">' +
                "<small>" + esc(phase.period) + "</small>" +
                "<h3>" + esc(chapterNames[index] || phase.name) + "</h3>" +
                "<p>" + esc(phase.goal) + "</p>" +
                "<strong>Artefatos da etapa</strong><ul>" + list(phase.deliverables) + "</ul>" +
                "</article>"
            )
            .join("") +
          "</div>" +
          '<p class="chat-disclaimer">' + esc(copy.ninetyDays.disclaimer) + "</p>"
      ),
      section(
        "especialidades",
        "As especialidades do Chat",
        "Cada desafio convoca uma combinação diferente de conhecimentos e ferramentas.",
        '<div class="chat-role-grid">' +
          team.roles
            .map(
              role =>
                '<article class="chat-role-card">' +
                "<small>" + esc(role.id.replace(/-/g, " ").toUpperCase()) + "</small>" +
                "<h3>" + esc(role.guildaName || role.name) + "</h3>" +
                "<p>" + esc(role.purpose) + "</p>" +
                "<strong>Artefatos entregues</strong><ul>" + list(role.outputs.slice(0, 3)) + "</ul>" +
                "</article>"
            )
            .join("") +
          "</div>"
      ),
      section(
        "reinos",
        "Reinos e ofícios atendidos",
        "O Chat adapta sua estratégia às características de cada setor.",
        '<div class="chat-sector-grid">' +
          sectors
            .map(
              sector =>
                '<article class="chat-sector-card">' +
                "<h3>" + esc(sector.guildaName || sector.name) + "</h3>" +
                '<p class="chat-sector-real">' + esc(sector.name) + "</p>" +
                "<strong>Conquistas possíveis</strong><ul>" + list(sector.outcomes.slice(0, 3)) + "</ul>" +
                "<strong>Orbe de métricas</strong><p>" + esc(sector.metrics.slice(0, 5).join(" · ")) + "</p>" +
                "</article>"
            )
            .join("") +
          "</div>"
      ),
      section(
        "orbe",
        copy.measurement.title,
        copy.measurement.body,
        '<div class="chat-orb-grid">' +
          metrics.dashboardMetrics.map(metric => '<div class="chat-orb-item">' + ORB_ICON + esc(metric) + "</div>").join("") +
          "</div>" +
          '<p class="chat-disclaimer">' + esc(metrics.integrity) + "</p>"
      ),
      section(
        "tesouro",
        "Acordos e recompensas",
        commercial.principle,
        '<div class="chat-role-grid">' +
          commercial.components
            .map(
              component =>
                '<article class="chat-role-card">' +
                "<h3>" + esc(component.name) + "</h3>" +
                "<p>" + esc(component.description) + "</p>" +
                "</article>"
            )
            .join("") +
          "</div>" +
          '<p class="chat-disclaimer">' + esc(commercial.trustStatement) + "</p>"
      ),
      section(
        "perguntas",
        "Perguntas ao Mestre",
        "Informações importantes antes de aceitar uma missão.",
        '<div class="chat-faq">' +
          faq
            .map(
              item =>
                '<details class="chat-faq-item"><summary>' + esc(item.question) + "</summary>" +
                '<div class="chat-faq-answer">' + esc(item.answer) + "</div></details>"
            )
            .join("") +
          "</div>"
      ),
      '<section class="chat-closing"><h2>' + esc(copy.closing.title) + "</h2><p>" + esc(copy.closing.body) + "</p>" +
        '<a href="#composer">' + esc(copy.closing.cta) + "</a></section>"
    ].join("");
  }

  document.querySelectorAll('a[href^="#"]').forEach(link =>
    link.addEventListener("click", () => {
      if (window.OQ) window.OQ.logInteraction("chat", "content-navigation", { target: link.getAttribute("href") });
    })
  );

  if (window.OQ) {
    window.OQ.logInteraction("chat", "content-loaded", {
      schemaVersion: experience.schemaVersion,
      sectorCount: sectors.length,
      roleCount: team.roles.length
    });
  }
}
