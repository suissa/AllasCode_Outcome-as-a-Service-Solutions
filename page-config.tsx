/**
 * Shell das paginas OaaS.Quest.
 *
 * Um unico runtime monta qualquer pagina do manifesto: resolve o template,
 * publica o conteudo e executa o runtime do layout. A navegacao client-side
 * (runtime/router.tsx) reutiliza exatamente este mesmo caminho, entao a troca
 * de pagina nao recarrega o documento e nao duplica listeners.
 *
 * O Vite resolve manifestos, templates e conteudo no grafo de modulos, o que
 * habilita hot reload: qualquer mudanca em JSON, template, CSS ou runtime dispara
 * a atualizacao da pagina sem reiniciar o servidor.
 */
import { createPageLoader } from "./page-loader.tsx";
import { applyStoredTheme, buildThemeSwitcher } from "./runtime/theme.tsx";
import { createRouter } from "./runtime/router.tsx";
import { initWordReveal } from "./runtime/word-reveal.tsx";

const pages = import.meta.glob("/pages/pt-BR/*.json", { eager: true, import: "default" });
const layouts = import.meta.glob("/layouts/*.json", { eager: true, import: "default" });
const templates = import.meta.glob("/layouts/*.html", { query: "?raw", import: "default", eager: true });
const content = import.meta.glob("/content/*.json", { eager: true, import: "default" });

const scriptModules = {
  ...import.meta.glob("/runtime/*.tsx"),
  "/app.tsx": () => import("/app.tsx"),
  "/content.tsx": () => import("/content.tsx")
};

const loadPage = createPageLoader({ pages, layouts, templates, content });

const pageId = document.body.dataset.oaasPage;

// O tema entra antes da primeira pintura: a pagina nasce na cor escolhida.
applyStoredTheme();

/** Monta o template resolvido no ponto de entrada da pagina. */
function mountTemplate(resolved) {
  const rootElement = document.getElementById("oaas-page-root");
  if (!rootElement) throw new Error("PAGE_ROOT_MISSING");
  rootElement.innerHTML = resolved.template;
  document.documentElement.dataset.pageId = resolved.page.id;
  document.documentElement.dataset.layoutId = resolved.layout.id;
  document.body.dataset.oaasPage = resolved.page.id;
  document.title = resolved.page.title;
  document.body.className = resolved.layout.bodyClass || "";
  window.OaaSPage = resolved;
}

/**
 * Executa os runtimes declarados pelo layout. Cada modulo pode exportar
 * mount(page): o shell chama o mount a cada render, sem reimportar o modulo
 * e sem duplicar listeners.
 */
async function runLayoutScripts(resolved) {
  for (const path of resolved.layout.scripts || []) {
    const loader = scriptModules["/" + path];
    if (!loader) throw new Error("LAYOUT_SCRIPT_NOT_FOUND:" + path);
    const module = await loader();
    if (typeof module.mount === "function") await module.mount(resolved);
  }
}

async function renderPage(id) {
  const resolved = await loadPage(id);
  mountTemplate(resolved);
  window.OaaSPageReady = Promise.resolve(resolved);
  document.dispatchEvent(
    new CustomEvent("oaas:page-ready", { detail: { pageId: resolved.page.id, layoutId: resolved.layout.id } })
  );
  await runLayoutScripts(resolved);
  applyMotion(resolved);
  return resolved;
}

/**
 * A revelacao por mascara de palavra e a politica de movimento do site:
 * vale para todos os titulos e semi-titulos de todas as paginas do novo
 * sistema. O shell a aplica depois dos runtimes, para que o conteudo
 * renderizado tambem entre na revelacao.
 */
function applyMotion(resolved) {
  if (!resolved.page.clientNavigation) return;
  initWordReveal(document);
}

window.OaaSPageReady = (async () => {
  const resolved = await loadPage(pageId);
  mountTemplate(resolved);
  return window.OaaSPage;
})().catch(error => {
  console.error("Falha ao inicializar a configuração da página OaaS.Quest", error);
  throw error;
});

window.OaaSPageScriptsReady = window.OaaSPageReady
  .then(async resolved => {
    await runLayoutScripts(resolved);
    applyMotion(resolved);
    if (resolved.page.clientNavigation) {
      buildThemeSwitcher();
      createRouter({ pages, layouts, renderPage }).start(resolved.page.id);
    }
    return resolved;
  })
  .catch(error => {
    console.error("Falha ao carregar os runtimes do layout OaaS.Quest", error);
    throw error;
  });
