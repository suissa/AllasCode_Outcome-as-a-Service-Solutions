/**
 * Runtime da home (seletor de experiencia).
 *
 * A copy da home vive em content/ui-copy.pt-BR.json. O template declara os bindings
 * com data-copy (catalogo de locale) e data-page-copy (fontes do manifesto da pagina);
 * aqui eles sao resolvidos, com o texto do template servindo de fallback sem JS.
 *
 * Exporta mount(page): o shell chama a cada render, entao a navegacao client-side
 * nao duplica listeners nem precisa reimportar o modulo.
 */

import { initWordReveal } from "./word-reveal.js";

const resolve = (source, path) =>
  path.split(".").filter(Boolean).reduce((value, key) => (value == null ? undefined : value[key]), source);

function bind(root, attribute, source) {
  root.querySelectorAll("[" + attribute + "]").forEach(element => {
    const value = resolve(source, element.getAttribute(attribute));
    if (typeof value !== "string") return;
    if (attribute === "data-copy-aria-label") element.setAttribute("aria-label", value);
    else element.textContent = value;
  });
}

export function mount(page) {
  const catalog = page.sources["ui-copy"];

  if (catalog) {
    bind(document, "data-copy", catalog);
    bind(document, "data-copy-aria-label", catalog);
  }

  bind(document, "data-page-copy", page.sources);

  initWordReveal(document);

  document.querySelectorAll("[data-mode]").forEach(card =>
    card.addEventListener("click", () => {
      if (window.OQ) OQ.setMode(card.dataset.mode, "mode-selected");
    })
  );

  if (window.OQ) OQ.logInteraction("home", "content-loaded", { modes: document.querySelectorAll("[data-mode]").length });
}
