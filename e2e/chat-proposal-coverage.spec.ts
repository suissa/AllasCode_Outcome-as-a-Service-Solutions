import { readFileSync } from "node:fs";
import { test, expect, type Page } from "@playwright/test";

type ProposalSolution = {
  id: string;
  name: string;
  signals: string[];
};

type ProposalGraph = {
  solutions: ProposalSolution[];
};

const graph = JSON.parse(
  readFileSync(new URL("../content/proposal-graph.pt-BR.json", import.meta.url), "utf8")
) as ProposalGraph;

const discoveryKey = "goaltropic.discovery.v1";

function signalsFor(solution: ProposalSolution): Record<string, { value: string; status: "provided"; source: "e2e" }> {
  const selected = new Map<string, string>();

  for (const signal of solution.signals) {
    const separator = signal.indexOf(":");
    const questionId = signal.slice(0, separator);
    const answer = signal.slice(separator + 1);
    // Uma pergunta single-select só pode receber uma resposta por cenário.
    if (!selected.has(questionId)) selected.set(questionId, answer);
  }

  return Object.fromEntries(
    [...selected].map(([questionId, value]) => [
      questionId,
      { value, status: "provided" as const, source: "e2e" as const }
    ])
  );
}

function expectedSolutions(answers: Record<string, { value: string }>): ProposalSolution[] {
  const selectedSignals = new Set(
    Object.entries(answers).map(([questionId, answer]) => `${questionId}:${answer.value}`)
  );

  return graph.solutions.filter(solution =>
    solution.signals.some(signal => selectedSignals.has(signal))
  );
}

async function submitChatText(page: Page, value: string): Promise<void> {
  await page.locator("#message").fill(value);
  await page.locator('#composer button[type="submit"]').click();
}

async function startAndConfirmBusinessMission(page: Page): Promise<void> {
  await page.goto("/chat");
  await page.getByRole("button", { name: "Sou empresário" }).click();
  await page.getByRole("button", { name: "Comércio" }).click();
  await page.getByRole("button", { name: "2–5 pessoas" }).click();

  await submitChatText(page, "Aumentar as vendas com mais controle da operação");
  await submitChatText(page, "Vendas, atendimento e acompanhamento de clientes");
  await submitChatText(page, "Falta de controle e visibilidade dos dados");
  await page.getByRole("button", { name: "Até 90 dias" }).click();
  await submitChatText(page, "Aumentar vendas e acompanhar a taxa de conversão");

  await expect(page.getByText(/resumo inicial da sua missão/i)).toBeVisible();

  const mission = await page.evaluate(async () => {
    const oq = await (window as any).OQReady;
    return oq.getMission();
  });

  expect(mission.status).toBe("review");
  expect(mission.answers.segment.value).toBe("retail");
  expect(mission.answers.teamSize.value).toBe("2_5");
  expect(mission.answers.desiredOutcome.value).toContain("Aumentar as vendas");
  expect(mission.answers.process.value).toContain("Vendas");
  expect(mission.answers.challenge.value).toContain("visibilidade");
  expect(mission.answers.deadline.value).toBe("90d");
  expect(mission.answers.successMetric.value).toContain("conversão");

  await page.getByRole("button", { name: /confirmar missão e aprofundar diagnóstico/i }).click();
  await page.getByRole("button", { name: /aprofundar diagnóstico/i }).click();
  await expect(page).toHaveURL(/\/descoberta\/?$/);
}

