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

test("o Chat envia a primeira intenção à API e apresenta a resposta do assistente", async ({ page }) => {
  let requestBody: any = null;
  await page.route("**/api/chat/turn", async route => {
    requestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        sessionId: requestBody.sessionId,
        reply: "Entendi seu objetivo. Em qual setor sua empresa atua?"
      })
    });
  });

  await page.goto("/chat");
  await page.locator("#message").fill("quero vender mais");
  await page.locator('#composer button[type="submit"]').click();

  await expect(page.locator(".chat-message[data-role=\"assistant\"]").last())
    .toContainText("Em qual setor sua empresa atua?");
  expect(requestBody.message).toBe("quero vender mais");
  expect(requestBody.context.mission.answers.desiredOutcome.value).toBe("quero vender mais");
  expect(requestBody.context.nextQuestion).toBe("Em qual setor sua empresa atua?");
});
