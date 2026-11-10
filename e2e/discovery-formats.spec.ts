import { test, expect } from "@playwright/test";

const retailAnswers = {
  company_name: { value: "Mercado E2E" },
  segment: { value: "retail" },
  team_size: { value: "2_5" },
  main_goal: { value: "sales" },
  lead_registration: { value: "none" },
  abandonment_tracking: { value: "no" },
  stock_control: { value: "manual" },
  investment: { value: "limited" }
};

async function completeDiscovery(page: any) {
  for (let stage = 0; stage < 18; stage++) {
    await page.getByRole("button", { name: /pular etapa/i }).click();
  }
  await page.getByRole("button", { name: /gerar diagnóstico/i }).click();
  await expect(page.getByText("Diagnóstico preliminar")).toBeVisible();
  await page.getByRole("button", { name: /montar proposta preliminar/i }).click();
  await expect(page).toHaveURL(/\/proposta/);
  await expect(page.getByText("Mercado E2E").first()).toBeVisible();
}

test("Guilda confirms a retail mission, hands off to Discovery and persists the proposal", async ({ page }) => {
  await page.goto("/guilda");
  await page.getByRole("button", { name: "Sou empresário" }).click();
  await page.getByRole("button", { name: "Comércio" }).click();
  await page.getByRole("button", { name: "2–5 pessoas" }).click();
  const input = page.locator("#message");
  const form = page.locator("#composer");
  for (const answer of ["Aumentar vendas", "Controle de estoque e reposição", "Rupturas de estoque e falta de visibilidade"]) {
    await input.fill(answer);
    await form.locator('button[type="submit"]').click();
  }
  await page.getByRole("button", { name: "Até 90 dias" }).click();
  await input.fill("Reduzir rupturas e aumentar vendas");
  await form.locator('button[type="submit"]').click();
  await expect(page.getByText(/resumo inicial da sua missão/i)).toBeVisible();
  await page.getByRole("button", { name: /confirmar missão e aprofundar diagnóstico/i }).click();
  await page.getByRole("button", { name: /aprofundar diagnóstico/i }).click();
  await expect(page).toHaveURL(/\/descoberta/);
  const handoff = await page.evaluate(() => JSON.parse(localStorage.getItem("goaltropic.discovery.v1") || "null"));
  expect(handoff.source).toBe("guilda");
  expect(handoff.answers.segment.value).toBe("retail");
  expect(handoff.answers.team_size.value).toBe("2_5");
  expect(handoff.answers.main_goal.value).toBe("sales");
  await page.evaluate((answers) => {
    const saved = JSON.parse(localStorage.getItem("goaltropic.discovery.v1") || "{}");
    saved.answers = { ...saved.answers, ...answers };
    localStorage.setItem("goaltropic.discovery.v1", JSON.stringify(saved));
  }, retailAnswers);
  await completeDiscovery(page);
  await page.reload();
  await expect(page.getByText("Mercado E2E").first()).toBeVisible();
});

test("Classic Discovery builds and persists the same retail proposal", async ({ page }) => {
  await page.goto("/descoberta");
  await page.evaluate((answers) => {
    localStorage.setItem("goaltropic.discovery.v1", JSON.stringify({ index: 0, answers, source: "discovery" }));
  }, retailAnswers);
  await page.reload();
  await completeDiscovery(page);
  await page.reload();
  await expect(page.getByText("Mercado E2E").first()).toBeVisible();
});
