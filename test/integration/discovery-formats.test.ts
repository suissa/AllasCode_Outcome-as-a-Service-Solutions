import { readFile } from "node:fs/promises";
import { test } from "node:test";
import assert from "node:assert/strict";
import { Script, runInNewContext } from "node:vm";

const readJson = async (path: string) => JSON.parse(await readFile(path, "utf8"));
const discovery = await readJson("content/discovery.pt-BR.json");
const graph = await readJson("content/proposal-graph.pt-BR.json");
const missionSteps = await readJson("content/mission-steps.pt-BR.json");
const inferenceSource = await readFile("runtime/proposal-inference.tsx", "utf8");
const appSource = await readFile("app.tsx", "utf8");

function createInference() {
  const sandbox: { window: Record<string, any> } = { window: {} };
  new Script(inferenceSource);
  runInNewContext(inferenceSource, sandbox);
  return sandbox.window.OaaSProposalInference.buildProposal;
}

function createChatRuntime() {
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

test("Chat mission is transformed into Discovery's persisted answer contract", async () => {
  const runtime = createChatRuntime();
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
  assert.equal(saved.source, "chat");
  assert.ok(saved.missionId);
  assert.equal(saved.answers.segment.value, "retail");
  assert.equal(saved.answers.team_size.value, "2_5");
  assert.equal(saved.answers.main_goal.value, "sales");
  assert.equal(saved.answers.goal_deadline.value, "90d");
  assert.equal(saved.answers.sales_process.value, "Controle de estoque e reposição");
});

test("Chat handoff and Discovery infer equivalent retail facts", async () => {
  const runtime = createChatRuntime();
  const OQ = await runtime.ready;
  OQ.startMission("business");
  for (const answer of ["retail", "2_5", "Aumentar vendas", "Estoque", "Rupturas", "90d", "Reduzir rupturas"]) OQ.advanceMission(answer);
  OQ.confirmMission();
  OQ.prepareDiscovery();
  const chatSaved = JSON.parse(runtime.localStorage.getItem("goaltropic.discovery.v1")!);
  const discoveryAnswers = { ...retailAnswers, ...chatSaved.answers };
  const build = createInference();
  const sharedAnswers = { ...retailAnswers, ...chatSaved.answers };
  const chatProposal = build({ graph, discovery, answers: sharedAnswers, createdAt: "2026-11-10T00:00:00.000Z" });
  const discoveryProposal = build({ graph, discovery, answers: sharedAnswers, createdAt: "2026-11-10T00:00:00.000Z" });
  assert.equal(chatProposal.profile.segment, "retail");
  assert.equal(discoveryProposal.profile.segment, "retail");
  assert.ok(chatProposal.context.facts.some((fact: any) => fact.questionId === "segment" && fact.value === "retail"));
  assert.ok(discoveryProposal.context.facts.some((fact: any) => fact.questionId === "segment" && fact.value === "retail"));
  assert.deepEqual(chatProposal.scope.opportunities.map((item: any) => item.id), discoveryProposal.scope.opportunities.map((item: any) => item.id));
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

test("Guilda selects the first explicit KPI when a mission mentions multiple metrics", async () => {
  const runtime = createChatRuntime();
  const OQ = await runtime.ready;
  OQ.startMission("business");
  for (const answer of [
    "retail",
    "2_5",
    "Aumentar vendas e margem",
    "Controle de estoque",
    "Perdas de conversão e margem por pedido",
    "90d",
    "Elevar conversão de 2,4% para 3,5% e melhorar margem por pedido"
  ]) OQ.advanceMission(answer);
  const mission = OQ.getMission();
  assert.equal(mission.status, "review");
  OQ.confirmMission();
  OQ.prepareDiscovery();
  const saved = JSON.parse(runtime.localStorage.getItem("goaltropic.discovery.v1")!);
  assert.equal(saved.answers.primary_kpi.value, "conversion");
});

test("retail fixture produces preliminary commercial and stock opportunities", async () => {
  const fixture = await readJson("test/fixtures/retail-discovery.json");
  const answers = Object.fromEntries(
    Object.entries(fixture).map(([id, value]) => [id, { value }])
  );
  const proposal = createInference()({
    graph,
    discovery,
    answers,
    createdAt: "2026-11-10T12:00:00.000Z"
  });
  const opportunityIds = proposal.scope.opportunities.map((item: any) => item.id);
  assert.equal(proposal.profile.companyName, "Mercado Aurora");
  assert.equal(proposal.profile.segment, "retail");
  assert.ok(opportunityIds.includes("SOL-SALES-001"));
  assert.ok(opportunityIds.includes("SOL-STOCK-001"));
  assert.equal(proposal.governance.status, "preliminary-hypothesis");
  assert.equal(proposal.governance.dataAnalysisPerformed, false);
  assert.ok(proposal.context.unknowns.some((item: any) => item.questionId === "margin_type"));
});
