import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { test } from "node:test";
import assert from "node:assert/strict";
import { BASE_SOURCES, SOURCE_FILES, createPageLoader } from "../page-loader.js";

const root = process.cwd();
async function load<T>(path: string): Promise<T> {
  return JSON.parse(await readFile(join(root, path), "utf8")) as T;
}

const ENTRIES = [
  ["index.html", "home", "/"],
  ["site.html", "site", "/site"],
  ["chat.html", "chat", "/chat"],
  ["exemplos.html", "exemplos", "/exemplos"],
  ["descoberta/index.html", "discovery", "/descoberta"]
] as const;

const PAGE_IDS = ["home", "site", "chat", "exemplos", "discovery"] as const;
const LAYOUT_IDS = ["chooser", "site", "chat", "exemplos", "discovery", "proposal"] as const;

test("pages reference existing layouts, templates and resolvable JSON content", async () => {
  for (const id of PAGE_IDS) {
    const page = await load<{ id: string; entry: string; layout: string; contentRefs: string[]; sections: { id: string; contentRef: string }[] }>(`pages/pt-BR/${id}.json`);
    assert.equal(page.id, id);
    await readFile(join(root, page.entry), "utf8");
    const layout = await load<{ id: string; template: string; stylesheet: string; scripts?: string[] }>(`layouts/${page.layout}.json`);
    assert.equal(layout.id, page.layout);
    await readFile(join(root, layout.template), "utf8");
    if (layout.stylesheet !== "inline") await readFile(join(root, layout.stylesheet), "utf8");
    for (const script of layout.scripts || []) await readFile(join(root, script), "utf8");
    assert.ok(page.sections.length > 0);
    assert.ok(page.sections.every(section => section.id && section.contentRef));
    for (const ref of new Set([...page.contentRefs, ...page.sections.map(section => section.contentRef)])) {
      const parts = ref.split(".");
      const source = parts.shift() ?? "";
      const path = parts;
      assert.ok(SOURCE_FILES[source as keyof typeof SOURCE_FILES], `Unknown content source: ${ref}`);
      let value = await load<unknown>(`content/${SOURCE_FILES[source as keyof typeof SOURCE_FILES]}`);
      for (const key of path) value = (value as Record<string, unknown>)?.[key];
      assert.notEqual(value, undefined, `Unresolved content reference: ${ref}`);
    }
  }
});

test("mission and discovery content are externalized and complete", async () => {
  const steps = await load<{ id: string; prompt: string }[]>("content/mission-steps.pt-BR.json");
  const discovery = await load<{ stages: { id: string; questions: { id: string }[] }[]; solutions: { id: string }[] }>("content/discovery.pt-BR.json");
  assert.equal(steps.length, 7);
  assert.equal(new Set(steps.map(s => s.id)).size, steps.length);
  assert.ok(steps.every(s => s.prompt.trim().length > 0));
  assert.equal(discovery.stages.length, 19);
  assert.equal(discovery.solutions.length, 12);
  assert.ok(discovery.stages.every(s => s.id && s.questions.length > 0));
});

test("layout descriptors define template, stylesheet and renderer", async () => {
  for (const id of LAYOUT_IDS) {
    const layout = await load<{ id: string; template: string; stylesheet: string; renderer: string; slots: string[] }>(`layouts/${id}.json`);
    assert.equal(layout.id, id);
    assert.ok(layout.template && layout.stylesheet && layout.renderer && layout.slots.length > 0);
  }
});

test("layouts declare the body class and the stylesheets the router swaps", async () => {
  for (const id of LAYOUT_IDS) {
    const layout = await load<{ bodyClass?: string; stylesheets?: string[]; stylesheet: string }>(`layouts/${id}.json`);
    assert.ok(layout.bodyClass, `${id} must declare a bodyClass for the global wrapper`);
    assert.ok(Array.isArray(layout.stylesheets) && layout.stylesheets.length > 0, `${id} must declare stylesheets`);
    assert.ok(layout.stylesheets.includes(layout.stylesheet), `${id} stylesheets must include the primary stylesheet`);
    for (const stylesheet of layout.stylesheets) await readFile(join(root, stylesheet), "utf8");
  }
});

