/**
 * Comportamento transversal da pagina Site.
 *
 * Registra a abertura do modo e a navegacao (secoes e outras paginas).
 * Exporta mount(page) para que a navegacao client-side o reexecute.
 */

export function mount() {
  const OQ = window.OQ;
  if (!OQ) return;

  OQ.setMode("site", "mode-opened");

  document.querySelectorAll('a[href^="#"]').forEach(link =>
    link.addEventListener("click", () =>
      OQ.logInteraction("site", "section-navigation", { target: link.getAttribute("href") })
    )
  );

  document.querySelectorAll('a[href^="/"]').forEach(link =>
    link.addEventListener("click", () =>
      OQ.logInteraction("site", "mode-navigation", { target: link.getAttribute("href") })
    )
  );
}
