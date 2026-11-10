/**
 * Runtime puro das paginas OaaS.Quest.
 *
 * Recebe o registro de manifestos (paginas, layouts, templates e conteudo) e resolve
 * uma pagina completa: manifesto, layout, template e referencias de conteudo.
 * Fica livre de Vite de proposito, para ser testado de forma isolada.
 */

/** Fontes de conteudo indexadas pelo nome usado nas referencias. */
export const SOURCE_FILES = {
  experience: "experience.pt-BR.json",
  "sector-playbooks": "sector-playbooks.pt-BR.json",
  "agent-team": "agent-team.pt-BR.json",
  "mission-steps": "mission-steps.pt-BR.json",
  discovery: "discovery.pt-BR.json"
};

/**
 * Fontes carregadas por todas as paginas porque pertencem ao runtime da aplicacao
 * (app.js consome os passos da missao em qualquer experiencia).
 */
export const BASE_SOURCES = ["mission-steps"];

const getPath = (value, path) =>
  path.split(".").filter(Boolean).reduce((current, key) => (current == null ? undefined : current[key]), value);

export function createPageLoader(registry) {
  const { pages = {}, layouts = {}, templates = {}, content = {} } = registry;
  return async function loadPage(pageId) {
    if (!pageId) throw new Error("PAGE_ID_MISSING");
    const page = pages["/pages/pt-BR/" + pageId + ".json"];
    if (!page) throw new Error("PAGE_MANIFEST_NOT_FOUND:" + pageId);
    const layout = layouts["/layouts/" + page.layout + ".json"];
    if (!layout) throw new Error("LAYOUT_MANIFEST_NOT_FOUND:" + page.layout);
    if (page.id !== pageId || layout.id !== page.layout) throw new Error("PAGE_LAYOUT_ID_MISMATCH");
    const template = templates["/" + layout.template];
    if (typeof template !== "string") throw new Error("LAYOUT_TEMPLATE_NOT_FOUND:" + layout.template);

    const refs = [...new Set([...(page.contentRefs || []), ...(page.sections || []).map(section => section.contentRef)])];
    const sourceNames = [...new Set([...BASE_SOURCES, ...refs.map(ref => ref.split(".")[0])])];
    const sources = {};
    for (const name of sourceNames) {
      const file = SOURCE_FILES[name];
      if (!file) throw new Error("UNKNOWN_CONTENT_SOURCE:" + name);
      const value = content["/content/" + file];
      if (value === undefined) throw new Error("CONTENT_SOURCE_NOT_FOUND:" + file);
      sources[name] = value;
    }

    const resolved = {};
    for (const ref of refs) {
      const [source, ...path] = ref.split(".");
      const value = path.length ? getPath(sources[source], path.join(".")) : sources[source];
      if (value === undefined) throw new Error("CONTENT_REFERENCE_NOT_FOUND:" + ref);
      resolved[ref] = value;
    }

    return { page, layout, template, sources, content: resolved };
  };
}
