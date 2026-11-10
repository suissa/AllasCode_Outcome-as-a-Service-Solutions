/**
 * Roteador client-side do OaaS.Quest.
 *
 * A navegacao entre as paginas acontece sem recarregar o documento: o runtime
 * resolve o manifesto da rota destino, troca o conteudo, troca as folhas de
 * estilo da pagina e reexecuta o runtime do layout — tudo dentro de uma
 * View Transition.
 *
 * As folhas de estilo vem do manifesto do layout (layouts/<id>.json), que e a
 * unica fonte de verdade: nada de manifesto parallelo de assets.
 */

const TRANSITION_STYLE_ID = "oq-page-transitions";

const TRANSITION_CSS = `
@media (prefers-reduced-motion: no-preference) {
  ::view-transition-old(root) {
    animation: oq-page-out 0.18s ease both;
  }
  ::view-transition-new(root) {
    animation: oq-page-in 0.32s cubic-bezier(0.16, 1, 0.3, 1) both;
  }
}
@keyframes oq-page-out { to { opacity: 0; transform: translateY(-6px); } }
@keyframes oq-page-in { from { opacity: 0; transform: translateY(10px); } }
`;

/** Normaliza a rota: "/" continua "/", o resto perde a barra final. */
const normalizeRoute = pathname => {
  if (!pathname || pathname === "/") return "/";
  return pathname.replace(/\/+$/, "") || "/";
};

/**
 * @param {object} options
 * @param {Record<string, unknown>} options.pages manifestos de pagina por id
 * @param {Record<string, unknown>} options.layouts manifestos de layout por id
 * @param {(pageId: string) => Promise<unknown>} options.renderPage monta a pagina
 */
export function createRouter({ pages, layouts, renderPage }) {
  const byId = new Map();
  Object.values(pages).forEach(page => byId.set(page.id, page));

  const routeMap = new Map();
  byId.forEach(page => {
    if (page.clientNavigation) routeMap.set(normalizeRoute(page.route), page.id);
  });

  const layoutById = new Map();
  Object.values(layouts).forEach(layout => layoutById.set(layout.id, layout));

  let currentPageId = null;
  let managedLinks = [];

  function injectTransitionStyles() {
    if (document.getElementById(TRANSITION_STYLE_ID)) return;
    const style = document.createElement("style");
    style.id = TRANSITION_STYLE_ID;
    style.textContent = TRANSITION_CSS;
    document.head.appendChild(style);
  }

  /** Folhas de estilo declaradas pelo layout da pagina. */
  function stylesFor(pageId) {
    const page = byId.get(pageId);
    if (!page) return [];
    const layout = layoutById.get(page.layout);
    if (!layout) return [];
    const declared = layout.stylesheets || (layout.stylesheet ? [layout.stylesheet] : []);
    return declared.map(path => "/" + path.replace(/^\/+/, ""));
  }

  /** Carrega as folhas da pagina destino e espera que cheguem ao navegador. */
  async function prepareStyles(pageId) {
    const links = stylesFor(pageId).map(href => {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = href;
      document.head.appendChild(link);
      return link;
    });
    await Promise.all(
      links.map(
        link =>
          new Promise(resolve => {
            link.addEventListener("load", resolve, { once: true });
            link.addEventListener("error", resolve, { once: true });
          })
      )
    );
    return links;
  }

  function applyStyles(links) {
    managedLinks.forEach(link => link.remove());
    managedLinks = links;
  }

  async function navigate(url, { replace = false } = {}) {
    const target = new URL(url, window.location.href);
    const pageId = routeMap.get(normalizeRoute(target.pathname));
    if (!pageId) {
      window.location.assign(target.href);
      return;
    }

    if (pageId === currentPageId) {
      scrollToHash(target.hash);
      return;
    }

    const links = await prepareStyles(pageId);
    const finalUrl = target.pathname + target.hash;
    if (replace) window.history.replaceState({ pageId }, "", finalUrl);
    else window.history.pushState({ pageId }, "", finalUrl);

    const update = async () => {
      applyStyles(links);
      await renderPage(pageId);
    };

    if (document.startViewTransition) {
      const transition = document.startViewTransition(update);
      await transition.finished.catch(() => {});
    } else {
      await update();
    }

    currentPageId = pageId;

    if (target.hash) scrollToHash(target.hash);
    else window.scrollTo({ top: 0 });
  }

  function scrollToHash(hash) {
    if (!hash) return;
    const anchor = document.getElementById(hash.slice(1));
    if (anchor) anchor.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function isInternalLink(anchor) {
    if (!anchor) return false;
    if (anchor.target && anchor.target !== "_self") return false;
    if (anchor.hasAttribute("download")) return false;
    if ((anchor.getAttribute("rel") || "").split(/\s+/).includes("external")) return false;
    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname && url.hash) return false;
    return routeMap.has(normalizeRoute(url.pathname));
  }

  return {
    start(initialPageId) {
      if (window.OQRouter) return window.OQRouter;
      injectTransitionStyles();
      currentPageId = initialPageId;

      managedLinks = stylesFor(initialPageId)
        .map(href => document.querySelector('link[rel="stylesheet"][href="' + href + '"]'))
        .filter(Boolean);

      document.addEventListener("click", event => {
        if (event.defaultPrevented || event.button !== 0) return;
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const anchor = event.target.closest ? event.target.closest("a") : null;
        if (!isInternalLink(anchor)) return;
        event.preventDefault();
        navigate(anchor.href);
      });

      window.addEventListener("popstate", () => {
        navigate(window.location.href, { replace: true });
      });

      window.OQRouter = { navigate };
      return window.OQRouter;
    }
  };
}
