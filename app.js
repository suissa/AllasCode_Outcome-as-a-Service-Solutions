/**
 * Estado local do OaaS.Quest.
 *
 * O estado tem duas sedes. O IndexedDB e a sede duravel: sobrevive ao fim do
 * navegador, ao fechamento da aba e a uma limpeza parcial do localStorage.
 * O localStorage continua como espelho de leitura rapida e como caminho
 * unico quando o IndexedDB nao existe. Na subida, vence o exemplar mais
 * recente dos dois; na descida, os dois recebem a mesma versao.
 *
 * O que mora aqui: modo aberto, eventos, conversas por experiencia (cada
 * mensagem carrega as opcoes e acoes que pertencem a ela), a missao em
 * andamento e as preferencias de interface. As chaves legadas (guilda,
 * classico) sao migradas na leitura, para que o historico anterior nao se
 * perca.
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

  const DB_NAME = "oaas-quest";
  const DB_VERSION = 1;
  const DB_STORE = "state";
  const DB_KEY = "v1";

  const emptyPrefs = () => ({ contextOpen: true, sidebarOpen: true });

  const empty = () => ({
    version: 2,
    mode: null,
    events: [],
    conversations: { chat: [], site: [] },
    mission: null,
    prefs: emptyPrefs(),
    updatedAt: null
  });

  /** Normaliza qualquer exemplar legado para o formato atual. */
  function normalize(raw) {
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
      },
      prefs: { ...emptyPrefs(), ...(raw.prefs || {}) }
    };
  }

  function read() {
    try {
      return normalize(JSON.parse(localStorage.getItem(KEY) || "null"));
    } catch {
      return empty();
    }
  }

  function stampOf(value) {
    const parsed = Date.parse(value || "");
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  /* ------------------------------------------------------------ sede duravel */

  let dbPromise = null;

  function hasIndexedDb() {
    return typeof indexedDB !== "undefined" && indexedDB !== null;
  }

  function openDatabase() {
    if (dbPromise) return dbPromise;
    if (!hasIndexedDb()) return Promise.reject(new Error("IDB_UNAVAILABLE"));
    dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || new Error("IDB_OPEN_FAILED"));
    }).catch(error => {
      dbPromise = null;
      throw error;
    });
    return dbPromise;
  }

  /** Le o ultimo estado gravado no IndexedDB, ou null se nao houver. */
  async function readDurable() {
    if (!hasIndexedDb()) return null;
    try {
      const db = await openDatabase();
      return await new Promise((resolve, reject) => {
        const request = db.transaction(DB_STORE, "readonly").objectStore(DB_STORE).get(DB_KEY);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => reject(request.error);
      });
    } catch {
      return null;
    }
  }

  /** Grava o estado no IndexedDB. Nunca lanca: a falha nao pode travar a pagina. */
  async function writeDurable(snapshot) {
    if (!hasIndexedDb()) return false;
    try {
      const db = await openDatabase();
      await new Promise((resolve, reject) => {
        const tx = db.transaction(DB_STORE, "readwrite");
        tx.objectStore(DB_STORE).put(snapshot, DB_KEY);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
      });
      return true;
    } catch (error) {
      console.warn("Não foi possível salvar o histórico durável", error);
      return false;
    }
  }

  let state = read();

  /* Na subida, o exemplar mais recente vence: o IndexedDB guarda o que a
     ultima sessao gravou, mesmo quando o localStorage foi limpo no meio. */
  const durable = await readDurable();
  if (durable && durable.state) {
    const candidate = normalize(durable.state);
    if (stampOf(candidate.updatedAt) > stampOf(state.updatedAt)) {
      state = candidate;
      try {
        localStorage.setItem(KEY, JSON.stringify(state));
      } catch (error) {
        console.warn("Não foi possível espelhar o histórico local", error);
      }
    }
  }

  let durableTimer = null;

  function scheduleDurable() {
    if (typeof setTimeout !== "function") {
      writeDurable({ updatedAt: state.updatedAt, state });
      return;
    }
    if (durableTimer) return;
    durableTimer = setTimeout(() => {
      durableTimer = null;
      writeDurable({ updatedAt: state.updatedAt, state });
    }, 120);
  }

  function flushDurable() {
    if (durableTimer && typeof clearTimeout === "function") {
      clearTimeout(durableTimer);
      durableTimer = null;
    }
    return writeDurable({ updatedAt: state.updatedAt, state });
  }

  if (typeof window.addEventListener === "function") {
    window.addEventListener("pagehide", flushDurable);
    window.addEventListener("beforeunload", flushDurable);
  }

  function save() {
    state.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      console.warn("Não foi possível salvar o histórico local", e);
    }
    scheduleDurable();
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

  /**
   * Registra uma mensagem da conversa. As opcoes e acoes que pertencem a
   * mensagem viajam junto: e o que faz os botoes voltarem apos um recarregamento.
   */
  function logMessage(mode, role, text, extra) {
    state.conversations[mode] ??= [];
    const record = { role, text, at: new Date().toISOString() };
    const choices = Array.isArray(extra && extra.choices) ? extra.choices : [];
    const actions = Array.isArray(extra && extra.actions) ? extra.actions : [];
    if (choices.length) record.choices = choices;
    if (actions.length) record.actions = actions;
    state.conversations[mode].push(record);
    if (state.conversations[mode].length > 200) state.conversations[mode] = state.conversations[mode].slice(-200);
    event("message-recorded", { mode, role, length: String(text).length });
  }

  function logInteraction(mode, action, detail = {}) {
    event("interaction", { mode, action, ...detail });
  }

  function history(mode) {
    return state.conversations[mode] || [];
  }

  /** Esvazia a conversa de uma experiencia, sem tocar na missao. */
  function clearConversation(mode) {
    state.conversations[mode] = [];
    event("conversation-cleared", { mode });
  }

  /** Descarta a missao em andamento. */
  function clearMission() {
    state.mission = null;
    event("mission-cleared", {});
  }

  function getPrefs() {
    return { ...emptyPrefs(), ...(state.prefs || {}) };
  }

  /** Guarda uma preferencia de interface (painel aberto, coluna recolhida). */
  function setPrefs(patch) {
    state.prefs = { ...getPrefs(), ...(patch || {}) };
    event("prefs-updated", { prefs: state.prefs });
    return getPrefs();
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
    // A copia duravel permite retomar a descoberta mesmo sem localStorage.
    state.handoff = handoff;
    event("mission-handed-to-discovery", { missionId: m.id, prefilled: Object.keys(answers).length });
    return { key: DISCOVERY_KEY, prefilled: Object.keys(answers).length };
  }

  window.OQ = {
    state,
    getState: () => normalize(state),
    setMode,
    logMessage,
    logInteraction,
    history,
    clearConversation,
    clearMission,
    getPrefs,
    setPrefs,
    getMission,
    startMission,
    currentMissionStep,
    advanceMission,
    reviseMission,
    confirmMission,
    prepareDiscovery,
    flushDurable,
    missionSteps: () => STEPS.map(s => ({ ...s, options: s.options?.map(o => ({ ...o })) }))
  };
  return window.OQ;
})();
