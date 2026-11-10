import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

test("Forger emits crawlable HTML and SEO artifacts", () => {
  execFileSync("node", ["scripts/forger.mjs"], { stdio: "pipe" });
  for (const file of [
    "index.html",
    "site/index.html",
    "chat/index.html",
    "descoberta/index.html",
    "proposta/index.html",
    "sitemap.xml",
    "robots.txt",
    "llms.txt"
  ]) {
    assert.ok(existsSync("dist/" + file), "missing dist/" + file);
  }
});

test("generated pages include semantic content and unique canonical metadata", async () => {
  const html = await readFile("dist/index.html", "utf8");
  assert.match(html, /<main>/);
  assert.match(html, /<h1>/);
  assert.match(html, /name="description"/);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
  assert.ok(html.includes("OaaS.Quest"));
  assert.ok(html.includes("UMA NOVA FORMA DE CONQUISTAR RESULTADOS"));
});

test("the site route publishes the institutional presentation copy", async () => {
  const html = await readFile("dist/site/index.html", "utf8");
  assert.match(html, /<h1>/);
  assert.ok(html.includes("OaaS.Quest"));
  assert.ok(html.includes("Outcome as a Service"));
});

test("the chat route publishes the mission copy", async () => {
  const html = await readFile("dist/chat/index.html", "utf8");
  assert.match(html, /<h1>/);
  assert.ok(html.includes("OaaS.Quest"));
});

test("chooser template copy bindings resolve against the locale catalog", async () => {
  const [template, catalogText] = await Promise.all([
    readFile("layouts/chooser.html", "utf8"),
    readFile("content/ui-copy.pt-BR.json", "utf8")
  ]);
  const catalog = JSON.parse(catalogText);
  const resolve = (path: string) => path.split(".").reduce((value: any, key: string) => value?.[key], catalog);
  const bindings = [...template.matchAll(/data-copy(?:-aria-label)?="([^"]+)"/g)].flatMap(match => match[1] ? [match[1]] : []);
  assert.ok(bindings.length > 0, "chooser should declare localized copy bindings");
  for (const binding of bindings) {
    assert.equal(typeof resolve(binding), "string", `missing localized copy: ${binding}`);
  }
});

test("proposal report is included in crawlable SEO and GEO output", async () => {
  const html = await readFile("dist/proposta/index.html", "utf8");
  const llms = await readFile("dist/llms.txt", "utf8");
  assert.match(html, /<h1>/);
  assert.match(html, /proposta preliminar/i);
  assert.match(html, /rel="canonical"/);
  assert.match(llms, /\/proposta\//);
});
