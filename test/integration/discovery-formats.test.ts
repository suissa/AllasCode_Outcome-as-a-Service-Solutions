import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Script, runInNewContext } from "node:vm";

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const discovery = await readJson("content/discovery.pt-BR.json");
const graph = await readJson("content/proposal-graph.pt-BR.json");
const missionSteps = await readJson("content/mission-steps.pt-BR.json");
const inferenceSource = await readFile("runtime/proposal-inference.js", "utf8");
const appSource = await readFile("app.js", "utf8");

function createInference() {
  const sandbox: { window: Record<string, any> } = { window: {} };
  new Script(inferenceSource);
  runInNewContext(inferenceSource, sandbox);
  return sandbox.window.OaaSProposalInference.buildProposal;
}

function createGuildaRuntime() {
  const values = new Map<string, string>();
  const localStorage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
    removeItem: (key: string) => values.delete(key)
  };
  const window: Record<string, any> = {
    OaaSPageReady: Promise.resolve({ sources: { "mission-steps": missionSteps } })
  };
  const sandbox = { window, localStorage, console, Date, Promise, JSON, String, Array, Object, Math };
  runInNewContext(appSource, sandbox);
  return { ready: window.OQReady as Promise<any>, localStorage };
}

const retailAnswers = {
  company_name: { value: "Mercado Exemplo" },
  segment: { value: "retail" },
  team_size: { value: "2_5" },
  main_goal: { value: "sales" },
  lead_registration: { value: "none" },
  abandonment_tracking: { value: "no" },
  stock_control: { value: "manual" },
  investment: { value: "limited" }
};

test("Guilda mission is transformed into Discovery's persisted answer contract", async () => {
  const runtime = createGuildaRuntime();
  const OQ = await runtime.ready;
  OQ.startMission("business");
  OQ.advanceMission("retail");
  OQ.advanceMission("2_5");
  OQ.advanceMission("Aumentar vendas");
  OQ.advanceMission("Controle de estoque e reposição");
  OQ.advanceMission("Ruptura de estoque e falta de visibilidade");
  OQ.advanceMission("90d");
  OQ.advanceMission("Reduzir rupturas e aumentar vendas");
  OQ.confirmMission();
  const handoff = OQ.prepareDiscovery();
  const saved = JSON.parse(runtime.localStorage.getItem("goaltropic.discovery.v1")!);
  assert.equal(handoff.prefilled, 11);
  assert.equal(saved.source, "guilda");
  assert.ok(saved.missionId);
  assert.equal(saved.answers.segment.value, "retail");
  assert.equal(saved.answers.team_size.value, "2_5");
  assert.equal(saved.answers.main_goal.value, "sales");
  assert.equal(saved.answers.goal_deadline.value, "90d");
  assert.equal(saved.answers.sales_process.value, "Controle de estoque e reposição");
});

test("Guilda handoff and classic Discovery infer equivalent retail facts", async () => {
  const runtime = createGuildaRuntime();
  const OQ = await runtime.ready;
  OQ.startMission("business");
  for (const answer of ["retail", "2_5", "Aumentar vendas", "Estoque", "Rupturas", "90d", "Reduzir rupturas"]) OQ.advanceMission(answer);
  OQ.confirmMission();
  OQ.prepareDiscovery();
  const guildaSaved = JSON.parse(runtime.localStorage.getItem("goaltropic.discovery.v1")!);
  const classicAnswers = { ...retailAnswers, ...guildaSaved.answers };
  const build = createInference();
  const sharedAnswers = { ...retailAnswers, ...guildaSaved.answers };
  const guildaProposal = build({ graph, discovery, answers: sharedAnswers, createdAt: "2026-11-10T00:00:00.000Z" });
  const classicProposal = build({ graph, discovery, answers: sharedAnswers, createdAt: "2026-11-10T00:00:00.000Z" });
  assert.equal(guildaProposal.profile.segment, "retail");
  assert.equal(classicProposal.profile.segment, "retail");
  assert.ok(guildaProposal.context.facts.some((fact: any) => fact.questionId === "segment" && fact.value === "retail"));
  assert.ok(classicProposal.context.facts.some((fact: any) => fact.questionId === "segment" && fact.value === "retail"));
  assert.deepEqual(guildaProposal.scope.opportunities.map((item: any) => item.id), classicProposal.scope.opportunities.map((item: any) => item.id));
});

test("unknown and unanswered retail data remain unknown, not negative evidence", () => {
  const build = createInference();
  const proposal = build({
    graph, discovery,
    answers: { segment: { value: "retail" }, lead_registration: { value: "unknown" }, abandonment_tracking: { value: null } }
  });
  assert.ok(proposal.context.unknowns.some((item: any) => item.questionId === "lead_registration"));
  assert.ok(proposal.context.unknowns.some((item: any) => item.questionId === "abandonment_tracking"));
  assert.ok(!proposal.graphTrace.edgesTraversed.some((edge: any) => edge.questionId === "lead_registration" && edge.kind === "solution-association"));
});
