import { test, expect } from "@playwright/test";

test("site result CTAs open the full discovery conversation in the branded Chat", async ({ page }) => {
  await page.goto("/site");

  await expect(page.locator("#nav-cta")).toHaveText("Quero alcançar um resultado");
  await expect(page.locator("#nav-cta")).toHaveAttribute("href", "/chat#descoberta");
  await expect(page.locator(".hero-actions a.cta").first()).toHaveAttribute("href", "/descoberta");
  await expect(page.locator(".hero-brand-lockup img")).toHaveAttribute("src", "/logo-dark.png");

  await page.locator(".hero-actions a.cta").first().click();
  await expect(page).toHaveURL(/\/descoberta$/);
  await expect(page.locator("#chat")).toBeVisible();
  await expect(page.getByText("Nome da empresa", { exact: true })).toBeVisible();
});

test("chat types its welcome messages before exposing the first choices", async ({ page }) => {
  await page.goto("/chat");

  const choices = page.locator("#audience-choices");
  await expect(page.locator(".chat-bubble-brief .chat-bubble-lead")).toContainText("assistente do OaaS.Quest");
  await expect(page.locator(".chat-bubble").nth(1).locator(".chat-bubble-lead")).toContainText("Qual é o seu papel nesta jornada?");
  await expect(choices).toBeVisible();
  await expect(choices.getByRole("button", { name: "Sou empresário" })).toBeVisible();

  await choices.getByRole("button", { name: "Sou empresário" }).click();
  await expect(page.getByText("Em qual setor sua empresa atua?")).toBeVisible();
  await expect(page.getByRole("button", { name: "Comércio" })).toBeVisible();
});
