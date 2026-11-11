import test from "node:test";
import assert from "node:assert/strict";
import { OAAAS_SLIDES, renderOaasSlider } from "../runtime/oaas-overview-slider.js";

test("OaaS overview contains the full SaaS-to-outcome narrative", () => {
  assert.equal(OAAAS_SLIDES.length, 15);
  assert.equal(OAAAS_SLIDES[0].title, "Do SaaS ao OaaS");
  assert.equal(OAAAS_SLIDES.at(-1).title, "Pare de comprar licenças. Destrave sua operação.");
});

test("slider renders accessible navigation and the first slide", () => {
  const html = renderOaasSlider("test-overview");
  assert.match(html, /id="test-overview"/);
  assert.match(html, /aria-label="Apresentação: Do SaaS ao OaaS"/);
  assert.match(html, /data-slider-prev/);
  assert.match(html, /data-slider-next/);
  assert.match(html, /A inteligência artificial está mudando/);
  assert.match(html, /data-slider-go="14"/);
});
