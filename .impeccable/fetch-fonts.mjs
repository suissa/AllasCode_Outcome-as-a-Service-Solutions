import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36";
const OUT = process.argv[2];
const requests = [
  { family: "Archivo", query: "family=Archivo:wght@100..900" },
  { family: "Spline Sans Mono", query: "family=Spline+Sans+Mono:wght@300;400;500;600;700" }
];
const KEEP = ["U+0000-00FF", "U+0100-02BA"];
const faces = [];

for (const req of requests) {
  const css = await (await fetch("https://fonts.googleapis.com/css2?" + req.query + "&display=swap", { headers: { "User-Agent": UA } })).text();
  for (const raw of css.split("@font-face").slice(1)) {
    const body = "@font-face" + raw.split("}")[0] + "}";
    const range = (body.match(/unicode-range:\s*([^;]+);/) || [])[1] || "";
    const subset = KEEP.find(k => range.includes(k));
    if (!subset) continue;
    const src = (body.match(/url\((https:[^)]+\.woff2)\)/) || [])[1];
    if (!src) continue;
    const weight = (body.match(/font-weight:\s*([^;]+);/) || [])[1].trim();
    const style = (body.match(/font-style:\s*([^;]+);/) || [])[1].trim();
    const tag = subset === "U+0000-00FF" ? "latin" : "latin-ext";
    const name = (req.family.toLowerCase().replace(/\s+/g, "-")) + "-" + weight.replace(/\s+/g, "_") + "-" + tag + ".woff2";
    const buf = Buffer.from(await (await fetch(src)).arrayBuffer());
    await writeFile(join(OUT, name), buf);
    faces.push({ css: `@font-face {
  font-family: "${req.family}";
  font-style: ${style};
  font-weight: ${weight};
  font-display: swap;
  src: url("./${name}") format("woff2");
}`, name, bytes: buf.length });
    console.log("baixado", name, buf.length);
  }
}

await mkdir(OUT, { recursive: true });
await writeFile(join(OUT, "fonts.css"), faces.map(f => f.css).join("\n") + "\n");
console.log("faces:", faces.length);
