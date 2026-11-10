/**
 * Forger — gera as páginas rastreáveis e os artefatos de SEO.
 *
 * O forger roda sobre os manifestos de página: cada rota vira um HTML estático
 * com o conteúdo já resolvido, para que buscadores e agentes leiam o produto
 * sem executar o runtime.
 */

import { readFile, writeFile, mkdir, readdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const root = process.cwd();
const baseUrl = (process.env.SITE_URL || "https://oaas.quest").replace(/\/$/, "");
const pageDir = resolve(root, "pages/pt-BR");
const outDir = resolve(root, "dist");
// As paginas rastreaveis nao podem ocupar os mesmos caminhos das entradas do
// app: o build do Vite escreve dist/<rota>/index.html, e sobrescrever esse
// arquivo entrega ao visitante uma pagina sem runtime e sem estilo. As duas
// saidas sao artefatos distintos, entao o forger grava em dist/seo/.
const seoDir = resolve(outDir, process.env.SITE_SEO_DIR || "seo");
// As paginas do forger sao as do manifesto: nenhuma rota fica de fora.
const pages = (await readdir(pageDir))
  .filter(name => name.endsWith(".json"))
  .map(name => name.replace(/\.json$/, ""))
  .sort();

const esc = value =>
  String(value ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  }[c]));

const json = async path => JSON.parse(await readFile(resolve(root, path), "utf8"));

const contentFiles = {
  experience: "content/experience.pt-BR.json",
  "sector-playbooks": "content/sector-playbooks.pt-BR.json",
  "agent-team": "content/agent-team.pt-BR.json",
  "mission-steps": "content/mission-steps.pt-BR.json",
  discovery: "content/discovery.pt-BR.json",
  "proposal-graph": "content/proposal-graph.pt-BR.json",
  "ui-copy": "content/ui-copy.pt-BR.json",
  exemplos: "content/exemplos.pt-BR.json"
};

const get = (obj, path) => path.split(".").filter(Boolean).reduce((value, key) => (value ? value[key] : value), obj);

const extractText = (value, acc = []) => {
  if (typeof value === "string" && value.trim()) acc.push(value.trim());
  else if (Array.isArray(value)) value.forEach(item => extractText(item, acc));
  else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      if (!["id", "key", "slug", "url", "href", "icon"].includes(key)) extractText(item, acc);
    });
  }
  return acc;
};

await mkdir(seoDir, { recursive: true });

/**
 * Nao sobrescreve uma entrada do app: se o destino for o HTML do Vite, o
 * forger falha em vez de destruir a pagina.
 */
async function assertNotAppEntry(target) {
  try {
    const current = await readFile(target, "utf8");
    if (current.includes("oaas-page-root")) {
      throw new Error(
        "FORGER_COLLIDE:" + target + " e uma entrada do app; o forger grava em dist/seo/"
      );
    }
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "FORGER_COLLIDE") throw error;
    if (error && typeof error === "object" && error.message && String(error.message).startsWith("FORGER_COLLIDE:")) throw error;
    // Arquivo inexistente: nada a preservar.
  }
}

const sitemap = [];

for (const id of pages) {
  const page = await json(`pages/pt-BR/${id}.json`);
  const description =
    page.description ||
    "OaaS.Quest transforma objetivos empresariais em missões executáveis, com soluções, evidências e resultados verificáveis.";
  const canonical = baseUrl + (page.route === "/" ? "" : page.route);

  const refs = [
    ...(page.contentRefs || []),
    ...(page.sections || []).map(section => section.contentRef)
  ].filter(Boolean);

  const sources = {};
  for (const ref of refs) {
    const source = ref.split(".")[0];
    if (contentFiles[source] && !sources[source]) sources[source] = await json(contentFiles[source]);
  }

  const text = refs.flatMap(ref =>
    extractText(get(sources[ref.split(".")[0]], ref.split(".").slice(1).join(".")))
  );
  const unique = [...new Set(text)].slice(0, 80);

  const sectionHtml = (page.sections || [])
    .map(section => {
      const content = extractText(
        get(sources[section.contentRef.split(".")[0]], section.contentRef.split(".").slice(1).join("."))
      ).slice(0, 4);
      return `<section id="${esc(section.id)}"><h2>${esc(section.title || section.id.replace(/-/g, " "))}</h2><p>${esc(content.join(" "))}</p></section>`;
    })
    .join("\n");

  const body = `<main><h1>${esc(page.heading || page.title)}</h1><p>${esc(description)}</p>${sectionHtml}<section aria-label="Conteúdo relacionado"><h2>Conteúdo</h2><ul>${unique.map(item => `<li>${esc(item)}</li>`).join("")}</ul></section></main>`;

  const html = `<!doctype html><html lang="${esc(page.locale || "pt-BR")}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(page.title)}</title><meta name="description" content="${esc(description)}"><link rel="canonical" href="${esc(canonical)}"><meta property="og:type" content="website"><meta property="og:site_name" content="OaaS.Quest"><meta property="og:title" content="${esc(page.title)}"><meta property="og:description" content="${esc(description)}"><meta property="og:url" content="${esc(canonical)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(page.title)}"><meta name="twitter:description" content="${esc(description)}"><script type="application/ld+json">${JSON.stringify({
    "@context": "https://schema.org",
    "@type": "WebPage",
    name: page.title,
    description,
    url: canonical,
    inLanguage: page.locale || "pt-BR",
    isPartOf: { "@type": "WebSite", name: "OaaS.Quest", url: baseUrl }
  }).replace(/</g, "\\u003c")}</script></head><body>${body}<noscript>OaaS.Quest — Your Goal. Our Quest.</noscript></body></html>`;

  const target = page.route === "/" ? "index.html" : page.route.replace(/^\//, "") + "/index.html";
  const destination = resolve(seoDir, target);
  await mkdir(dirname(destination), { recursive: true });
  await assertNotAppEntry(destination);
  await writeFile(destination, html);

  sitemap.push(`<url><loc>${esc(canonical)}</loc></url>`);
}

await writeFile(
  resolve(outDir, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${sitemap.join("")}</urlset>`
);
await writeFile(
  resolve(outDir, "robots.txt"),
  `User-Agent: *\nAllow: /\nSitemap: ${baseUrl}/sitemap.xml\n`
);
await writeFile(
  resolve(outDir, "llms.txt"),
  `# OaaS.Quest\n\nYour Goal. Our Quest.\n\nOaaS.Quest transforma objetivos em resultados verificáveis por meio de diagnóstico, planejamento, execução e evidências.\n\n## Páginas\n- ${baseUrl}/\n- ${baseUrl}/site/\n- ${baseUrl}/chat/\n- ${baseUrl}/descoberta/\n- ${baseUrl}/proposta/\n- ${baseUrl}/exemplos/\n\n## Princípios\n- Objetivos e critérios explícitos.\n- Execução governada por risco e autorização.\n- Evidências, métricas e auditoria para validar resultados.\n`
);

console.log(`Forger: ${pages.length} páginas (${pages.join(", ")}), sitemap, robots.txt e llms.txt gerados em dist/.`);
