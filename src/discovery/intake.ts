import type { OutcomeIntent } from "../intent/intent.ts";
import { qualifyIntent, validateIntent } from "../intent/intent.ts";

export interface Clarification {
  path: string;
  question: string;
  reason: string;
}

export function clarificationFor(
  i: OutcomeIntent,
  ambiguities: readonly string[] = [],
): Clarification[] {
  if (!i || typeof i !== "object") throw new Error("INTENT_CLARIFICATION_INPUT_INVALID");
  if (!Array.isArray(ambiguities) || ambiguities.some((value) => typeof value !== "string" || !value.trim())) {
    throw new Error("INTENT_AMBIGUITY_INVALID");
  }

  const questions: Clarification[] = [];
  if (!i.desiredOutcome?.trim()) {
    questions.push({
      path: "desiredOutcome",
      question: "What measurable result should change?",
      reason: "Outcome is unspecified",
    });
  }
  if (!i.scope?.length) {
    questions.push({
      path: "scope",
      question: "Which process, team or customer segment is in scope?",
      reason: "Scope is missing",
    });
  }
  if (!i.deadline) {
    questions.push({
      path: "deadline",
      question: "By when should this result be achieved?",
      reason: "Time horizon is missing",
    });
  }

  const seen = new Set<string>();
  for (const ambiguity of ambiguities) {
    const normalized = ambiguity.trim();
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    questions.push({
      path: "ambiguity",
      question: "Please clarify: " + normalized,
      reason: "Intent extraction identified an unresolved ambiguity",
    });
  }
  return questions;
}

export function routeIntent(i: OutcomeIntent, ambiguities: readonly string[] = []) {
  const qualified = qualifyIntent(i);
  const validationErrors = validateIntent(qualified);
  const clarifications = clarificationFor(qualified, ambiguities);
  const needsClarification = validationErrors.length > 0 || clarifications.length > 0;
  const intent = Object.freeze({
    ...qualified,
    status: needsClarification ? "needs_clarification" as const : "qualified" as const,
  });
  const reasons = [
    ...validationErrors,
    ...clarifications.map((question) => "CLARIFICATION_REQUIRED:" + question.path),
  ];
  return {
    intent,
    route: needsClarification ? "clarification" as const : "discovery" as const,
    reasons,
    clarifications: Object.freeze(clarifications),
  };
}

export interface DiscoveryTask {
  id: string;
  intentId: string;
  kind: "interview" | "data_request" | "process_map" | "workshop";
  ownerId?: string;
  status: "pending" | "done" | "blocked";
}

export function createDiscoveryTasks(intentId: string, tenantId: string, ownerId?: string): DiscoveryTask[] {
  if (!intentId || !tenantId) throw new Error("DISCOVERY_CONTEXT_REQUIRED");
  const kinds: DiscoveryTask["kind"][] = ["interview", "data_request", "process_map", "workshop"];
  return kinds.map((kind) => ({
    id: "task_discovery_" + intentId.replace(/[^a-z0-9]+/gi, "_").toLowerCase() + "_" + kind,
    intentId,
    kind,
    ...(ownerId ? { ownerId } : {}),
    status: "pending",
  }));
}

export function createDiscoveryForQualifiedIntent(i: OutcomeIntent, ownerId?: string): DiscoveryTask[] {
  const routed = routeIntent(i);
  if (routed.route !== "discovery") throw new Error("INTENT_NOT_QUALIFIED");
  return createDiscoveryTasks(i.id, i.tenantId, ownerId);
}
