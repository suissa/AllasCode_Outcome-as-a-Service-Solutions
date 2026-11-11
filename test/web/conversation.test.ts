import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

const source = readFileSync(new URL("../../app.tsx", import.meta.url), "utf8");
async function harness(initial: Record<string, string> = {}) {
  const values = new Map<string, string>(Object.entries(initial));
  const localStorage = {
    getItem: (key: string) => values.has(key) ? values.get(key)! : null,
    setItem: (key: string, value: string) => values.set(key, String(value)),
    removeItem: (key: string) => values.delete(key)
  };
  const window: { OQ?: any; OQReady?: Promise<any> } = {};
  const missionSteps = JSON.parse(readFileSync(new URL("../../content/mission-steps.pt-BR.json", import.meta.url), "utf8"));
  const fetch = async () => ({ ok: true, json: async () => missionSteps });
  runInNewContext(source, { window, localStorage, console, Date, JSON, Object, Array, String, Number, Math, Set, fetch });
  await window.OQReady;
  return { OQ: window.OQ as any, values };
}

test("migrates previous browser state without dropping conversation history", async () => {
  const previous = { version: 1, mode: "guilda", events: [], conversations: { guilda: [{ role: "user", text: "Minha missão" }] } };
  const { OQ } = await harness({ "oaas.quest.v1": JSON.stringify(previous) });
  assert.equal(OQ.getState().version, 2);
  assert.equal(OQ.history("chat").length, 1);
  assert.equal(OQ.history("chat")[0].text, "Minha missão");
});

test("collects the guided mission progressively and reaches review", async () => {
  const { OQ } = await harness();
  OQ.startMission("business");
  const fields = [];
  while (OQ.currentMissionStep()) {
    const step = OQ.currentMissionStep();
    fields.push(step.id);
    OQ.advanceMission(step.freeText ? "Resposta de teste" : step.options[0].value);
  }
  assert.deepEqual(JSON.parse(JSON.stringify(fields)), ["segment", "teamSize", "desiredOutcome", "process", "challenge", "deadline", "successMetric"]);
  assert.equal(OQ.getMission().status, "review");
  assert.equal(OQ.getMission().stepIndex, 7);
});

test("keeps unknown answers explicit and allows reviewing the mission", async () => {
  const { OQ } = await harness();
  OQ.startMission();
  OQ.advanceMission(null, true);
  assert.equal(OQ.getMission().answers.segment.value, null);
  assert.equal(OQ.getMission().answers.segment.status, "unknown");
  OQ.reviseMission();
  assert.equal(OQ.currentMissionStep().id, "segment");
});

test("confirmed mission pre-fills discovery without overwriting existing answers", async () => {
  const existing = { index: 3, answers: { segment: { value: "health", status: "provided" }, monthly_revenue: { value: 5000, status: "provided" } } };
  const { OQ, values } = await harness({ "goaltropic.discovery.v1": JSON.stringify(existing) });
  OQ.startMission();
  for (const answer of ["retail", "2_5", "Aumentar vendas", "Vendas pelo WhatsApp", "Poucos clientes retornam", "90d", "Conversão de 10% para 15%"]) OQ.advanceMission(answer);
  OQ.confirmMission();
  const result = OQ.prepareDiscovery();
  const saved = JSON.parse(values.get("goaltropic.discovery.v1")!);
  assert.equal(result.prefilled >= 8, true);
  assert.equal(saved.answers.segment.value, "health");
  assert.equal(saved.answers.monthly_revenue.value, 5000);
  assert.equal(saved.answers.team_size.value, "2_5");
  assert.equal(saved.answers.goal_target.value, "Aumentar vendas");
  assert.equal(saved.answers.primary_kpi.value, "conversion");
  assert.equal(saved.source, "chat");
  assert.equal(OQ.getMission().status, "ready_for_discovery");
});

test("refuses handoff before explicit mission confirmation", async () => {
  const { OQ } = await harness();
  OQ.startMission();
  assert.throws(() => OQ.prepareDiscovery(), /MISSION_NOT_CONFIRMED/);
});
