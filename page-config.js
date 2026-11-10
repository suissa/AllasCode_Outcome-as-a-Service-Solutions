import { createPageLoader } from "./page-loader.js";

/**
 * Runtime de paginas OaaS.Quest.
 *
 * O Vite resolve os manifestos, templates e conteudo no grafo de modulos, o que
 * habilita hot reload: qualquer mudanca em JSON, template, CSS ou runtime dispara
 * a atualizacao da pagina sem reiniciar o servidor.
 */
const pages = import.meta.glob("/pages/pt-BR/*.json", { eager: true, import: "default" });
const layouts = import.meta.glob("/layouts/*.json", { eager: true, import: "default" });
const templates = import.meta.glob("/layouts/*.html", { query: "?raw", import: "default", eager: true });
const content = import.meta.glob("/content/*.json", { eager: true, import: "default" });

const scriptModules = {
  ...import.meta.glob("/runtime/*.js"),
  "/app.js": () => import("/app.js"),
  "/content.js": () => import("/content.js")
};

const loadPage = createPageLoader({ pages, layouts, templates, content });

const pageId = document.body.dataset.oaasPage;

window.OaaSPageReady = (async () => {
  const resolved = await loadPage(pageId);
  const rootElement = document.getElementById("oaas-page-root");
  if (!rootElement) throw new Error("PAGE_ROOT_MISSING");
  rootElement.innerHTML = resolved.template;
  document.documentElement.dataset.pageId = resolved.page.id;
  document.documentElement.dataset.layoutId = resolved.layout.id;
  document.title = resolved.page.title;
  window.OaaSPage = resolved;
  document.dispatchEvent(new CustomEvent("oaas:page-ready", { detail: { pageId, layoutId: resolved.layout.id } }));
  return window.OaaSPage;
})().catch(error => {
  console.error("Falha ao inicializar a configuração da página OaaS.Quest", error);
  throw error;
});

window.OaaSPageScriptsReady = window.OaaSPageReady.then(async page => {
  for (const path of page.layout.scripts || []) {
    const loader = scriptModules["/" + path];
    if (!loader) throw new Error("LAYOUT_SCRIPT_NOT_FOUND:" + path);
    await loader();
  }
  return page;
}).catch(error => {
  console.error("Falha ao carregar os runtimes do layout OaaS.Quest", error);
  throw error;
});
