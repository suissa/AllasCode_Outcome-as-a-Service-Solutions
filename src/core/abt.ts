import { validateValue, type PropertySchema, type ValidationIssue } from "./schema-validator.ts";

export type AbtKind = "identifier"|"text"|"email"|"phone"|"url"|"enum"|"boolean"|"integer"|"decimal"|"money"|"percentage"|"date"|"timestamp"|"duration"|"quantity"|"object"|"array"|"reference"|"secret"|"evidence"|"metric"|"expression"|"payload";
export interface AbtContext { path?: string; min?: number; max?: number; allowed?: readonly unknown[]; allowedHosts?: readonly string[]; tenantId?: string; exists?: (id: string) => boolean; schema?: PropertySchema; metricId?: string; unit?: string; version?: string }
export interface AbtResult<T = unknown> { valid: boolean; value?: T; issues: readonly ValidationIssue[]; repairs: readonly { rule: string; before: unknown; after: unknown }[] }
const issue = (code: string, path: string, message: string): ValidationIssue => ({ code, path, message });
const isObject = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const isoDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) && new Date(v + "T00:00:00.000Z").toISOString().slice(0, 10) === v;
const offsetTimestamp = (v: string): boolean => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,9})?(Z|[+-]\d{2}:\d{2})$/.test(v) && !Number.isNaN(Date.parse(v));

