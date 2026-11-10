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
  ["classico.html", "classic", "/classico"],
  ["guilda.html", "guild", "/guilda"],
  ["descoberta/index.html", "discovery", "/descoberta"]
] as const;

test("pages reference existing layouts, templates and resolvable JSON content", async () => {
  for (const id of ["home", "classic", "guild", "discovery"]) {
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
  for (const id of ["chooser", "classic", "guild", "discovery"]) {
    const layout = await load<{ id: string; template: string; stylesheet: string; renderer: string; slots: string[] }>(`layouts/${id}.json`);
    assert.equal(layout.id, id);
    assert.ok(layout.template && layout.stylesheet && layout.renderer && layout.slots.length > 0);
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
    assert.ok(html.includes('src="/page-config.js"'), path + " must load the page runtime");
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
  for (const id of ["chooser", "classic", "guild", "discovery"]) {
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
  for (const file of ["layouts/chooser.html", "layouts/guild.html", "layouts/classic.html", "content.js", "runtime/guild.js", "runtime/classic.js"]) {
    const source = await readFile(join(root, file), "utf8");
    assert.ok(!/["'][^"']*\.html(?:[?#][^"']*)?["']/.test(source), file + " must not link to .html files");
  }
  const guild = await readFile(join(root, "runtime/guild.js"), "utf8");
  assert.ok(guild.includes('window.location.href="/descoberta"'));
  assert.ok(guild.includes('"/classico#desenvolvedores"'));
});
