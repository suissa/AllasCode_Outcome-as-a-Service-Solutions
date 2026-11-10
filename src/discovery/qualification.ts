export interface QualificationRule {
  id: string;
  requiredFields: string[];
  minimumScopeItems: number;
  allowedDomains: string[];
  maxDeadlineDays?: number;
}

export interface QualificationDecision {
  qualified: boolean;
  missing: string[];
  reasons: string[];
  ruleId: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function missingValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

function validRule(rule: QualificationRule): boolean {
  return Boolean(
    rule &&
    typeof rule.id === "string" && rule.id.trim() &&
    Array.isArray(rule.requiredFields) &&
    rule.requiredFields.every((field) => typeof field === "string" && field.trim()) &&
    Number.isInteger(rule.minimumScopeItems) && rule.minimumScopeItems >= 0 &&
    Array.isArray(rule.allowedDomains) &&
    rule.allowedDomains.every((domain) => typeof domain === "string" && domain.trim()) &&
    (rule.maxDeadlineDays === undefined ||
      (Number.isFinite(rule.maxDeadlineDays) && rule.maxDeadlineDays >= 0))
  );
}

export function qualifyAgainst(
  input: Record<string, unknown>,
  rule: QualificationRule,
  now = new Date(),
): QualificationDecision {
  if (!isRecord(input)) throw new Error("QUALIFICATION_INPUT_INVALID");
  if (!validRule(rule)) throw new Error("QUALIFICATION_RULE_INVALID");
  if (!Number.isFinite(now.getTime())) throw new Error("QUALIFICATION_CLOCK_INVALID");

  const missing = rule.requiredFields.filter((field) => missingValue(input[field]));
  const reasons: string[] = [];

  if (input.scope !== undefined && !Array.isArray(input.scope)) {
    reasons.push("SCOPE_INVALID");
  } else {
    const scope = (input.scope ?? []) as unknown[];
    if (scope.some((item) => typeof item !== "string" || item.trim().length === 0)) {
      reasons.push("SCOPE_ITEM_INVALID");
    }
    if (scope.length < rule.minimumScopeItems) reasons.push("SCOPE_TOO_SMALL");
  }

  if (rule.allowedDomains.length > 0) {
    const domain = typeof input.domain === "string" ? input.domain.trim() : "";
    if (!domain || !rule.allowedDomains.includes(domain)) reasons.push("DOMAIN_NOT_ALLOWED");
  }

  if (rule.maxDeadlineDays !== undefined && input.deadline !== undefined && input.deadline !== null) {
    if (typeof input.deadline !== "string" || !input.deadline.trim() || !Number.isFinite(Date.parse(input.deadline))) {
      reasons.push("DEADLINE_INVALID");
    } else {
      const daysUntilDeadline = (Date.parse(input.deadline) - now.getTime()) / 86_400_000;
      if (daysUntilDeadline < 0 || daysUntilDeadline > rule.maxDeadlineDays) {
        reasons.push("DEADLINE_OUT_OF_RANGE");
      }
    }
  }

  const uniqueReasons = [...new Set(reasons)];
  return Object.freeze({
    qualified: missing.length === 0 && uniqueReasons.length === 0,
    missing: Object.freeze(missing),
    reasons: Object.freeze(uniqueReasons),
    ruleId: rule.id,
  });
}
