import { test, expect } from "@playwright/test";

test("a página de entrada apresenta somente Chat e Site", async ({ page }) => {
  await page.goto("/entrar");

  await expect(page).toHaveTitle("OaaS.Quest — Entrar");
  await expect(page.getByRole("img", { name: "OaaS.Quest" })).toBeVisible();

  const options = page.locator(".entry-card");
  await expect(options).toHaveCount(2);
  await expect(page.getByRole("link", { name: "Entrar no Chat" })).toHaveAttribute("href", "/chat");
  await expect(page.getByRole("link", { name: "Entrar no Site" })).toHaveAttribute("href", "/site");

  await expect(page.locator("nav, footer, .entry-menu")).toHaveCount(0);
  await expect(page.getByRole("heading")).toHaveCount(0);
});

test("selecionar Chat navega diretamente para o Chat", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Entrar no Chat" }).click();
  await expect(page).toHaveURL(/\/chat\/?$/);
});

test("selecionar Site navega diretamente para o Site", async ({ page }) => {
  await page.goto("/entrar");
  await page.getByRole("link", { name: "Entrar no Site" }).click();
  await expect(page).toHaveURL(/\/site\/?$/);
});