/** Strict, deterministic ABT validation. Repairs are reported, never silently applied. */
export function validateAbt(kind: AbtKind, input: unknown, context: AbtContext = {}): AbtResult {
  const path = context.path ?? "$";
  const errors: ValidationIssue[] = [];
  let value = input;
  const repairs: { rule: string; before: unknown; after: unknown }[] = [];
  if (input === undefined || input === null) return { valid: false, issues: [issue("REQUIRED", path, "Value is required")], repairs };
  switch (kind) {
    case "identifier":
      if (typeof value !== "string" || !/^[a-z][a-z0-9]*(?:_[a-z0-9]+)+$/.test(value) || value.length > 69) errors.push(issue("ID_INVALID", path, "Expected a canonical namespaced identifier"));
      break;
    case "text":
      if (typeof value !== "string") errors.push(issue("TYPE_MISMATCH", path, "Expected text"));
      else {
        if (value.length < (context.min ?? 0)) errors.push(issue("MIN_LENGTH", path, "Text is shorter than the minimum"));
        if (value.length > (context.max ?? 10000)) errors.push(issue("MAX_LENGTH", path, "Text exceeds the maximum"));
        if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(value)) errors.push(issue("CONTROL_CHARACTER", path, "Text contains forbidden control characters"));
      }
      break;
    case "email":
      if (typeof value !== "string" || value.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) errors.push(issue("EMAIL_INVALID", path, "Expected a valid email address"));
      else { const parts = value.split("@"); value = parts[0] + "@" + parts[1]!.toLowerCase(); if (value !== input) repairs.push({ rule: "EMAIL_DOMAIN_LOWERCASE", before: input, after: value }); }
      break;
    case "phone":
      if (typeof value !== "string" || !/^\+[1-9]\d{7,14}$/.test(value)) errors.push(issue("PHONE_NOT_E164", path, "Expected an unambiguous E.164 phone number"));
      break;
    case "url":
      if (typeof value !== "string") errors.push(issue("URL_INVALID", path, "Expected URL text"));
      else {
        try { const u = new URL(value); if (u.protocol !== "https:") errors.push(issue("URL_SCHEME_FORBIDDEN", path, "Only HTTPS URLs are allowed")); if (u.username || u.password) errors.push(issue("URL_CREDENTIALS_FORBIDDEN", path, "URL credentials are forbidden")); if (context.allowedHosts?.length && !context.allowedHosts.includes(u.hostname)) errors.push(issue("URL_HOST_FORBIDDEN", path, "URL host is not allowlisted")); }
        catch { errors.push(issue("URL_INVALID", path, "URL could not be parsed")); }
      }
      break;
    case "enum":
      if (!context.allowed?.some((v) => v === value)) errors.push(issue("ENUM_INVALID", path, "Value is not in the declared set"));
      break;
    case "boolean":
      if (typeof value !== "boolean") errors.push(issue("BOOLEAN_STRICT", path, "Expected a boolean; coercion is not allowed"));
      break;
    case "integer":
      if (typeof value !== "number" || !Number.isSafeInteger(value)) errors.push(issue("INTEGER_INVALID", path, "Expected a safe integer"));
      else { if (context.min !== undefined && value < context.min) errors.push(issue("MINIMUM", path, "Integer below minimum")); if (context.max !== undefined && value > context.max) errors.push(issue("MAXIMUM", path, "Integer above maximum")); }
      break;
    case "decimal":
      if (typeof value !== "number" || !Number.isFinite(value)) errors.push(issue("DECIMAL_INVALID", path, "Expected a finite decimal"));
      else { if (context.min !== undefined && value < context.min) errors.push(issue("MINIMUM", path, "Decimal below minimum")); if (context.max !== undefined && value > context.max) errors.push(issue("MAXIMUM", path, "Decimal above maximum")); }
      break;
    case "money":
      if (!isObject(value) || typeof value.amount !== "number" || !Number.isFinite(value.amount) || typeof value.currency !== "string" || !/^[A-Z]{3}$/.test(value.currency)) errors.push(issue("MONEY_INVALID", path, "Expected amount and ISO 4217 currency"));
      else if (Math.round(value.amount * 100) !== value.amount * 100) errors.push(issue("MONEY_SCALE_INVALID", path + ".amount", "Money supports at most two decimal places"));
      break;
    case "percentage":
      if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 100) errors.push(issue("PERCENTAGE_RANGE", path, "Percentage must be between 0 and 100"));
      break;
    case "date":
      if (typeof value !== "string" || !isoDate(value)) errors.push(issue("DATE_INVALID", path, "Expected a real calendar date in YYYY-MM-DD"));
      break;
    case "timestamp":
      if (typeof value !== "string" || !offsetTimestamp(value)) errors.push(issue("TIMESTAMP_TIMEZONE_REQUIRED", path, "Expected an ISO timestamp with timezone"));
      break;
    case "duration":
    case "quantity":
      if (!isObject(value) || typeof value.amount !== "number" || !Number.isFinite(value.amount) || value.amount < 0 || typeof value.unit !== "string" || !value.unit.trim()) errors.push(issue("QUANTITY_INVALID", path, "Expected a nonnegative amount and unit"));
      break;
    case "object":
    case "array":
      if (!context.schema) errors.push(issue("SCHEMA_REQUIRED", path, "A schema is required for structured values"));
      else errors.push(...validateValue(value, context.schema, path));
      break;
    case "reference":
      if (typeof value !== "string" || !value.trim()) errors.push(issue("REFERENCE_INVALID", path, "Expected a reference identifier"));
      else if (context.exists && !context.exists(value)) errors.push(issue("REFERENCE_NOT_FOUND", path, "Referenced entity does not exist"));
      break;
    case "secret":
      if (!isObject(value) || typeof value.secretRef !== "string" || !value.secretRef.trim() || "value" in value) errors.push(issue("SECRET_REFERENCE_ONLY", path, "Only a secret reference may cross this boundary"));
      break;
    case "evidence":
      if (!isObject(value) || typeof value.id !== "string" || typeof value.tenantId !== "string" || typeof value.sourceId !== "string" || typeof value.contentHash !== "string" || typeof value.capturedAt !== "string") errors.push(issue("EVIDENCE_ENVELOPE_INVALID", path, "Evidence provenance and integrity metadata are required"));
      else {
        if (context.tenantId && value.tenantId !== context.tenantId) errors.push(issue("TENANT_MISMATCH", path + ".tenantId", "Evidence belongs to another tenant"));
        if (!/^[a-f0-9]{64}$/i.test(value.contentHash)) errors.push(issue("EVIDENCE_HASH_INVALID", path + ".contentHash", "Expected a SHA-256 hex digest"));
        if (Number.isNaN(Date.parse(value.capturedAt))) errors.push(issue("EVIDENCE_TIMESTAMP_INVALID", path + ".capturedAt", "Invalid capture timestamp"));
      }
      break;
    case "metric":
      if (!isObject(value) || typeof value.metricId !== "string" || typeof value.unit !== "string" || typeof value.value !== "number" || !Number.isFinite(value.value)) errors.push(issue("METRIC_INVALID", path, "Metric ID, numeric value and unit are required"));
      else { if (context.metricId && value.metricId !== context.metricId) errors.push(issue("METRIC_ID_MISMATCH", path + ".metricId", "Metric does not match the contract")); if (context.unit && value.unit !== context.unit) errors.push(issue("METRIC_UNIT_MISMATCH", path + ".unit", "Metric unit does not match the contract")); }
      break;
    case "expression":
      if (!isObject(value) || !["add","subtract","multiply","divide","min","max","gt","gte","lt","lte","eq","and","or","not"].includes(String(value.op)) || !Array.isArray(value.args) || value.args.length > 20) errors.push(issue("EXPRESSION_INVALID", path, "Expression must use an allowlisted operator and bounded arguments"));
      break;
    case "payload":
      if (!isObject(value) || typeof value.payload_version !== "string" || typeof value.tenant_id !== "string" || !("intent" in value)) errors.push(issue("PAYLOAD_ENVELOPE_INVALID", path, "Versioned tenant-scoped payload and intent are required"));
      else if (context.version && value.payload_version !== context.version) errors.push(issue("PAYLOAD_VERSION_UNSUPPORTED", path + ".payload_version", "Unsupported payload version"));
      else if (context.tenantId && value.tenant_id !== context.tenantId) errors.push(issue("TENANT_MISMATCH", path + ".tenant_id", "Payload belongs to another tenant"));
      break;
  }
  return { valid: errors.length === 0, ...(errors.length === 0 ? { value } : {}), issues: Object.freeze(errors), repairs: Object.freeze(repairs) };
}