async function seedDiscoveryAnswers(
  page: Page,
  scenarioAnswers: Record<string, { value: string; status: "provided"; source: "e2e" }>
): Promise<void> {
  const handoff = await page.evaluate((payload) => {
    const key = "goaltropic.discovery.v1";
    const saved = JSON.parse(localStorage.getItem(key) || "null");
    if (!saved || saved.source !== "chat" || !saved.missionId) {
      throw new Error("CHAT_DISCOVERY_HANDOFF_MISSING");
    }

    const chatAnswers = { ...saved.answers };
    saved.answers = {
      ...saved.answers,
      company_name: { value: "Empresa E2E", status: "provided", source: "e2e" },
      ...payload
    };
    saved.index = 0;
    localStorage.setItem(key, JSON.stringify(saved));
    return { ...saved, chatAnswers };
  }, scenarioAnswers);

  expect(handoff.source).toBe("chat");
  expect(handoff.answers.segment.value).toBe("retail");
  expect(handoff.answers.team_size.value).toBe("2_5");
  expect(handoff.answers.main_goal.value).toBe("sales");
  expect(handoff.answers.goal_deadline.value).toBe("90d");
  expect(handoff.answers.goal_target.value).toContain("Aumentar as vendas");
  expect(handoff.answers.success_definition.value).toContain("conversão");
  expect(handoff.chatAnswers.operational_bottleneck.value).toBe("information");
  expect(handoff.chatAnswers.conversion_notes.value).toContain("visibilidade");
  expect(handoff.chatAnswers.primary_kpi.value).toBe("sales_count");
  expect(handoff.chatAnswers.target_value.value).toContain("conversão");
  expect(handoff.chatAnswers.sales_process.value).toContain("Vendas");
  expect(handoff.answers.company_name.value).toBe("Empresa E2E");
}

async function generateProposal(page: Page): Promise<void> {
  await page.reload();

  // A Discovery possui 19 etapas. As respostas do cenário já estão persistidas;
  // aqui pulamos somente as telas para chegar ao diagnóstico final.
  for (let stage = 0; stage < 18; stage += 1) {
    await page.getByRole("button", { name: /pular etapa/i }).click();
  }

  await page.getByRole("button", { name: /gerar diagnóstico/i }).click();
  await expect(page.locator(".solution").first()).toBeVisible();
}

for (const solution of graph.solutions) {
  test(`Chat → Discovery → Proposta: ${solution.id} — ${solution.name}`, async ({ page }) => {
    const scenarioAnswers = signalsFor(solution);
    const expected = expectedSolutions(scenarioAnswers);

    expect(expected.some(candidate => candidate.id === solution.id)).toBe(true);

    await startAndConfirmBusinessMission(page);
    await seedDiscoveryAnswers(page, scenarioAnswers);
    await generateProposal(page);

    const diagnosticNames = (await page.locator(".solution h3").allTextContents())
      .map(name => name.trim())
      .sort();
    expect(diagnosticNames).toEqual(expected.map(candidate => candidate.name).sort());

    await page.getByRole("button", { name: /montar proposta preliminar/i }).click();
    await expect(page).toHaveURL(/\/proposta\/?$/);
    await expect(page.getByText("Empresa E2E").first()).toBeVisible();

    for (const candidate of expected) {
      await expect(page.getByRole("heading", { name: candidate.name, exact: true })).toBeVisible();
    }

    const persisted = await page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem("goaltropic.discovery.v1") || "null");
      return {
        source: saved?.source,
        missionId: saved?.missionId,
        company: saved?.answers?.company_name?.value,
        answerKeys: Object.keys(saved?.answers || {})
      };
    });

    expect(persisted.source).toBe("chat");
    expect(persisted.missionId).toBeTruthy();
    expect(persisted.company).toBe("Empresa E2E");
    for (const questionId of Object.keys(scenarioAnswers)) {
      expect(persisted.answerKeys).toContain(questionId);
    }
  });
}

test("Chat sem evidência associável não inventa uma solução", async ({ page }) => {
  const unknownAnswers: Record<string, { value: string; status: "provided"; source: "e2e" }> = {};
  for (const solution of graph.solutions) {
    for (const signal of solution.signals) {
      const separator = signal.indexOf(":");
      const questionId = signal.slice(0, separator);
      unknownAnswers[questionId] = {
        value: "unknown",
        status: "provided",
        source: "e2e"
      };
    }
  }

  unknownAnswers.operational_bottleneck = { value: "unknown", status: "provided", source: "e2e" };
  await startAndConfirmBusinessMission(page);
  await seedDiscoveryAnswers(page, unknownAnswers);
  await page.reload();

  for (let stage = 0; stage < 18; stage += 1) {
    await page.getByRole("button", { name: /pular etapa/i }).click();
  }

  await page.getByRole("button", { name: /gerar diagnóstico/i }).click();
  await expect(page.getByText(/ainda não há combinações suficientes para sugerir soluções/i)).toBeVisible();
  await expect(page.locator(".solution")).toHaveCount(0);
});
