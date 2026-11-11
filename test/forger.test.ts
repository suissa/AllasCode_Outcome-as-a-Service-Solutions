import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

test("Forger emits crawlable HTML and SEO artifacts", () => {
  execFileSync("node", ["scripts/forger.mjs"], { stdio: "pipe" });
  for (const file of [
    "index.html",
    "site/index.html",
    "chat/index.html",
    "descoberta/index.html",
    "proposta/index.html"
  ]) {
    assert.ok(existsSync("dist/seo/" + file), "missing dist/seo/" + file);
  }
  for (const file of ["sitemap.xml", "robots.txt", "llms.txt"]) {
    assert.ok(existsSync("dist/" + file), "missing dist/" + file);
  }
});

test("the forger never overwrites the app entries built by Vite", () => {
  const source = readFileSync("scripts/forger.mjs", "utf8");
  assert.ok(source.includes("FORGER_COLLIDE"), "the forger must refuse to overwrite an app entry");
  assert.ok(source.includes('"seo"'), "the forger must write its pages under dist/seo/");
});

test("generated pages include semantic content and unique canonical metadata", async () => {
  const html = await readFile("dist/seo/index.html", "utf8");
  assert.match(html, /<main>/);
  assert.match(html, /<h1>/);
  assert.match(html, /name="description"/);
  assert.match(html, /rel="canonical"/);
  assert.match(html, /application\/ld\+json/);
  assert.ok(html.includes("OaaS.Quest"));
  assert.ok(html.includes("UMA NOVA FORMA DE CONQUISTAR RESULTADOS"));
});

test("the site route publishes the institutional presentation copy", async () => {
  const html = await readFile("dist/seo/site/index.html", "utf8");
  assert.match(html, /<h1>/);
  assert.ok(html.includes("OaaS.Quest"));
  assert.ok(html.includes("Outcome as a Service"));
});

test("the chat route publishes the mission copy", async () => {
  const html = await readFile("dist/seo/chat/index.html", "utf8");
  assert.match(html, /<h1>/);
  assert.ok(html.includes("OaaS.Quest"));
});

test("minimal chooser renders only the logo and the two entry actions", async () => {
  const template = await readFile("layouts/chooser.html", "utf8");
  assert.ok(template.includes("logo-dark.png"));
  assert.ok(template.includes('href="/chat"'));
  assert.ok(template.includes('href="/site"'));
  assert.equal((template.match(/<a/g) || []).length, 3);
  assert.ok(!template.includes("data-copy"));
  assert.ok(!template.includes('href="/exemplos"'));
  assert.ok(!template.includes('href="/descoberta'));
  assert.ok(!template.includes('href="/proposta'));
});
test("proposal report is included in crawlable SEO and GEO output", async () => {
  const html = await readFile("dist/seo/proposta/index.html", "utf8");
  const llms = await readFile("dist/llms.txt", "utf8");
  assert.match(html, /<h1>/);
  assert.match(html, /proposta preliminar/i);
  assert.match(html, /rel="canonical"/);
  assert.match(llms, /\/proposta\//);
});