test("HTML entry points boot through the manifest-driven page runtime", async () => {
  const loader = await readFile(join(root, "page-config.js"), "utf8");
  const resolver = await readFile(join(root, "page-loader.js"), "utf8");
  assert.ok(loader.includes("window.OaaSPageReady"));
  assert.ok(loader.includes("rootElement.innerHTML"));
  assert.ok(loader.includes("window.OaaSPageScriptsReady"));
  assert.ok(loader.includes("LAYOUT_SCRIPT_NOT_FOUND"));
  assert.ok(loader.includes("import.meta.glob"));
  assert.ok(resolver.includes("CONTENT_REFERENCE_NOT_FOUND"));
  assert.ok(resolver.includes("PAGE_LAYOUT_ID_MISMATCH"));
  for (const [path, id] of ENTRIES) {
    const html = await readFile(join(root, path), "utf8");
    assert.ok(html.includes('data-oaas-page="' + id + '"'), path + " must declare its page id");
    assert.ok(html.includes('type="module"'), path + " must load the page runtime as a module");
    assert.ok(html.includes('src="/page-config.js"') || html.includes('src="../page-config.js"'), path + " must load the page runtime");
    assert.ok(html.includes("oaas-page-root"), path + " must expose the template mount point");
    assert.ok(!html.includes("<script>"), path + " must not embed inline runtime scripts");
  }
});

test("layout stylesheets are external assets, not embedded in the discovery entry", async () => {
  const discovery = await readFile(join(root, "descoberta/index.html"), "utf8");
  const stylesheet = await readFile(join(root, "layouts/discovery.css"), "utf8");
  assert.ok(stylesheet.includes(":root"));
  assert.ok(discovery.includes('href="/layouts/discovery.css"'));
  assert.ok(!discovery.includes("<style>"));
});

test("entry HTML delegates behavior to scripts declared by the layout", async () => {
  for (const id of LAYOUT_IDS) {
    const layout = await load<{ scripts?: string[] }>(`layouts/${id}.json`);
    assert.ok(layout.scripts && layout.scripts.length > 0, `${id} must declare runtime scripts`);
    for (const script of layout.scripts || []) await readFile(join(root, script), "utf8");
  }
});

test("page loader mounts templates and resolves content references", async () => {
  const content: Record<string, unknown> = {};
  for (const file of Object.values(SOURCE_FILES)) content["/content/" + file] = await load("content/" + file);
  const loader = createPageLoader({
    pages: { "/pages/pt-BR/discovery.json": await load("pages/pt-BR/discovery.json") },
    layouts: { "/layouts/discovery.json": await load("layouts/discovery.json") },
    templates: { "/layouts/discovery.html": await readFile(join(root, "layouts/discovery.html"), "utf8") },
    content
  });
  const resolved = await loader("discovery");
  assert.equal(resolved.page.id, "discovery");
  assert.equal(resolved.layout.id, "discovery");
  assert.equal(resolved.template, await readFile(join(root, "layouts/discovery.html"), "utf8"));
  assert.ok(Array.isArray((resolved.content as Record<string, unknown>)["discovery.stages"]));
  for (const base of BASE_SOURCES) assert.ok((resolved.sources as Record<string, unknown>)[base], `base source ${base} must be loaded`);
});

test("page loader reports missing manifests and unresolved references", async () => {
  const loader = createPageLoader({});
  await assert.rejects(() => loader(""), /PAGE_ID_MISSING/);
  await assert.rejects(() => loader("inexistente"), /PAGE_MANIFEST_NOT_FOUND/);
});

test("every HTML entry is published under the route named after the file", async () => {
  const config = await readFile(join(root, "vite.config.ts"), "utf8");
  for (const [entry, id, route] of ENTRIES) {
    const page = await load<{ entry: string; route: string }>(`pages/pt-BR/${id}.json`);
    assert.equal(page.entry, entry);
    assert.equal(page.route, route);
    assert.ok(config.includes(`route: "${route}"`), "vite config must declare the route " + route);
    assert.ok(config.includes(`entry: "${entry}"`), "vite config must declare the entry " + entry);
  }
});

test("each entry HTML links the stylesheet declared by its layout", async () => {
  for (const [, id] of ENTRIES) {
    const page = await load<{ entry: string; layout: string }>(`pages/pt-BR/${id}.json`);
    const layout = await load<{ stylesheet: string }>(`layouts/${page.layout}.json`);
    const html = await readFile(join(root, page.entry), "utf8");
    assert.ok(html.includes(`href="/${layout.stylesheet}"`), page.entry + " must link " + layout.stylesheet);
  }
});

