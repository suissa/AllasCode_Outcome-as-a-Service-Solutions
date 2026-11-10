import { createHash } from "node:crypto";
import type { Agreement } from "./agreement.ts";
import { validateAgreement } from "./agreement.ts";
import type { PricingLine, PricingSummary } from "./pricing.ts";
import { calculatePricing } from "./pricing.ts";

export type ContractAnnexKind = "scope" | "pricing" | "outcome" | "delivery" | "acceptance" | "sla" | "security" | "data_processing" | "sector_specific";
export interface ContractParty { legalName: string; taxId?: string; representative: string; email?: string; role: "customer" | "provider" }
export interface ContractClause { id: string; title: string; template: string; variables: Readonly<Record<string, string>>; required?: boolean }
export interface ContractAnnex { id: string; kind: ContractAnnexKind; title: string; content: Readonly<Record<string, unknown>> }
export interface OutcomeSchedule {
  metricId: string; metricName: string; unit: string; baseline: number; target: number;
  direction: "increase" | "decrease"; population: string; sourceOfTruth: string;
  periodStart: string; periodEnd: string; attribution: "direct" | "contribution" | "experimental";
  exclusions: readonly string[]; guardrails: readonly string[]; approvedBy: string;
}
export interface ContractComposerInput {
  agreement: Agreement;
  parties: readonly ContractParty[];
  effectiveDate: string;
  expiryDate?: string;
  jurisdiction: string;
  sector: string;
  projectName: string;
  pricingLines: readonly PricingLine[];
  outcome?: OutcomeSchedule;
  deliveryPlan?: Readonly<Record<string, unknown>>;
  acceptance?: Readonly<Record<string, unknown>>;
  sla?: Readonly<Record<string, unknown>>;
  security?: Readonly<Record<string, unknown>>;
  dataProcessing?: Readonly<Record<string, unknown>>;
  sectorTerms?: Readonly<Record<string, unknown>>;
  clauses?: readonly ContractClause[];
}
export interface ContractPackage {
  id: string; tenantId: string; agreementId: string; agreementVersion: number;
  status: "draft"; projectName: string; sector: string; jurisdiction: string;
  effectiveDate: string; expiryDate?: string; parties: readonly ContractParty[];
  scope: readonly string[]; deliverables: readonly string[]; exclusions: readonly string[];
  pricing: PricingSummary; clauses: readonly { id: string; title: string; body: string; required: boolean }[];
  annexes: readonly ContractAnnex[]; fingerprint: string; generatedAt: string;
}
const requiredText = (value: string) => typeof value === "string" && value.trim().length > 0;
const validDate = (value: string) => !Number.isNaN(Date.parse(value));
function renderClause(clause: ContractClause): string {
  if (!requiredText(clause.id) || !requiredText(clause.title) || !requiredText(clause.template)) throw new Error("CONTRACT_CLAUSE_INVALID");
  const body = clause.template.replace(/\{\{([a-zA-Z0-9_.-]+)\}\}/g, (_match, key: string) => {
    const value = clause.variables[key];
    if (typeof value !== "string" || !requiredText(value)) throw new Error("CONTRACT_CLAUSE_VARIABLE_MISSING:" + key);
    return value;
  });
  if (/\{\{[^}]+\}\}/.test(body)) throw new Error("CONTRACT_CLAUSE_PLACEHOLDER_UNRESOLVED");
  return body;
}
function canonical(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value) ?? "null";
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  const object = value as Record<string, unknown>;
  return "{" + Object.keys(object).sort().map(key => JSON.stringify(key) + ":" + canonical(object[key])).join(",") + "}";
}
function deepFreeze<T>(value: T): T {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) deepFreeze(child);
  }
  return value;
}
function cloneRecord(value: Readonly<Record<string, unknown>>): Readonly<Record<string, unknown>> {
  return JSON.parse(JSON.stringify(value)) as Record<string, unknown>;
}
export function composeContract(input: ContractComposerInput, generatedAt = new Date()): ContractPackage {
  const { agreement } = input;
  if (validateAgreement(agreement).length) throw new Error("CONTRACT_AGREEMENT_INVALID");
  if (agreement.status !== "draft" && agreement.status !== "pending_approval") throw new Error("CONTRACT_AGREEMENT_NOT_DRAFT");
  if (!requiredText(input.projectName) || !requiredText(input.sector) || !requiredText(input.jurisdiction)) throw new Error("CONTRACT_PROJECT_METADATA_REQUIRED");
  if (!input.parties.some(p => p.role === "customer") || !input.parties.some(p => p.role === "provider")) throw new Error("CONTRACT_PARTIES_INCOMPLETE");
  if (input.parties.some(p => !requiredText(p.legalName) || !requiredText(p.representative))) throw new Error("CONTRACT_PARTY_INVALID");
  if (!validDate(input.effectiveDate) || (input.expiryDate && (!validDate(input.expiryDate) || Date.parse(input.expiryDate) <= Date.parse(input.effectiveDate)))) throw new Error("CONTRACT_DATE_RANGE_INVALID");
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("CONTRACT_GENERATION_DATE_INVALID");
  if (input.outcome) {
    const o = input.outcome;
    if (!requiredText(o.metricId) || !requiredText(o.metricName) || !requiredText(o.unit) || !requiredText(o.population) || !requiredText(o.sourceOfTruth) || !requiredText(o.approvedBy) || !validDate(o.periodStart) || !validDate(o.periodEnd) || Date.parse(o.periodEnd) <= Date.parse(o.periodStart) || !Number.isFinite(o.baseline) || !Number.isFinite(o.target) || o.baseline === o.target) throw new Error("CONTRACT_OUTCOME_SCHEDULE_INVALID");
    if (!input.pricingLines.some(line => line.kind === "outcome" || line.kind === "gain_share" || line.kind === "revenue_share")) throw new Error("CONTRACT_OUTCOME_FEE_MISSING");
  }
  const pricing = calculatePricing(input.pricingLines);
  const annexes: ContractAnnex[] = [
    { id: "annex-scope", kind: "scope", title: "Escopo, entregáveis e exclusões", content: { scope: [...agreement.scope], deliverables: [...agreement.deliverables], exclusions: [...agreement.exclusions] } },
    { id: "annex-pricing", kind: "pricing", title: "Quadro de preços e faturamento", content: { currency: pricing.currency, lines: pricing.lines, subtotal: pricing.subtotal, credits: pricing.credits, total: pricing.total } },
  ];
  if (input.outcome) annexes.push({ id: "annex-outcome", kind: "outcome", title: "Métrica, baseline e apuração de resultado", content: cloneRecord(input.outcome as unknown as Record<string, unknown>) });
  const optionalAnnexes: [ContractAnnexKind, string, Readonly<Record<string, unknown>> | undefined][] = [
    ["delivery", "Plano de execução e governança", input.deliveryPlan],
    ["acceptance", "Critérios de aceite", input.acceptance],
    ["sla", "Níveis de serviço e créditos", input.sla],
    ["security", "Segurança e controles de acesso", input.security],
    ["data_processing", "Tratamento e proteção de dados", input.dataProcessing],
    ["sector_specific", "Condições específicas do setor", input.sectorTerms],
  ];
  for (const [kind, title, content] of optionalAnnexes) if (content) annexes.push({ id: "annex-" + kind, kind, title, content: cloneRecord(content) });
  const clauses = (input.clauses ?? []).map(c => Object.freeze({ id: c.id, title: c.title, body: renderClause(c), required: c.required ?? true }));
  if (new Set(clauses.map(c => c.id)).size !== clauses.length) throw new Error("CONTRACT_CLAUSE_ID_DUPLICATE");
  const base = {
    id: agreement.id + ":v" + agreement.version, tenantId: agreement.tenantId, agreementId: agreement.id,
    agreementVersion: agreement.version, status: "draft" as const, projectName: input.projectName,
    sector: input.sector, jurisdiction: input.jurisdiction, effectiveDate: input.effectiveDate,
    ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
    parties: input.parties.map(p => ({ ...p })), scope: [...agreement.scope], deliverables: [...agreement.deliverables],
    exclusions: [...agreement.exclusions], pricing, clauses, annexes, generatedAt: generatedAt.toISOString(),
  };
  const fingerprint = createHash("sha256").update(canonical(base), "utf8").digest("hex");
  return deepFreeze({ ...base, parties: base.parties, scope: base.scope, deliverables: base.deliverables, exclusions: base.exclusions, clauses, annexes, fingerprint });
}
export function renderContractMarkdown(contract: ContractPackage): string {
  const money = (amount: number) => new Intl.NumberFormat("pt-BR", { style: "currency", currency: contract.pricing.currency }).format(amount);
  const parties = contract.parties.map(p => `- **${p.role === "customer" ? "Contratante" : "Contratada"}:** ${p.legalName} — representante: ${p.representative}`).join("\n");
  const lines = contract.pricing.lines.map(line => `| ${line.id} | ${line.kind} | ${line.quantity} | ${money(line.total)} |`).join("\n");
  const clauses = contract.clauses.map(c => `### ${c.title}\n\n${c.body}`).join("\n\n");
  const annexes = contract.annexes.map(a => `### ${a.title}\n\n\`\`\`json\n${JSON.stringify(a.content, null, 2)}\n\`\`\``).join("\n\n");
  return [
    `# Contrato ${contract.id}`, `\n**Projeto:** ${contract.projectName}`, `**Setor:** ${contract.sector}`, `**Jurisdição:** ${contract.jurisdiction}`,
    `\n## Partes\n\n${parties}`, `\n## Objeto e escopo\n\n${contract.scope.map(x => "- " + x).join("\n")}`,
    `\n## Entregáveis\n\n${contract.deliverables.map(x => "- " + x).join("\n")}`,
    `\n## Exclusões\n\n${contract.exclusions.map(x => "- " + x).join("\n")}`,
    `\n## Quadro comercial\n\n| Item | Modelo | Quantidade | Valor |\n|---|---|---:|---:|\n${lines}\n\n**Subtotal:** ${money(contract.pricing.subtotal)}  \n**Créditos:** ${money(contract.pricing.credits)}  \n**Total calculado:** ${money(contract.pricing.total)}`,
    clauses ? `\n## Cláusulas parametrizadas\n\n${clauses}` : "",
    `\n## Anexos\n\n${annexes}`,
    `\n---\nDocumento gerado como minuta. Exige revisão jurídica, tributária, de privacidade e aprovação das partes antes da assinatura.\nFingerprint SHA-256: ${contract.fingerprint}`,
  ].filter(Boolean).join("\n");
}
