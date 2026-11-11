import { test, expect } from "@playwright/test";

test("primeira mensagem espontânea inicia uma missão e preserva o objetivo informado", async ({ page }) => {
  await page.goto("/chat");
  await page.locator("#message").fill("quero vender mais");
  await page.locator('#composer button[type="submit"]').click();

  await expect(page.locator("#goal")).toHaveText("quero vender mais");
  await expect(page.locator("#audience-choices")).toBeHidden();
  await expect(page.getByText("Em qual setor sua empresa atua?")).toBeVisible();
  await expect(page.locator(".chat-message[data-role=\"user\"] .chat-bubble").filter({ hasText: "quero vender mais" })).toBeVisible();

  const mission = await page.evaluate(async () => {
    const oq = await (window as any).OQReady;
    return oq.getMission();
  });
  expect(mission.answers.desiredOutcome.value).toBe("quero vender mais");
  expect(mission.stepIndex).toBe(0);
});

test("boas-vindas não usam termos de RPG", async ({ page }) => {
  await page.goto("/chat");
  const welcome = await page.locator(".chat-bubble-brief").innerText();
  expect(welcome.toLowerCase()).not.toMatch(/guilda|aventureiro|mestre|expedição|reino|orbe/);
  expect(welcome).toContain("assistente do OaaS.Quest");
});

test("o reconhecimento mostra opções após a digitação e rejeita respostas digitadas", async ({ page }) => {
  let apiCalls = 0;
  await page.route("**/api/chat/turn", async route => {
    apiCalls++;
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ reply: "Complementação da missão." }) });
  });

  await page.goto("/chat");
  await page.locator("#message").fill("quero vender mais");
  await page.locator('#composer button[type="submit"]').click();

  const sectorQuestion = page.getByText("Em qual setor sua empresa atua?");
  await expect(sectorQuestion).toBeVisible();
  await expect(page.getByRole("button", { name: "Comércio" })).toBeVisible();

  await page.locator("#message").fill("Comércio, mas também vendo pela internet");
  await page.locator('#composer button[type="submit"]').click();
  await expect(page.getByText(/Respostas digitadas não são registradas nesta etapa/i)).toBeVisible();
  await expect(page.getByRole("button", { name: "Comércio" })).toBeVisible();

  const mission = await page.evaluate(async () => {
    const oq = await (window as any).OQReady;
    return oq.getMission();
  });
  expect(mission.stepIndex).toBe(0);
  expect(mission.answers.segment).toBeUndefined();
  expect(apiCalls).toBe(0);

  await page.getByRole("button", { name: "Comércio" }).click();
  await expect(page.getByText("Qual é o tamanho aproximado da operação?")).toBeVisible();
  await expect(page.getByRole("button", { name: "2–5 pessoas" })).toBeVisible();
});
