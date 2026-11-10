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

  function add(role, text) {
    const { row, avatar } = makeMessage(role);
    const bubble = document.createElement("div");
    bubble.className = "chat-bubble";
    bubble.textContent = text;
    row.append(avatar, bubble);
    chat.append(row);
    chat.scrollTop = chat.scrollHeight;
    OQ.logMessage("chat", role, text);
    updateCount();
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
    input.placeholder = step.placeholder || copy.answerPlaceholder;
    if (step.options?.length) {
      const group = document.createElement("div");
      group.className = "chat-mission-grid";
      step.options.forEach(option => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "chat-mission-option";
        button.textContent = option.label;
        button.addEventListener("click", () => submitAnswer(option.value, option.label));
        group.append(button);
      });
      controls.append(group);
    }
    const skip = document.createElement("button");
    skip.type = "button";
    skip.className = "chat-mission-skip";
    skip.textContent = copy.skipQuestion;
    skip.addEventListener("click", () => {
      add("user", copy.unknownAnswer);
      OQ.advanceMission(null, true);
      continueMission();
    });
    controls.append(skip);
  }

  function askCurrentStep() {
    const step = OQ.currentMissionStep();
    if (!step) {
      renderMissionReview(true);
      return;
    }
    add("assistant", step.prompt);
    renderStepControls(step);
    input.value = "";
    input.focus();
  }

  function submitAnswer(value, label) {
    if (!String(value || "").trim()) return;
    add("user", label || value);
    OQ.advanceMission(String(value));
    updateGoal();
    continueMission();
  }

  function continueMission() {
    const step = OQ.currentMissionStep();
    if (step) askCurrentStep();
    else renderMissionReview(true);
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
      add("assistant", copy.reviewObservation);
      input.value = "";
      return;
    }
    add("user", value);
    add("assistant", copy.chooseBusiness);
    input.value = "";
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
