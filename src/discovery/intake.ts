import type { OutcomeIntent } from "../intent/intent.ts";
import { qualifyIntent, validateIntent } from "../intent/intent.ts";
import { qualifyAgainst, type QualificationRule } from "./qualification.ts";

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

const ROUTING_EXPLANATIONS: Record<string, string> = {
  "id:REQUIRED": "The intent identifier is missing.",
  "tenantId:REQUIRED": "The tenant context is missing.",
  "actorId:REQUIRED": "The requesting actor is missing.",
  "statement:REQUIRED": "The request statement is missing.",
  "desiredOutcome:REQUIRED": "The desired outcome is missing.",
  "version:INVALID": "The intent version is invalid.",
  "status:INVALID": "The intent status is invalid.",
  "scope:INVALID": "The scope must be a list of non-empty values.",
  "constraints:INVALID": "Constraints must be a list of non-empty values.",
  "SCOPE_INVALID": "The supplied scope is not a valid list.",
  "SCOPE_ITEM_INVALID": "Each scope item must be a non-empty value.",
  "SCOPE_TOO_SMALL": "The scope does not meet the minimum required by the qualification rule.",
  "DOMAIN_NOT_ALLOWED": "The requested domain is not allowed by the qualification rule.",
  "DEADLINE_INVALID": "The deadline is not a valid date.",
  "DEADLINE_OUT_OF_RANGE": "The deadline is outside the permitted qualification window.",
};

function explainRoutingReason(reason: string): string {
  if (reason.startsWith("CLARIFICATION_REQUIRED:")) {
    return "Clarification is required for " + reason.slice("CLARIFICATION_REQUIRED:".length) + ".";
  }
  if (reason.startsWith("QUALIFICATION_MISSING:")) {
    return "The qualification rule requires " + reason.slice("QUALIFICATION_MISSING:".length) + ".";
  }
  return ROUTING_EXPLANATIONS[reason] ?? "The intent did not satisfy a routing requirement (" + reason + ").";
}

export function routeIntent(
  i: OutcomeIntent,
  ambiguities: readonly string[] = [],
  qualificationRule?: QualificationRule,
) {
  const qualified = qualifyIntent(i);
  const validationErrors = validateIntent(qualified);
  const qualification = qualificationRule
    ? qualifyAgainst(i as unknown as Record<string, unknown>, qualificationRule)
    : undefined;
  const qualificationMissing = qualification?.missing ?? [];
  const qualificationReasons = qualification?.reasons ?? [];

  const clarifications = clarificationFor(qualified, ambiguities);
  for (const field of qualificationMissing) {
    if (!clarifications.some((question) => question.path === field)) {
      clarifications.push({
        path: field,
        question: "Please provide " + field + ".",
        reason: "Required by the qualification rule",
      });
    }
  }
  if (qualificationReasons.includes("SCOPE_TOO_SMALL") && !clarifications.some((question) => question.path === "scope")) {
    clarifications.push({
      path: "scope",
      question: "Please specify a broader scope that meets the qualification rule.",
      reason: "Scope does not meet the minimum required by the qualification rule",
    });
  }

  const reasons = [...new Set([
    ...validationErrors,
    ...qualificationMissing.map((field) => "QUALIFICATION_MISSING:" + field),
    ...qualificationReasons,
    ...clarifications.map((question) => "CLARIFICATION_REQUIRED:" + question.path),
  ])];
  const invalidIdentity = validationErrors.some((error) =>
    ["id:REQUIRED", "tenantId:REQUIRED", "actorId:REQUIRED", "provenance:REQUIRED"].includes(error),
  );
  const invalidStructure = validationErrors.some((error) => error.endsWith(":INVALID"));
  const rejectedByRule = qualificationReasons.some((reason) =>
    ["SCOPE_INVALID", "SCOPE_ITEM_INVALID", "DOMAIN_NOT_ALLOWED", "DEADLINE_INVALID", "DEADLINE_OUT_OF_RANGE"].includes(reason),
  );
  const rejected = invalidIdentity || invalidStructure || rejectedByRule;
  const needsClarification = !rejected && (reasons.length > 0 || clarifications.length > 0);
  const route = rejected ? "rejected" as const : needsClarification ? "clarification" as const : "discovery" as const;
  const status = rejected ? "rejected" as const : needsClarification ? "needs_clarification" as const : "qualified" as const;
  const intent = Object.freeze({ ...qualified, status });
  const explanations = Object.freeze([...new Set(reasons.map(explainRoutingReason))]);

  return {
    intent,
    route,
    reasons: Object.freeze(reasons),
    explanations,
    clarifications: Object.freeze(clarifications),
    ...(qualification ? { qualification } : {}),
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
