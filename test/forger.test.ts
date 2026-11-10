import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";

test("Forger emits crawlable HTML and SEO artifacts", () => {
  execFileSync("node", ["scripts/forger.mjs"], { stdio: "pipe" });
  for (const file of ["index.html","classico/index.html","guilda/index.html","descoberta/index.html","sitemap.xml","robots.txt","llms.txt"]) {
    assert.ok(existsSync("dist/"+file), "missing dist/"+file);
  }
});
test("generated pages include semantic content and unique canonical metadata", async () => {
  const html=await readFile("dist/index.html","utf8");
  assert.match(html,/<main>/); assert.match(html,/<h1>/); assert.match(html,/name="description"/);
  assert.match(html,/rel="canonical"/); assert.match(html,/application\/ld\+json/);
  assert.ok(html.includes('OaaS.Quest'));
  assert.ok(html.includes('UMA NOVA FORMA DE CONQUISTAR RESULTADOS'));
  assert.ok(html.includes('Modo Guilda'));
  assert.ok(html.includes('Modo Clássico'));
});
