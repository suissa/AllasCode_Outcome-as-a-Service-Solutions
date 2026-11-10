/**
 * Estado local do OaaS.Quest.
 *
 * O estado vive em localStorage: modo aberto, eventos, conversas por
 * experiencia e a missao em andamento. As chaves legadas (guilda, classico)
 * sao migradas na leitura, para que o historico anterior nao se perca.
 */

async function loadMissionSteps() {
  const runtime = window.OaaSPageReady ? await window.OaaSPageReady : null;
  const steps = runtime && (runtime.sources["mission-steps"] || (runtime.content && runtime.content["mission-steps"]));
  if (steps) return steps;
  const response = await fetch("/content/mission-steps.pt-BR.json");
  if (!response.ok) throw new Error("MISSION_STEPS_UNAVAILABLE");
  return response.json();
}

window.OQReady = (async function () {
  const STEPS = await loadMissionSteps();
  const KEY = "oaas.quest.v1";
  const DISCOVERY_KEY = "goaltropic.discovery.v1";

  const empty = () => ({ version: 2, mode: null, events: [], conversations: { chat: [], site: [] }, mission: null });

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY) || "null");
      if (!raw || typeof raw !== "object") return empty();
      const conversations = raw.conversations || {};
      return {
        ...empty(),
        ...raw,
        version: 2,
        events: Array.isArray(raw.events) ? raw.events : [],
        conversations: {
          chat: conversations.chat || conversations.guilda || [],
          site: conversations.site || conversations.classico || []
        }
      };
    } catch {
      return empty();
    }
  }

  let state = read();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Não foi possível salvar o histórico local", e);
    }
  }

  function event(type, detail = {}) {
    state.events.push({ type, detail, at: new Date().toISOString() });
    if (state.events.length > 500) state.events = state.events.slice(-500);
    save();
  }

  function setMode(mode, type = "mode-changed") {
    state.mode = mode;
    event(type, { mode });
  }

  function logMessage(mode, role, text) {
    state.conversations[mode] ??= [];
    state.conversations[mode].push({ role, text, at: new Date().toISOString() });
    if (state.conversations[mode].length > 200) state.conversations[mode] = state.conversations[mode].slice(-200);
    event("message-recorded", { mode, role, length: String(text).length });
  }

  function logInteraction(mode, action, detail = {}) {
    event("interaction", { mode, action, ...detail });
  }

  function history(mode) {
    return state.conversations[mode] || [];
  }

  function getMission() {
    return state.mission ? JSON.parse(JSON.stringify(state.mission)) : null;
  }

  function startMission(audience = "business") {
    if (audience !== "business") throw new Error("MISSION_AUDIENCE_UNSUPPORTED");
    state.mission = {
      id: "mission_" + Date.now().toString(36),
      audience,
      status: "collecting",
      stepIndex: 0,
      answers: {},
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    event("mission-started", { missionId: state.mission.id, audience });
    return getMission();
  }

  function currentMissionStep() {
    const m = state.mission;
    if (!m || m.status !== "collecting") return null;
    const step = STEPS[m.stepIndex];
    return step ? { ...step, options: step.options?.map(x => ({ ...x })) } : null;
  }

  function advanceMission(value, skipped = false) {
    const m = state.mission;
    const step = currentMissionStep();
    if (!m || !step) throw new Error("MISSION_NOT_COLLECTING");
    if (!skipped && (typeof value !== "string" || !value.trim())) throw new Error("MISSION_ANSWER_REQUIRED");
    m.answers[step.id] = {
      value: skipped ? null : value.trim(),
      status: skipped ? "unknown" : "provided",
      updatedAt: new Date().toISOString()
    };
    m.stepIndex++;
    m.updatedAt = new Date().toISOString();
    if (m.stepIndex >= STEPS.length) m.status = "review";
    event("mission-answer-recorded", { missionId: m.id, field: step.id, status: skipped ? "unknown" : "provided" });
    save();
    return getMission();
  }

  function reviseMission() {
    const m = state.mission;
    if (!m) throw new Error("MISSION_NOT_FOUND");
    m.status = "collecting";
    m.stepIndex = 0;
    m.updatedAt = new Date().toISOString();
    event("mission-review-started", { missionId: m.id });
    save();
    return getMission();
  }

  function confirmMission() {
    const m = state.mission;
    if (!m || m.status !== "review") throw new Error("MISSION_NOT_READY_FOR_CONFIRMATION");
    m.status = "ready_for_discovery";
    m.confirmedAt = new Date().toISOString();
    m.updatedAt = m.confirmedAt;
    event("mission-confirmed", { missionId: m.id });
    save();
    return getMission();
  }

  function inferGoal(text) {
    const v = String(text || "").toLowerCase();
    if (/venda|receita|fatur|comercial/.test(v)) return "sales";
    if (/lucro|margem|rentab/.test(v)) return "profit";
    if (/custo|despesa|gasto/.test(v)) return "cost";
    if (/produtiv|tempo|retrabalho|processo/.test(v)) return "productivity";
    if (/atend|suporte|resposta/.test(v)) return "service";
    if (/autom/.test(v)) return "automation";
    if (/expan|crescer|crescimento|filial/.test(v)) return "expansion";
    if (/reten|recorr|fidel/.test(v)) return "retention";
    return "other";
  }

  function inferBottleneck(text) {
    const v = String(text || "").toLowerCase();
    if (/atend|cliente|resposta/.test(v)) return "service";
    if (/sobrecarg|volume|equipe|pessoa/.test(v)) return "overload";
    if (/process|manual|retrabalho/.test(v)) return "process";
    if (/dado|informa|visibilidade|controle/.test(v)) return "information";
    if (/funcion|colaborador|contrata/.test(v)) return "people";
    return "other";
  }

  function inferMetric(text) {
    const v = String(text || "").toLowerCase();
    if (/fatur|receita/.test(v)) return "revenue";
    if (/lucro|margem/.test(v)) return "profit";
    if (/venda|pedidos/.test(v)) return "sales_count";
    if (/ticket/.test(v)) return "ticket";
    if (/convers/.test(v)) return "conversion";
    if (/reten|recorr|fidel/.test(v)) return "retention";
    if (/custo|despesa/.test(v)) return "cost";
    if (/produtiv|tempo/.test(v)) return "productivity";
    if (/satisfa/.test(v)) return "satisfaction";
    return "other";
  }

  function prepareDiscovery() {
    const m = state.mission;
    if (!m || m.status !== "ready_for_discovery") throw new Error("MISSION_NOT_CONFIRMED");

    let existing = {};
    try {
      existing = JSON.parse(localStorage.getItem(DISCOVERY_KEY) || "{}") || {};
    } catch {}

    const answers = { ...(existing.answers || {}) };
    const put = (id, value) => {
      if (value !== undefined && value !== null && value !== "" && answers[id] === undefined) {
        answers[id] = { value, status: "provided", updatedAt: new Date().toISOString(), source: "chat" };
      }
    };
    const get = id => m.answers[id]?.value;

    const segment = get("segment");
    const validSegments = ["retail", "services", "industry", "technology", "food", "health", "other"];
    put("segment", validSegments.includes(segment) ? segment : "other");
    put("team_size", get("teamSize") === "unknown" ? null : get("teamSize"));
    put("main_goal", inferGoal(get("desiredOutcome")));
    put("goal_target", get("desiredOutcome"));
    put("success_definition", get("successMetric"));
    put("goal_deadline", get("deadline"));
    put("operational_bottleneck", inferBottleneck(get("challenge")));
    put("conversion_notes", get("challenge"));
    put("primary_kpi", inferMetric(get("successMetric")));
    put("target_value", get("successMetric"));
    put("sales_process", get("process"));

    const handoff = {
      ...existing,
      index: 0,
      answers,
      updatedAt: new Date().toISOString(),
      source: "chat",
      missionId: m.id,
      missionSummary: { ...m }
    };
    localStorage.setItem(DISCOVERY_KEY, JSON.stringify(handoff));
    event("mission-handed-to-discovery", { missionId: m.id, prefilled: Object.keys(answers).length });
    return { key: DISCOVERY_KEY, prefilled: Object.keys(answers).length };
  }

  window.OQ = {
    state,
    getState: () => read(),
    setMode,
    logMessage,
    logInteraction,
    history,
    getMission,
    startMission,
    currentMissionStep,
    advanceMission,
    reviseMission,
    confirmMission,
    prepareDiscovery,
    missionSteps: () => STEPS.map(s => ({ ...s, options: s.options?.map(o => ({ ...o })) }))
  };
  return window.OQ;
})();
