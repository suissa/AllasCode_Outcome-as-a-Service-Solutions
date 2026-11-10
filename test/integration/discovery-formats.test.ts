import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const read = (path: string) => readFileSync(new URL("../../" + path, import.meta.url), "utf8");
const discovery = JSON.parse(read("content/discovery.pt-BR.json"));
const graph = JSON.parse(read("content/proposal-graph.pt-BR.json"));
const retailAnswers = JSON.parse(read("test/fixtures/retail-discovery.json"));
const appSource = read("app.js");
const inferenceSource = read("runtime/proposal-inference.js");

async function guildHarness() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key)
  };
  const window: Record<string, any> = {};
  const fetch = async () => ({ ok: true, json: async () => JSON.parse(read("content/mission-steps.pt-BR.json")) });
  runInNewContext(appSource, { window, localStorage, fetch, console, Date, JSON, Object, Array, String, Number, Math, Set });
  await window.OQReady;
  return { OQ: window.OQ, values, window };
}

function loadInference(window: Record<string, any>) {
  runInNewContext(inferenceSource, { window, Date, JSON, Object, Array, String, Number, Math, Set });
  return window.OaaSProposalInference;
}

const missionAnswers = [
  "retail",
  "6_15",
  "Aumentar vendas e margem sem ampliar a equipe",
  "Vendas presenciais e digitais, atendimento por WhatsApp e controle de estoque",
  "Equipe sobrecarregada, contatos sem retorno e falta de visibilidade do estoque",
  "90d",
  "Elevar conversão de 2,4% para 3,5% e melhorar margem por pedido"
];

test("integration: Guilda mission hands retail answers into Discovery without losing or overwriting data", async () => {
  const { OQ, values } = await guildHarness();
  OQ.startMission("business");
  for (const answer of missionAnswers) OQ.advanceMission(answer);
  assert.equal(OQ.getMission().status, "review");
  OQ.confirmMission();
  assert.equal(OQ.getMission().status, "ready_for_discovery");

  const handoff = OQ.prepareDiscovery();
  const saved = JSON.parse(values.get("goaltropic.discovery.v1")!);
  assert.equal(saved.source, "guilda");
  assert.equal(saved.missionId, OQ.getMission().id);
  assert.ok(handoff.prefilled >= 8);
  assert.equal(saved.answers.segment.value, "retail");
  assert.equal(saved.answers.team_size.value, "6_15");
  assert.equal(saved.answers.main_goal.value, "sales");
  assert.equal(saved.answers.operational_bottleneck.value, "overload");
  assert.equal(saved.answers.primary_kpi.value, "conversion");
  assert.equal(saved.answers.goal_target.value, retailAnswers.goal_target);
});

test("integration: both interaction formats produce the same retail proposal from equivalent answers", async () => {
  const { OQ, values, window } = await guildHarness();
  OQ.startMission("business");
  for (const answer of missionAnswers) OQ.advanceMission(answer);
  OQ.confirmMission();
  OQ.prepareDiscovery();

  const handoff = JSON.parse(values.get("goaltropic.discovery.v1")!);
  const guildAnswers = { ...retailAnswers, ...handoff.answers };
  const inference = loadInference(window);
  const guildProposal = inference.buildProposal({ graph, discovery, answers: guildAnswers, createdAt: "2026-11-10T12:00:00.000Z" });
  const classicProposal = inference.buildProposal({ graph, discovery, answers: retailAnswers, createdAt: "2026-11-10T12:00:00.000Z" });

  const guildIds = guildProposal.scope.opportunities.map((item: any) => item.id).sort();
  const classicIds = classicProposal.scope.opportunities.map((item: any) => item.id).sort();
  assert.deepEqual(guildIds, classicIds);
  assert.equal(guildProposal.profile.companyName, "Mercado Aurora");
  assert.equal(guildProposal.profile.segment, "retail");
  assert.ok(guildIds.includes("SOL-SALES-001"));
  assert.ok(guildIds.includes("SOL-SALES-002"));
  assert.ok(guildIds.includes("SOL-STOCK-001"));
  assert.ok(guildIds.includes("SOL-STOCK-002"));
  assert.ok(guildIds.includes("SOL-CRM-002"));
  assert.equal(guildProposal.stage, "pre-data-analysis");
  assert.equal(guildProposal.governance.status, "preliminary-hypothesis");
  assert.equal(guildProposal.governance.dataAnalysisPerformed, false);
  assert.equal(guildProposal.governance.externalDataUsed, false);
  assert.ok(guildProposal.context.unknowns.some((item: any) => item.questionId === "margin_type"));
});

test("integration: skipped Guilda answers remain explicit unknowns and do not become negative evidence", async () => {
  const { OQ, values, window } = await guildHarness();
  OQ.startMission("business");
  OQ.advanceMission("retail");
  OQ.advanceMission("6_15");
  OQ.advanceMission(null, true);
  for (const answer of missionAnswers.slice(3)) OQ.advanceMission(answer);
  OQ.confirmMission();
  OQ.prepareDiscovery();

  const saved = JSON.parse(values.get("goaltropic.discovery.v1")!);
  assert.equal(saved.answers.segment.value, "retail");
  assert.equal(saved.answers.goal_target, undefined);
  const proposal = loadInference(window).buildProposal({
    graph,
    discovery,
    answers: saved.answers,
    createdAt: "2026-11-10T12:00:00.000Z"
  });
  assert.ok(proposal.context.unknowns.some((item: any) => item.questionId === "goal_target"));
  assert.equal(proposal.governance.dataAnalysisPerformed, false);
});
