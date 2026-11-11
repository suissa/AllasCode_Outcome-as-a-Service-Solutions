import { test, expect } from "@playwright/test";

const sectors = [["retail","Varejo e comércio"],["services","Empresas de serviços"],["food-hospitality","Alimentação, restaurantes e hotelaria"],["health","Saúde e clínicas"],["industry","Indústria e manufatura"],["logistics","Logística e transporte"],["professional-services","Serviços profissionais, jurídico e contábil"],["education","Educação e treinamento"],["real-estate","Imobiliário"],["construction","Construção e engenharia"],["ecommerce","E-commerce e negócios digitais"],["finance","Finanças, crédito e cobrança"]];

for (const [sectorId, sectorName] of sectors) {
  test(`Chat selects the dedicated discovery script for ${sectorName}`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/chat#descoberta");
    await page.evaluate(async () => {
      await (window as typeof window & { OaaSPageScriptsReady?: Promise<unknown> }).OaaSPageScriptsReady;
    });

    const sources = await page.evaluate(async () => {
      await (window as typeof window & { OaaSPageReady?: Promise<unknown> }).OaaSPageReady;
      return (window as typeof window & { OaaSPage?: { sources: any } }).OaaSPage?.sources;
    });
    const common = sources.discovery.stages.slice(0, 2).flatMap((stage: any) => stage.questions);
    const sector = sources["sector-playbooks"].sectors.find((item: any) => item.id === sectorId);
    const script = sources["sector-discovery"].scripts[sectorId];
    expect(sector.name).toBe(sectorName);
    expect(script.stages.length).toBeGreaterThanOrEqual(3);

    for (const question of common) {
      await expect(page.getByText(question.label, { exact: false })).toBeVisible();
      if (question.id === "segment") {
        await page.getByRole("button", { name: sectorName, exact: true }).click();
      } else if (question.type === "single") {
        await page.getByRole("button", { name: question.options[0].label, exact: true }).click();
      } else if (question.type === "multi") {
        await page.getByRole("button", { name: question.options[0].label, exact: true }).click();
        await page.getByRole("button", { name: "Confirmar seleção" }).click();
      } else {
        await page.locator("#message").fill(question.type === "number" ? "100" : "Empresa de teste");
        await page.getByRole("button", { name: "Enviar" }).click();
      }
    }

    const firstSectorQuestion = script.stages[0].questions[0];
    await expect(page.getByText(firstSectorQuestion.label, { exact: false })).toBeVisible();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("goaltropic.discovery.v1") || "null"));
    expect(saved.sectorScriptId).toBe(sectorId);
    expect(saved.sectorName).toBe(sectorName);
  });
}
