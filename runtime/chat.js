/**
 * Comportamento do Chat de missao (OaaS.Quest).
 *
 * Exporta mount(page): o shell chama a cada render, entao a navegacao
 * client-side reexecuta o runtime sem reimportar o modulo e sem duplicar
 * listeners — o template e reescrito a cada render.
 *
 * Uma classe semantica por elemento; variante e atributo (data-role,
 * data-variant). Os icones sao SVG inline, nunca glifos Unicode.
 */

const AVATAR_MASTER =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="8"></circle><circle cx="12" cy="12" r="2.6"></circle></svg>';

const AVATAR_USER =
  '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.5"></circle><path d="M5 19.5a7 7 0 0 1 14 0"></path></svg>';

const esc = value =>
  String(value == null ? "" : value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));

export async function mount(page) {
  const OQ = await window.OQReady;
  if (!OQ) return;

  const copy = page.sources["ui-copy"].chat;

  if (OQ.getState().mode !== "chat") OQ.setMode("chat", "mode-opened");

  const chat = document.getElementById("chat");
  const form = document.getElementById("composer");
  const input = document.getElementById("message");
  const controls = document.getElementById("mission-controls");
  const audienceChoices = document.getElementById("audience-choices");
  const goal = document.getElementById("goal");
  const progressBar = document.querySelector(".chat-progress-bar");
  if (!chat || !form || !input || !controls) return;

  function updateCount() {
    const counter = document.getElementById("count");
    if (counter) counter.textContent = OQ.history("chat").length + copy.countSuffix;
  }

  function updateGoal() {
    if (!goal) return;
    const mission = OQ.getMission();
    const answer = mission?.answers?.desiredOutcome?.value;
    goal.textContent = answer || "Aguardando seu objetivo...";
    if (progressBar) {
      const answered = mission ? Object.keys(mission.answers).length : 0;
      const total = OQ.missionSteps().length || 1;
      progressBar.style.width = Math.min(100, Math.round((answered / total) * 100)) + "%";
    }
  }

  function makeMessage(role) {
    const row = document.createElement("article");
    row.className = "chat-message";
    row.setAttribute("data-role", role);
    const avatar = document.createElement("div");
    avatar.className = "chat-avatar";
    avatar.innerHTML = role === "user" ? AVATAR_USER : AVATAR_MASTER;
    return { row, avatar };
  }

  let lastAssistantTyping = Promise.resolve();

  function add(role, text) {
    const { row, avatar } = makeMessage(role);
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    row.append(avatar, bubble);
    chat.append(row);
    chat.scrollTop = chat.scrollHeight;
    OQ.logMessage("chat", role, text);
    updateCount();

    if (role !== "assistant") {
      bubble.textContent = text;
      return Promise.resolve();
    }

    const message = String(text);
    lastAssistantTyping = lastAssistantTyping.then(async () => {
      const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      if (reducedMotion || message.length < 2) {
        bubble.textContent = message;
        return;
      }
      for (let index = 0; index < message.length; index++) {
        bubble.textContent += message[index];
        chat.scrollTop = chat.scrollHeight;
        await new Promise(resolve => window.setTimeout(resolve, 14));
      }
    });
    return lastAssistantTyping;
  }

  async function typeWelcomeSequence() {
    const lead = chat.querySelector(".chat-bubble-brief .chat-bubble-lead");
    const question = chat.querySelectorAll(".chat-bubble-lead")[1];
    if (!lead || !question) return;
    const audience = document.getElementById("audience-choices");
    const welcomeText = lead.textContent.trim();
    const questionText = question.textContent.trim();
    if (audience) audience.hidden = true;

    const typeInto = async (element, value) => {
      element.textContent = "";
      if (window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches) {
        element.textContent = value;
        return;
      }
      for (const character of value) {
        element.textContent += character;
        chat.scrollTop = chat.scrollHeight;
        await new Promise(resolve => window.setTimeout(resolve, 14));
      }
    };

    await typeInto(lead, welcomeText);
    await typeInto(question, questionText);
    if (audience) audience.hidden = false;
  }

  function addLink(text, label, url) {
    const { row, avatar } = makeMessage("assistant");
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    const paragraph = document.createElement("p");
    paragraph.textContent = text;
    const link = document.createElement("a");
    link.className = "chat-action";
    link.setAttribute("data-variant", "link");
    link.href = url;
    link.textContent = label;
    bubble.append(paragraph, link);
    row.append(avatar, bubble);
    chat.append(row);
    chat.scrollTop = chat.scrollHeight;
  }

  function restore() {
    OQ.history("chat").forEach(message => {
      const { row, avatar } = makeMessage(message.role);
      const bubble = document.createElement("div");
      bubble.className = "chat-bubble";
      bubble.textContent = message.text;
      row.append(avatar, bubble);
      chat.append(row);
    });
    updateCount();
  }

  function optionLabel(step, value) {
    return step?.options?.find(option => option.value === value)?.label || value;
  }

  function clearControls() {
    controls.replaceChildren();
  }

  function renderStepControls(step) {
    clearControls();
    input.placeholder = step.options?.length
      ? "Selecione uma das opções acima..."
      : (step.placeholder || copy.answerPlaceholder);

    const render = () => {
      clearControls();
      if (step.options?.length) {
      const group = document.createElement("div");
      group.className = "chat-mission-grid";
      step.options.forEach(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-mission-option";
        button.textContent = option.label;
        button.addEventListener("click", () => submitAnswer(option.value, option.label, true));
        group.append(button);
      });
        controls.append(group);
      }
      const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "chat-mission-skip";
    skip.textContent = copy.skipQuestion;
    skip.addEventListener("click", () => {
      const previousStep = OQ.currentMissionStep();
      add("user", copy.unknownAnswer);
      OQ.advanceMission(null, true);
      pendingTurn = { message: copy.unknownAnswer, stepId: previousStep?.id || "unknown" };
      continueMission();
    });
      controls.append(skip);
    };

    // As opções só aparecem depois que a mensagem terminou de ser digitada.
    lastAssistantTyping.then(render);
  }


  let pendingTurn = null;
  let isResponding = false;

  /** Renderiza no Chat todas as perguntas do manifesto de Descoberta. */
  async function runChatDiscovery() {
    if (audienceChoices) audienceChoices.hidden = true;
    clearControls();
    input.value = "";
    const config = page.sources.discovery;
    const sectorPlaybooks = page.sources["sector-playbooks"]?.sectors || [];
    const sectorScripts = page.sources["sector-discovery"]?.scripts || {};
    if (!config || !Array.isArray(config.stages) || !Object.keys(sectorScripts).length) {
      await add("assistant", "Não consegui carregar os roteiros da descoberta. Tente novamente em instantes.");
      return;
    }
    const storageKey = config.engine?.storageKey || "goaltropic.discovery.v1";
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(storageKey) || "{}") || {}; } catch {}
    saved.answers ||= {};
    saved.source = "chat";
    const commonStages = (config.stages || []).filter(stage => ["stage_01", "stage_02"].includes(stage.id));
    const commonQuestions = commonStages.flatMap(stage =>
      (stage.questions || []).map(question => ({ ...question, stageId: stage.id, stageTitle: stage.title, stageDescription: stage.description }))
    );
    const segmentQuestion = commonQuestions.find(question => question.id === "segment");
    if (segmentQuestion) {
      segmentQuestion.options = sectorPlaybooks.map(sector => ({ value: sector.id, label: sector.name }));
    }
    let questions = commonQuestions.slice();
    let index = 0;
    let selected = new Set();
    const resolveSectorId = value => value === "food" ? "food-hospitality" : value === "technology" ? "ecommerce" : value;
    const configureSectorScript = value => {
      const sectorId = resolveSectorId(value);
      const script = sectorScripts[sectorId];
      if (!script) return false;
      if (saved.sectorScriptId === sectorId && questions.some(question => question.sectorSpecific)) return true;
      const previousSectorId = saved.sectorScriptId;
      if (previousSectorId && previousSectorId !== sectorId) {
        Object.keys(saved.answers).filter(key => key.startsWith(previousSectorId + "_")).forEach(key => delete saved.answers[key]);
        saved.chatCompleted = false;
        saved.chatIndex = 0;
      }
      const sector = sectorPlaybooks.find(item => item.id === sectorId);
      const sectorQuestions = (script.stages || []).flatMap((stage, stageIndex) =>
        (stage.questions || []).map(question => ({
          ...question,
          sectorSpecific: true,
          stageId: sectorId + ":" + stage.id,
          stageTitle: stage.title,
          stageDescription: stage.description + (stageIndex === 0 ? " " + (script.intro || "") : "")
        }))
      );
      questions = [...commonQuestions, ...sectorQuestions];
      saved.sectorId = sectorId;
      saved.sectorScriptId = sectorId;
      saved.sectorName = sector?.name || sectorId;
      saved.sectorScriptIntro = script.intro || "";
      return true;
    };
    const existingSector = saved.answers.segment?.value || saved.sectorId;
    if (existingSector) {
      if (!saved.sectorScriptId) {
        saved.chatIndex = 0;
        saved.chatCompleted = false;
      }
      configureSectorScript(existingSector);
      index = Math.max(0, Number(saved.chatIndex) || 0);
    } else {
      // Migra sessões antigas do roteiro genérico para o roteiro setorial.
      saved.chatIndex = 0;
      saved.chatCompleted = false;
    }
    const persist = () => {
      saved.chatIndex = index;
      saved.updatedAt = new Date().toISOString();
      localStorage.setItem(storageKey, JSON.stringify(saved));
    };
    const answerExists = question => {
      const answer = saved.answers[question.id];
      return answer && (answer.status === "provided" || answer.status === "unknown");
    };
    const updateProgress = () => {
      const answered = Object.values(saved.answers).filter(answer => answer && answer.status).length;
      if (progressBar) progressBar.style.width = Math.min(100, Math.round(answered / Math.max(1, questions.length) * 100)) + "%";
      const count = document.getElementById("progress-count");
      if (count) count.textContent = answered + " de " + questions.length + " perguntas registradas";
      if (goal) goal.textContent = saved.answers.goal_target?.value || saved.answers.main_goal?.value || "Descoberta em andamento";
    };
    const storeAnswer = async (question, value, label, status = "provided") => {
      add("user", label);
      saved.answers[question.id] = { value: status === "unknown" ? null : value, status, updatedAt: new Date().toISOString(), source: "chat" };
      if (question.id === "segment" && status === "provided") configureSectorScript(value);
      index++;
      persist();
      updateProgress();
      await askNext();
    };
    const addOptionButton = (question, option, group, multi = false) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "chat-mission-option";
      button.textContent = option.label;
      button.setAttribute("aria-pressed", "false");
      button.addEventListener("click", () => {
        if (multi) {
          if (selected.has(option.value)) selected.delete(option.value);
          else selected.add(option.value);
          button.setAttribute("aria-pressed", selected.has(option.value) ? "true" : "false");
          button.dataset.selected = selected.has(option.value) ? "true" : "false";
          return;
        }
        clearControls();
        storeAnswer(question, option.value, option.label);
      });
      group.append(button);
    };
    const renderQuestionControls = async question => {
      clearControls();
      selected = new Set();
      const type = question.type || "text";
      if (type === "single" || type === "multi") {
        input.disabled = true;
        input.placeholder = "Selecione uma das opções apresentadas...";
        const group = document.createElement("div");
        group.className = "chat-mission-grid";
        (question.options || []).forEach(option => addOptionButton(question, option, group, type === "multi"));
        controls.append(group);
        if (type === "multi") {
          const confirm = document.createElement("button");
          confirm.type = "button";
          confirm.className = "chat-action";
          confirm.textContent = "Confirmar seleção";
          confirm.addEventListener("click", () => {
            if (!selected.size) {
              add("assistant", "Selecione pelo menos uma opção ou escolha não informar.");
              return;
            }
            const values = [...selected];
            const labels = (question.options || []).filter(option => selected.has(option.value)).map(option => option.label);
            clearControls();
            storeAnswer(question, values, labels.join(", "));
          });
          controls.append(confirm);
        }
      } else {
        input.disabled = false;
        input.placeholder = type === "number" ? "Informe um valor ou use Não sei informar..." : "Digite sua resposta...";
        input.focus();
      }
      const actions = document.createElement("div");
      actions.className = "chat-mission-grid";
      const unknown = document.createElement("button");
      unknown.type = "button";
      unknown.className = "chat-mission-skip";
      unknown.textContent = "Não sei informar";
      unknown.addEventListener("click", () => {
        clearControls();
        storeAnswer(question, null, "Não sei informar", "unknown");
      });
      const skip = document.createElement("button");
      skip.type = "button";
      skip.className = "chat-mission-skip";
      skip.textContent = "Pular pergunta";
      skip.addEventListener("click", () => {
        clearControls();
        storeAnswer(question, null, "Pular pergunta", "unknown");
      });
      actions.append(unknown, skip);
      controls.append(actions);
    };
    const renderDiagnostic = async () => {
      saved.chatCompleted = true;
      saved.chatCompletedAt = new Date().toISOString();
      persist();
      updateProgress();
      const sector = sectorPlaybooks.find(item => item.id === saved.sectorId);
      const sectorScript = sectorScripts[saved.sectorId];
      const sectorAnswers = questions.filter(question => question.sectorSpecific && saved.answers[question.id]?.status === "provided");
      const list = values => (values || []).map(value => "• " + value).join("\n");
      const resultText = sector && sectorScript
        ? "Roteiro aplicado: " + sector.name + ".\n\n" +
          sectorScript.intro + "\n\n" +
          "Problemas que serão investigados:\n" + list(sector.problems) + "\n\n" +
          "Soluções que poderão ser avaliadas:\n" + list(sector.solutions) + "\n\n" +
          "Indicadores relevantes:\n" + list(sector.metrics) + "\n\n" +
          "Evidências a validar:\n" + list(sector.evidence) + "\n\n" +
          "Controles e restrições:\n" + list(sector.guardrails)
        : "As respostas foram registradas. A análise deverá esclarecer os pontos em aberto.";
      await add("assistant", "Você concluiu a descoberta setorial de " + (sector?.name || "sua empresa") + ". " + Object.keys(saved.answers).length + " campos foram registrados, incluindo " + sectorAnswers.length + " respostas específicas do setor.\n\n" + resultText + "\n\nAs frentes listadas são hipóteses de investigação, não recomendações confirmadas. A próxima etapa valida as informações, as evidências e os critérios de sucesso.");
      clearControls();
      const restart = document.createElement("button");
      restart.type = "button";
      restart.className = "chat-action";
      restart.textContent = "Reiniciar descoberta";
      restart.addEventListener("click", () => {
        saved.chatIndex = 0;
        saved.chatCompleted = false;
        saved.answers = {};
        index = 0;
        persist();
        askNext();
      });
      controls.append(restart);
      OQ.logInteraction("chat", "discovery-completed", { answered: Object.keys(saved.answers).length, sector: saved.sectorId, sectorAnswers: sectorAnswers.length });
    };
    const askNext = async () => {
      while (index < questions.length && answerExists(questions[index])) index++;
      persist();
      if (index >= questions.length) {
        await renderDiagnostic();
        return;
      }
      const question = questions[index];
      const intro = question.stageId !== saved.lastChatStage
        ? question.stageTitle + " — " + question.stageDescription + "\n\n"
        : "";
      saved.lastChatStage = question.stageId;
      persist();
      await add("assistant", intro + question.label);
      await renderQuestionControls(question);
      updateProgress();
    };
    restore();
    updateProgress();
    if (saved.chatCompleted) {
      index = questions.length;
      await renderDiagnostic();
      return;
    }
    form.addEventListener("submit", event => {
      event.preventDefault();
      const question = questions[index];
      if (!question || input.disabled) {
        add("assistant", "Para responder, use os botões de opção apresentados na conversa.");
        input.value = "";
        return;
      }
      const value = input.value.trim();
      if (!value) return;
      input.value = "";
      storeAnswer(question, value, value);
    });
    await add("assistant", "Vamos começar pela identificação da empresa e do segmento. Depois disso, vou conduzir um roteiro próprio para sua área de atuação, com perguntas sobre operação, indicadores, sistemas, evidências e restrições.");
    await askNext();
  }

  async function requestAssistantTurn(nextStep) {
    if (!pendingTurn) return false;
    const turn = pendingTurn;
    pendingTurn = null;
    isResponding = true;
    input.disabled = true;
    form.querySelector("button[type=submit]")?.setAttribute("disabled", "");
    controls.querySelectorAll("button").forEach(button => { button.disabled = true; });
    const mission = OQ.getMission();
    try {
      const response = await fetch("/api/chat/turn", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: mission.id,
          message: turn.message,
          context: {
            currentStep: turn.stepId,
            nextQuestion: nextStep?.prompt || "",
            mission
          }
        })
      });
      if (!response.ok) throw new Error("CHAT_API_UNAVAILABLE");
      const payload = await response.json();
      if (typeof payload.reply !== "string" || !payload.reply.trim()) throw new Error("CHAT_REPLY_INVALID");
      add("assistant", payload.reply.trim());
      return true;
    } catch {
      // O roteiro determinístico continua disponível quando a API/LLM estiver
      // indisponível; a interface não perde a resposta já registrada.
      if (nextStep) add("assistant", nextStep.prompt);
      else add("assistant", "Recebi suas informações. Confira o resumo da missão e ajuste o que for necessário antes de confirmar.");
      return false;
    } finally {
      isResponding = false;
      input.disabled = false;
      form.querySelector("button[type=submit]")?.removeAttribute("disabled");
    }
  }

  async function askCurrentStep() {
    const step = OQ.currentMissionStep();
    if (!step) {
      await requestAssistantTurn(null);
      renderMissionReview(true);
      return;
    }
    // Reconhecimento é um roteiro fixo: a IA não altera perguntas nem opções.
    add("assistant", step.prompt);
    renderStepControls(step);
    input.value = "";
    input.focus();
  }

  function submitAnswer(value, label, fromButton = false) {
    if (isResponding || !String(value || "").trim()) return;
    const previousStep = OQ.currentMissionStep();
    if (previousStep?.options?.length && !fromButton) {
      add("assistant", "Para continuar, selecione uma das opções apresentadas nos botões. Respostas digitadas não são registradas nesta etapa.");
      renderStepControls(previousStep);
      input.value = "";
      return;
    }
    if (previousStep?.options?.length) {
      const normalized = candidate => String(candidate || "")
        .normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLocaleLowerCase("pt-BR");
      const selected = previousStep.options.find(option =>
        normalized(option.value) === normalized(value) ||
        normalized(option.label) === normalized(value)
      );
      if (!selected) {
        add("assistant", "Para manter esta etapa objetiva, escolha uma das opções apresentadas nos botões. Sua resposta ainda não foi registrada.");
        renderStepControls(previousStep);
        input.value = "";
        return;
      }
      value = selected.value;
      label = selected.label;
    }
    add("user", label || value);
    OQ.advanceMission(String(value));
    pendingTurn = { message: String(value), stepId: previousStep?.id || "unknown" };
    updateGoal();
    continueMission();
  }

  async function continueMission() {
    const step = OQ.currentMissionStep();
    if (step) await askCurrentStep();
    else {
      await requestAssistantTurn(null);
      renderMissionReview(true);
    }
  }

  function missionSummary() {
    const mission = OQ.getMission();
    const labels = copy.labels;
    return Object.keys(labels)
      .map(key => {
        const answer = mission.answers[key];
        if (!answer || answer.value === null) return labels[key] + ": " + copy.unanswered;
        const step = OQ.missionSteps().find(item => item.id === key);
        return labels[key] + ": " + (step?.options ? optionLabel(step, answer.value) : answer.value);
      })
      .join("\n");
  }

  function addControl(label, handler, variant) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "chat-action";
    if (variant) button.setAttribute("data-variant", variant);
    button.textContent = label;
    button.addEventListener("click", handler);
    controls.append(button);
  }

  function renderMissionReview(appendMessage) {
    clearControls();
    input.placeholder = copy.reviewPlaceholder;
    if (appendMessage) add("assistant", copy.summaryIntro + "\n" + missionSummary() + "\n\n" + copy.summaryDisclaimer);
    const status = OQ.getMission()?.status;
    if (status === "ready_for_discovery") {
      addControl(copy.deepen, goToDiscovery, "primary");
    } else {
      addControl(copy.confirmAndDeepen, confirmMission, "primary");
    }
    addControl(copy.review, () => {
      OQ.reviseMission();
      askCurrentStep();
    });
    addControl(copy.restart, restartMission);
  }

  function confirmMission() {
    OQ.confirmMission();
    add("user", copy.confirmedByUser);
    add("assistant", copy.confirmedMessage);
    renderMissionReview(false);
  }

  function goToDiscovery() {
    try {
      const result = OQ.prepareDiscovery();
      OQ.logInteraction("chat", "discovery-handoff", { prefilled: result.prefilled });
      window.location.href = "/descoberta";
    } catch (error) {
      add("assistant", copy.discoveryError);
    }
  }

  function restartMission() {
    OQ.startMission("business");
    add("assistant", copy.restartMessage);
    updateGoal();
    askCurrentStep();
  }

  function startBusinessMission() {
    if (audienceChoices) audienceChoices.hidden = true;
    OQ.startMission("business");
    add("assistant", copy.startBusinessMessage);
    updateGoal();
    askCurrentStep();
  }

  function startDeveloperPath() {
    if (audienceChoices) audienceChoices.hidden = true;
    add("user", copy.developer);
    add("assistant", copy.developerMessage);
    addLink(copy.developerLinkText, copy.developerLinkLabel, "/site#solucoes");
  }

  function restoreMission() {
    const mission = OQ.getMission();
    if (!mission) return;
    if (audienceChoices) audienceChoices.hidden = true;
    updateGoal();
    if (mission.status === "collecting") {
      const step = OQ.currentMissionStep();
      if (step) renderStepControls(step);
    } else if (mission.status === "review" || mission.status === "ready_for_discovery") {
      renderMissionReview(false);
    }
  }

  if (window.location.hash === "#descoberta") {
    await runChatDiscovery();
    return;
  }
  if (OQ.history("chat").length === 0 && !OQ.getMission()) {
    await typeWelcomeSequence();
  }

  restore();
  restoreMission();

  document.querySelectorAll("[data-choice]").forEach(button =>
    button.addEventListener("click", () => {
      if (button.dataset.choice === copy.business) {
        add("user", copy.business);
        OQ.logInteraction("chat", "audience-selected", { value: "business" });
        startBusinessMission();
      } else {
        startDeveloperPath();
      }
    })
  );

  const about = document.querySelector('[data-action="about"]');
  if (about) {
    about.addEventListener("click", () => {
      add("user", copy.aboutQuestion);
      add("assistant", copy.aboutAnswer);
      OQ.logInteraction("chat", "about-oaas");
    });
  }

  form.addEventListener("submit", event => {
    event.preventDefault();
    if (isResponding) return;
    const value = input.value.trim();
    if (!value) return;
    const mission = OQ.getMission();
    if (mission?.status === "collecting") {
      submitAnswer(value, value);
      input.value = "";
      return;
    }
    if (mission?.status === "review" || mission?.status === "ready_for_discovery") {
      add("user", value);
      pendingTurn = { message: value, stepId: "mission-review" };
      input.value = "";
      requestAssistantTurn(null).then(ok => {
        if (!ok) OQ.logInteraction("chat", "llm-fallback", { step: "mission-review" });
      });
      return;
    }
    add("user", value);
    OQ.startMission("business");
    OQ.captureMissionIntent(value);
    pendingTurn = { message: value, stepId: "initial-intent" };
    if (audienceChoices) audienceChoices.hidden = true;
    updateGoal();
    input.value = "";
    continueMission();
  });

  document.querySelectorAll('a[href^="#"]').forEach(link =>
    link.addEventListener("click", () =>
      OQ.logInteraction("chat", "section-navigation", { target: link.getAttribute("href") })
    )
  );

  document.querySelectorAll('a[href^="/"]').forEach(link =>
    link.addEventListener("click", () =>
      OQ.logInteraction("chat", "mode-navigation", { target: link.getAttribute("href") })
    )
  );
}
