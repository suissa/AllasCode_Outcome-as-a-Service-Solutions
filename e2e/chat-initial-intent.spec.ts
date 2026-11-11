import { test, expect } from "@playwright/test";

test("primeira mensagem espontânea inicia uma missão e preserva o objetivo informado", async ({ page }) => {
  await page.goto("/chat");
  await page.locator("#message").fill("quero vender mais");
  await page.locator('#composer button[type="submit"]').click();

  await expect(page.locator("#goal")).toHaveText("quero vender mais");
  await expect(page.locator("#audience-choices")).toBeHidden();
  await expect(page.getByText("Em qual setor sua empresa atua?")).toBeVisible();
  await expect(page.getByText("quero vender mais", { exact: true })).toBeVisible();

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
