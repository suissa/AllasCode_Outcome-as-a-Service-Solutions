/**
 * Temas globais do OaaS.Quest.
 *
 * O wrapper global (<html>) carrega UMA classe de tema. Trocar de tema e
 * remover a classe atual e adicionar a nova: nenhum CSS e reescrito, porque
 * as paginas consomem apenas as variaveis --oq-*.
 */

const STORAGE_KEY = "oaas.quest.theme";
const CLASS_PREFIX = "oq-theme-";

const THEMES = [
  { id: "abyss", label: "Abismo", swatch: "linear-gradient(135deg, #0a0e1a 50%, #35dcf5 50%)" },
  { id: "carbon", label: "Carbono", swatch: "linear-gradient(135deg, #0b0b11 50%, #b79bff 50%)" },
  { id: "ember", label: "Brasa", swatch: "linear-gradient(135deg, #12100e 50%, #fbbf24 50%)" },
  { id: "paper", label: "Papel", swatch: "linear-gradient(135deg, #f4f5f9 50%, #2f49e0 50%)" }
];

const root = document.documentElement;

function activeTheme() {
  const current = Array.from(root.classList).find(name => name.startsWith(CLASS_PREFIX));
  return current ? current.slice(CLASS_PREFIX.length) : THEMES[0].id;
}

/**
 * Aplica um tema: remove a classe de tema atual do wrapper global e adiciona
 * a classe do tema escolhido.
 */
export function applyTheme(id, persist = true) {
  const theme = THEMES.find(item => item.id === id) || THEMES[0];
  Array.from(root.classList)
    .filter(name => name.startsWith(CLASS_PREFIX))
    .forEach(name => root.classList.remove(name));
  root.classList.add(CLASS_PREFIX + theme.id);

  if (persist) {
    try {
      localStorage.setItem(STORAGE_KEY, theme.id);
    } catch (error) {
      console.warn("Não foi possível salvar o tema", error);
    }
  }

  document.querySelectorAll(".theme-option").forEach(option => {
    option.setAttribute("aria-pressed", String(option.dataset.theme === theme.id));
  });
  const label = document.querySelector(".theme-current");
  if (label) label.textContent = theme.label;

  return theme;
}

/**
 * Aplica o tema salvo no wrapper global. Roda antes da primeira pintura, para
 * que a pagina ja nasca na cor escolhida.
 */
export function applyStoredTheme() {
  let stored = null;
  try {
    stored = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    stored = null;
  }
  return applyTheme(stored || activeTheme(), false);
}

/** Injeta o seletor de temas. */
export function buildThemeSwitcher() {
  if (document.querySelector(".theme-switcher")) return;

  const host = document.createElement("div");
  host.className = "theme-switcher";
  host.innerHTML =
    '<div class="theme-panel" id="theme-panel">' +
    THEMES.map(
      theme =>
        '<button class="theme-option" type="button" data-theme="' + theme.id + '" aria-pressed="false">' +
        '<span class="theme-swatch" style="background:' + theme.swatch + '"></span>' +
        '<span class="theme-name">' + theme.label + "</span>" +
        "</button>"
    ).join("") +
    "</div>" +
    '<button class="theme-toggle" type="button" id="theme-toggle" aria-expanded="false" aria-controls="theme-panel">' +
    '<span class="theme-dots" aria-hidden="true">' +
    THEMES.map(theme => '<span class="theme-dot" style="background:' + theme.swatch + '"></span>').join("") +
    "</span>" +
    '<span class="theme-current">Tema</span>' +
    "</button>";

  document.body.appendChild(host);

  const panel = host.querySelector(".theme-panel");
  const toggle = host.querySelector(".theme-toggle");

  toggle.addEventListener("click", () => {
    const open = panel.getAttribute("data-open") === "true";
    panel.setAttribute("data-open", String(!open));
    toggle.setAttribute("aria-expanded", String(!open));
  });

  panel.querySelectorAll(".theme-option").forEach(option => {
    option.addEventListener("click", () => {
      applyTheme(option.dataset.theme);
      panel.setAttribute("data-open", "false");
      toggle.setAttribute("aria-expanded", "false");
    });
  });

  applyTheme(activeTheme(), false);
}
