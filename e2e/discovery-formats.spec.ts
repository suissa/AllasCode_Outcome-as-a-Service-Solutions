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

test("Chat confirms a retail mission, hands off to Discovery and persists the proposal", async ({ page }) => {
  await page.goto("/chat");
  // Wait for the page shell and chat runtime to attach their event handlers.
  await page.evaluate(async () => {
    await (window as typeof window & { OaaSPageScriptsReady?: Promise<unknown> }).OaaSPageScriptsReady;
  });
  await page.getByRole("button", { name: "Sou empresário" }).click();
  await page.getByRole("button", { name: "Comércio" }).click();
  await page.getByRole("button", { name: "2–5 pessoas" }).click();
  await page.getByRole("button", { name: "Aumentar as vendas" }).click();
  await page.getByRole("button", { name: "Estoque e compras" }).click();
  await page.getByRole("button", { name: "Falta de dados e visibilidade" }).click();
  await page.getByRole("button", { name: "Até 90 dias" }).click();
  await page.getByRole("button", { name: "Aumentar faturamento" }).click();
  await expect(page.getByText(/resumo inicial da sua missão/i)).toBeVisible();
  await page.getByRole("button", { name: /confirmar missão e aprofundar diagnóstico/i }).click();
  await page.getByRole("button", { name: /aprofundar diagnóstico/i }).click();
  await expect(page).toHaveURL(/chat#descoberta$/);
  const handoff = await page.evaluate(() => JSON.parse(localStorage.getItem("goaltropic.discovery.v1") || "null"));
  expect(handoff.source).toBe("chat");
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

test("Discovery builds and persists the same retail proposal", async ({ page }) => {
  await page.goto("/descoberta");
  await page.evaluate((answers) => {
    localStorage.setItem("goaltropic.discovery.v1", JSON.stringify({ index: 0, answers, source: "discovery" }));
  }, retailAnswers);
  await page.reload();
  await completeDiscovery(page);
  await page.reload();
  await expect(page.getByText("Mercado E2E").first()).toBeVisible();
});


test("Site CTA opens the complete Discovery sequence inside Chat", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/site");
  await page.evaluate(async () => {
    await (window as typeof window & { OaaSPageScriptsReady?: Promise<unknown> }).OaaSPageScriptsReady;
  });
  await page.locator("#nav-cta").click();
  await expect(page).toHaveURL(/\/chat#descoberta$/);
  await expect(page.getByText("Nome da empresa", { exact: false })).toBeVisible();

  const config = await page.evaluate(async () => {
    await (window as typeof window & { OaaSPageReady?: Promise<unknown> }).OaaSPageReady;
    return (window as typeof window & { OaaSPage?: { sources: { discovery: any } } }).OaaSPage?.sources.discovery;
  });
  const questions = config.stages.flatMap((stage: any) => stage.questions);
  for (const question of questions) {
    await expect(page.getByText(question.label, { exact: false })).toBeVisible();
    if (question.type === "single") {
      await page.getByRole("button", { name: question.options[0].label, exact: true }).click();
    } else if (question.type === "multi") {
      await page.getByRole("button", { name: question.options[0].label, exact: true }).click();
      await page.getByRole("button", { name: "Confirmar seleção" }).click();
    } else {
      await page.locator("#message").fill(question.type === "number" ? "100" : "Resposta de teste");
      await page.getByRole("button", { name: "Enviar" }).click();
    }
  }
  await expect(page.getByText(/Você concluiu as \d+ perguntas da Descoberta/)).toBeVisible();
  await expect(page.getByText(/hipóteses preliminares, não resultados comprovados/)).toBeVisible();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("goaltropic.discovery.v1") || "null"));
  expect(saved.source).toBe("chat");
  expect(saved.chatCompleted).toBe(true);
  expect(Object.keys(saved.answers).length).toBeGreaterThanOrEqual(questions.length);
});
