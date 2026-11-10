import { test, expect, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";

const answers = JSON.parse(readFileSync(new URL("../test/fixtures/retail-discovery.json", import.meta.url), "utf8"));
const stages = JSON.parse(readFileSync(new URL("../content/discovery.pt-BR.json", import.meta.url), "utf8")).stages;

async function answerCurrentStage(page: Page) {
  for (const [id, value] of Object.entries(answers) as [string, string | number | string[]][]) {
    if (Array.isArray(value)) {
      for (const item of value) {
        const control = page.locator('input[type="checkbox"][name="' + id + '"][value="' + item + '"]');
        if (await control.count()) await control.check();
      }
      continue;
    }
    const radio = page.locator('input[type="radio"][name="' + id + '"][value="' + value + '"]');
    if (await radio.count()) {
      await radio.check();
      continue;
    }
    const field = page.locator('[data-field="' + id + '"]');
    if (await field.count()) await field.fill(String(value));
  }
}

async function completeDiscovery(page: Page, reloadAfterStage = -1) {
  for (let index = 0; index < stages.length; index++) {
    await expect(page.locator("#screen h1")).toHaveText(stages[index].title);
    await answerCurrentStage(page);
    await page.locator("#next").click();
    if (index < stages.length - 1) {
      await expect(page.locator("#screen h1")).toHaveText(stages[index + 1].title);
      if (index === reloadAfterStage) {
        await page.reload({ waitUntil: "domcontentloaded" });
        await expect(page.locator("#screen h1")).toHaveText(stages[index + 1].title);
      }
    }
  }
  await expect(page.locator("#proposal")).toBeVisible();
}

async function openAndVerifyProposal(page: Page) {
  await page.locator("#proposal").click();
  await expect(page).toHaveURL(/\/proposta\/$/);
  await expect(page.locator("#proposal-report")).toContainText("Mercado Aurora");
  await expect(page.locator("#proposal-report")).toContainText("Recuperação de oportunidades comerciais");
  await expect(page.locator("#proposal-report")).toContainText("Otimização de estoque e disponibilidade");
  await expect(page.locator("#proposal-report")).toContainText("Análise e validação de evidências");
  await expect(page.locator("#printProposal")).toBeVisible();
  return page.locator("#proposal-report .card h3").allTextContents();
}

test("E2E Guilda: retail conversation → review → confirmation → Discovery → preliminary proposal", async ({ page }) => {
  await page.goto("/guilda.html", { waitUntil: "domcontentloaded" });
  await page.getByRole("button", { name: "Sou empresário" }).click();

  await page.getByRole("button", { name: "Comércio" }).click();
  await page.getByRole("button", { name: "6–15 pessoas" }).click();

  const mission = [
    "Aumentar vendas e margem sem ampliar a equipe",
    "Vendas presenciais e digitais, atendimento por WhatsApp e controle de estoque",
    "Equipe sobrecarregada, contatos sem retorno e falta de visibilidade do estoque"
  ];
  for (const value of mission) {
    await page.locator("#message").fill(value);
    await page.locator("#composer button[type=submit]").click();
  }
  await page.getByRole("button", { name: "Até 90 dias" }).click();
  await page.locator("#message").fill("Elevar conversão de 2,4% para 3,5% e melhorar margem por pedido");
  await page.locator("#composer button[type=submit]").click();

  await expect(page.locator("#mission-controls")).toContainText("Confirmar missão e aprofundar diagnóstico");
  await page.getByRole("button", { name: "Confirmar missão e aprofundar diagnóstico" }).click();
  await page.getByRole("button", { name: "Aprofundar diagnóstico" }).click();
  await expect(page).toHaveURL(/\/descoberta\/(?:index\.html)?$/);
  await expect(page.locator("#app")).toContainText("Missão recebida do Modo Guilda");

  await completeDiscovery(page);
  const cards = await openAndVerifyProposal(page);
  expect(cards).toContain("Recuperação de oportunidades comerciais");
  expect(cards).toContain("Otimização de estoque e disponibilidade");
});

test("E2E Discovery: retail answers → progress persistence → preliminary proposal", async ({ page }) => {
  await page.goto("/descoberta/", { waitUntil: "domcontentloaded" });
  await completeDiscovery(page, 1);
  const cards = await openAndVerifyProposal(page);
  expect(cards).toContain("Recuperação de oportunidades comerciais");
  expect(cards).toContain("Otimização de estoque e disponibilidade");
  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("goaltropic.discovery.v1") || "{}"));
  expect(stored.answers.segment.value).toBe("retail");
  expect(stored.answers.company_name.value).toBe("Mercado Aurora");
});
