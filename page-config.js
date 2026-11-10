(function () {
  const body = document.body;
  const pageId = body.dataset.oaasPage;
  const root = body.dataset.configRoot || "./";
  const sourceFiles = {
    experience: "experience.pt-BR.json",
    "sector-playbooks": "sector-playbooks.pt-BR.json",
    "agent-team": "agent-team.pt-BR.json",
    "mission-steps": "mission-steps.pt-BR.json",
    discovery: "discovery.pt-BR.json"
  };
  const readJson = async path => {
    const response = await fetch(new URL(root + path, document.baseURI));
    if (!response.ok) throw new Error("PAGE_CONFIG_FETCH_FAILED:" + path);
    return response.json();
  };
  const getPath = (value, path) => path.split(".").filter(Boolean).reduce((current, key) => current == null ? undefined : current[key], value);
  window.OaaSPageReady = (async () => {
    if (!pageId) throw new Error("PAGE_ID_MISSING");
    const page = await readJson("pages/pt-BR/" + pageId + ".json");
    const layout = await readJson("layouts/" + page.layout + ".json");
    if (page.id !== pageId || layout.id !== page.layout) throw new Error("PAGE_LAYOUT_ID_MISMATCH");
    const stylesheet = document.createElement("link");
    stylesheet.rel = "stylesheet";
    stylesheet.href = new URL(root + layout.stylesheet, document.baseURI).href;
    stylesheet.dataset.oaasLayoutStylesheet = layout.id;
    await new Promise((resolve, reject) => {
      stylesheet.onload = resolve;
      stylesheet.onerror = () => reject(new Error("LAYOUT_STYLESHEET_FETCH_FAILED:" + layout.stylesheet));
      document.head.append(stylesheet);
    });
    const templateResponse = await fetch(new URL(root + layout.template, document.baseURI));
    if (!templateResponse.ok) throw new Error("LAYOUT_TEMPLATE_FETCH_FAILED:" + layout.template);
    const rootElement = document.getElementById("oaas-page-root");
    if (!rootElement) throw new Error("PAGE_ROOT_MISSING");
    rootElement.innerHTML = await templateResponse.text();
    const refs = [...new Set([...(page.contentRefs || []), ...(page.sections || []).map(section => section.contentRef)])];
    const sourceNames = [...new Set(refs.map(ref => ref.split(".")[0]))];
    const sources = {};
    await Promise.all(sourceNames.map(async name => {
      const file = sourceFiles[name];
      if (!file) throw new Error("UNKNOWN_CONTENT_SOURCE:" + name);
      sources[name] = await readJson("content/" + file);
    }));
    const content = {};
    for (const ref of refs) {
      const [source, ...path] = ref.split(".");
      const value = path.length ? getPath(sources[source], path.join(".")) : sources[source];
      if (value === undefined) throw new Error("CONTENT_REFERENCE_NOT_FOUND:" + ref);
      content[ref] = value;
    }
    document.documentElement.dataset.pageId = page.id;
    document.documentElement.dataset.layoutId = layout.id;
    document.title = page.title;
    window.OaaSPage = { page, layout, sources, content };
    document.dispatchEvent(new CustomEvent("oaas:page-ready", { detail: { pageId, layoutId: layout.id } }));
    return window.OaaSPage;
  })().catch(error => {
    console.error("Falha ao inicializar a configuração da página OaaS.Quest", error);
    throw error;
  });
})();