test("navigation links use routes instead of html files", async () => {
  const files = [
    "layouts/chooser.html",
    "layouts/chat.html",
    "layouts/site.html",
    "layouts/exemplos.html",
    "content.js",
    "runtime/chat.js",
    "runtime/site-page.js",
    "runtime/site.js"
  ];
  for (const file of files) {
    const source = await readFile(join(root, file), "utf8");
    assert.ok(!/["'][^"']*\.html(?:[?#][^"']*)?["']/.test(source), file + " must not link to .html files");
  }
  const chat = await readFile(join(root, "runtime/chat.js"), "utf8");
  assert.ok(chat.includes('"/descoberta"'));
  assert.ok(chat.includes('"/site#solucoes"'));
});

test("every layout template uses the dark logo", async () => {
  for (const id of ["chooser", "site", "chat", "exemplos"]) {
    const layout = await load<{ template: string }>(`layouts/${id}.json`);
    const template = await readFile(join(root, layout.template), "utf8");
    assert.ok(template.includes("/logo-dark.png"), layout.template + " must use /logo-dark.png");
    assert.ok(!template.includes("logo-white.png"), layout.template + " must not use the light logo");
    assert.ok(!template.includes("logo-black.png"), layout.template + " must not use the black logo");
  }
});

test("the global theme defines one class per theme on the html wrapper", async () => {
  const themes = await readFile(join(root, "layouts/themes.css"), "utf8");
  const runtime = await readFile(join(root, "runtime/theme.js"), "utf8");
  for (const id of ["abyss", "carbon", "ember", "paper"]) {
    assert.ok(themes.includes(".oq-theme-" + id), "themes.css must define the theme " + id);
  }
  for (const token of ["--oq-ground", "--oq-surface", "--oq-ink", "--oq-muted", "--oq-line", "--oq-accent"]) {
    assert.ok(themes.includes(token), "themes.css must define " + token);
  }
  assert.ok(runtime.includes("root.classList.remove"), "trocar de tema e remover a classe atual");
  assert.ok(runtime.includes("root.classList.add"), "trocar de tema e adicionar a classe nova");
  assert.ok(runtime.includes("document.documentElement") || runtime.includes("documentElement"));
});

test("the client-side router swaps pages without reloading the document", async () => {
  const router = await readFile(join(root, "runtime/router.js"), "utf8");
  assert.ok(router.includes("startViewTransition"));
  assert.ok(router.includes("pushState"));
  assert.ok(router.includes("popstate"));
  assert.ok(router.includes("clientNavigation"));
  const loader = await readFile(join(root, "page-config.js"), "utf8");
  assert.ok(loader.includes("createRouter"));
  assert.ok(loader.includes("buildThemeSwitcher"));
  for (const id of ["home", "site", "chat", "exemplos"]) {
    const page = await load<{ clientNavigation?: boolean }>(`pages/pt-BR/${id}.json`);
    assert.equal(page.clientNavigation, true, `${id} must opt into client-side navigation`);
  }
});

test("layout runtimes expose mount(page) for re-execution without re-import", async () => {
  for (const file of [
    "runtime/chooser-page.js",
    "runtime/site-page.js",
    "runtime/site.js",
    "runtime/chat.js",
    "content.js",
    "runtime/exemplos-page.js",
    "runtime/exemplos-scroll.js"
  ]) {
    const source = await readFile(join(root, file), "utf8");
    assert.ok(/export\s+(async\s+)?function\s+mount\s*\(/.test(source), file + " must export mount(page)");
    assert.ok(!source.includes("await window.OaaSPageReady"), file + " must not depend on the global page promise");
  }
});


test("the chat keeps its own navigation and fills the section list separately", async () => {
  const template = await readFile(join(root, "layouts/chat.html"), "utf8");
  assert.ok(template.includes('class="chat-nav"'), "the chat layout must declare the primary navigation");
  assert.ok(template.includes('class="chat-nav-sections"'), "the chat layout must declare the section navigation");
  assert.ok(
    /class="chat-nav"[^]*?href="\/site"/.test(template),
    "the primary navigation must keep the link to /site"
  );
  const content = await readFile(join(root, "content.js"), "utf8");
  assert.ok(
    content.includes(".chat-nav-sections"),
    "the content runtime must fill the section navigation"
  );
  assert.ok(
    !/querySelector\("\.chat-nav"\)/.test(content),
    "the content runtime must not overwrite the primary navigation"
  );
});

test("every published route is reachable from the interface", async () => {
  const chooser = await readFile(join(root, "layouts/chooser.html"), "utf8");
  const site = await readFile(join(root, "layouts/site.html"), "utf8");
  assert.ok(chooser.includes('href="/exemplos"'), "the home must link to /exemplos");
  assert.ok(site.includes('href="/exemplos"'), "the site must link to /exemplos");
  const chat = await readFile(join(root, "layouts/chat.html"), "utf8");
  assert.ok(chat.includes('href="/site"'), "the chat must link to /site");
  assert.ok(chat.includes('href="/"'), "the chat must link back to the home");
  const exemplos = await readFile(join(root, "layouts/exemplos.html"), "utf8");
  assert.ok(exemplos.includes('href="/chat"'), "the examples must link to /chat");
});

test("the router swaps stylesheets using the assets manifest", async () => {
  const config = await readFile(join(root, "vite.config.ts"), "utf8");
  const router = await readFile(join(root, "runtime/router.js"), "utf8");
  assert.ok(config.includes("oaasAssetsManifest"), "the build must publish the assets manifest");
  assert.ok(config.includes("/oaas-assets.json"), "the manifest must be served under /oaas-assets.json");
  assert.ok(router.includes("/oaas-assets.json"), "the router must read the assets manifest");
  assert.ok(router.includes("stylesFor"), "the router must resolve the stylesheets of the target page");
});

test("the shell is the only orchestrator of the title reveal", async () => {
  const reveal = await readFile(join(root, "runtime/word-reveal.js"), "utf8");
  const loader = await readFile(join(root, "page-config.js"), "utf8");
  assert.ok(reveal.includes("h1, h2, h3, h4"), "the reveal must cover every title level");
  assert.ok(reveal.includes("leadOf"), "the reveal must cover the semi-titles");
  assert.ok(reveal.includes("data-rise"), "the reveal must mark the semi-titles");
  assert.ok(loader.includes("applyMotion"), "the shell must apply the motion policy");
  assert.ok(loader.includes("initWordReveal"), "the shell must call the reveal");
  for (const file of ["runtime/chooser-page.js", "runtime/site-page.js"]) {
    const source = await readFile(join(root, file), "utf8");
    assert.ok(
      !source.includes("initWordReveal"),
      file + " must not call the reveal on its own"
    );
  }
});

test("the examples page owns its scroll motion with GSAP and ScrollTrigger", async () => {
  const layout = await load<{ scripts?: string[] }>("layouts/exemplos.json");
  const scripts = layout.scripts || [];
  assert.ok(
    scripts.includes("runtime/exemplos-scroll.js"),
    "the examples layout must load the scroll runtime"
  );
  assert.ok(
    scripts.indexOf("runtime/exemplos-scroll.js") > scripts.indexOf("runtime/exemplos-page.js"),
    "the scroll runtime must run after the content runtime"
  );

  const scroll = await readFile(join(root, "runtime/exemplos-scroll.js"), "utf8");
  assert.ok(scroll.includes('import gsap from "gsap"'), "the scroll runtime must use gsap");
  assert.ok(
    scroll.includes('import { ScrollTrigger } from "gsap/ScrollTrigger"'),
    "the scroll runtime must use ScrollTrigger"
  );
  assert.ok(
    scroll.includes("gsap.registerPlugin(ScrollTrigger)"),
    "ScrollTrigger must be registered before it is used"
  );
  assert.ok(
    scroll.includes("prefers-reduced-motion: no-preference"),
    "the scroll runtime must respect the reduced motion preference"
  );
  assert.ok(
    scroll.includes('ease: "none"'),
    "a scrubbed animation must use the linear ease"
  );
  assert.ok(
    scroll.includes("clearProps"),
    "the entrance must hand the element back to the CSS"
  );
  assert.ok(
    !scroll.includes("await window.OaaSPageReady"),
    "the scroll runtime must not depend on the global page promise"
  );

  const css = await readFile(join(root, "layouts/exemplos.css"), "utf8");
  assert.ok(
    !css.includes("animation-timeline"),
    "the scroll of the examples page belongs to GSAP, not to a native timeline"
  );
  assert.ok(
    !/\.exemplos-layer\s*\{[^}]*border-bottom/.test(css),
    "the architecture list must not draw a horizontal line"
  );
  assert.ok(
    !css.includes(".exemplos-layer::after"),
    "the architecture list must not draw a vertical line"
  );
  assert.ok(
    css.includes(".exemplos-layer-index"),
    "the architecture list must keep the numbered circle"
  );
  assert.ok(
    !/\.exemplos-insight\s*\{[^}]*max-width/.test(css),
    "the closing card must take the width of the grid, not the measure of the text"
  );
  assert.ok(css.includes(".exemplos-insight-text"), "the closing card must keep the text measured");
});
