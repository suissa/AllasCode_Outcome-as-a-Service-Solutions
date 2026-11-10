import type { PricingLine, PricingSummary } from "./pricing.ts";
import { calculatePricing } from "./pricing.ts";
import type { Agreement } from "./agreement.ts";
import type { ContractPackage, ContractParty, OutcomeSchedule } from "./contract-composer.ts";
import { composeContract } from "./contract-composer.ts";

export type ProposalAttribution = "direct" | "contribution" | "experimental" | "pending";
export type ProposalDependencyStatus = "confirmed" | "pending" | "blocked";
export interface ProposalEvidence {
  id: string;
  description: string;
  source: string;
  period?: string;
  verification: "verified" | "pending";
}
export interface ProposalMetric {
  id: string;
  name: string;
  unit: string;
  direction: "increase" | "decrease" | "target";
  baseline?: number;
  target?: number;
  periodStart?: string;
  periodEnd?: string;
  sourceOfTruth?: string;
  attribution: ProposalAttribution;
  population?: string;
  guardrails: readonly string[];
  exclusions: readonly string[];
}
export interface ProposalScenario {
  id: string;
  rationale: string;
  confidence: number;
  estimatedBenefit?: { min: number; max: number; currency: string };
  estimatedCost?: { min: number; max: number; currency: string };
  assumptions: readonly string[];
  risks: readonly string[];
}
export interface ProposalDependency {
  description: string;
  owner: "customer" | "provider" | "third_party";
  status: ProposalDependencyStatus;
  requiredBy?: string;
}
export interface ProposalResponsibility {
  party: "customer" | "provider";
  description: string;
}
export interface OutcomeProposalInput {
  id: string;
  version: number;
  tenantId: string;
  customerName: string;
  sector: string;
  context: string;
  problem: string;
  desiredOutcome: string;
  diagnosisConfidence: number;
  evidence: readonly ProposalEvidence[];
  metric: ProposalMetric;
  scenario: ProposalScenario;
  scope: readonly string[];
  deliverables: readonly string[];
  exclusions: readonly string[];
  dependencies: readonly ProposalDependency[];
  responsibilities: readonly ProposalResponsibility[];
  acceptanceCriteria: readonly string[];
  pricingLines: readonly PricingLine[];
  deliveryWindowDays?: number;
  generatedAt?: string;
}
export interface ProposalReadiness {
  status: "incomplete" | "ready_for_review";
  blockers: readonly string[];
  warnings: readonly string[];
}
export interface OutcomeProposal {
  id: string;
  version: number;
  tenantId: string;
  status: "draft";
  generatedAt: string;
  customer: { name: string; sector: string };
  context: string;
  problem: string;
  desiredOutcome: string;
  diagnosisConfidence: number;
  evidence: readonly ProposalEvidence[];
  metric: ProposalMetric;
  scenario: ProposalScenario;
  scope: readonly string[];
  deliverables: readonly string[];
  exclusions: readonly string[];
  dependencies: readonly ProposalDependency[];
  responsibilities: readonly ProposalResponsibility[];
  acceptanceCriteria: readonly string[];
  pricing: { lines: readonly PricingLine[]; indicativeSummary?: PricingSummary };
  deliveryWindowDays?: number;
  readiness: ProposalReadiness;
  commercialNotice: string;
}

const hasText = (value: string | undefined): boolean => typeof value === "string" && value.trim().length > 0;
const unique = (values: readonly string[]): boolean => new Set(values).size === values.length;
const nonEmpty = (values: readonly string[]): boolean => values.length > 0 && values.every(hasText);

export function assessProposalReadiness(input: OutcomeProposalInput): ProposalReadiness {
  const blockers: string[] = [];
  const warnings: string[] = [];
  if (!hasText(input.id) || !Number.isInteger(input.version) || input.version < 1 || !hasText(input.tenantId)) blockers.push("PROPOSAL_IDENTITY_INVALID");
  if (input.generatedAt !== undefined && Number.isNaN(Date.parse(input.generatedAt))) blockers.push("PROPOSAL_TIMESTAMP_INVALID");
  if (!hasText(input.customerName) || !hasText(input.sector)) blockers.push("CUSTOMER_CONTEXT_INCOMPLETE");
  if (!hasText(input.context) || !hasText(input.problem) || !hasText(input.desiredOutcome)) blockers.push("BUSINESS_PROBLEM_INCOMPLETE");
  if (!Number.isFinite(input.diagnosisConfidence) || input.diagnosisConfidence < 0 || input.diagnosisConfidence > 1) blockers.push("DIAGNOSIS_CONFIDENCE_INVALID");
  if (!input.evidence.length || input.evidence.some(e => !hasText(e.id) || !hasText(e.description) || !hasText(e.source)) || !unique(input.evidence.map(e => e.id))) blockers.push("EVIDENCE_REGISTER_INCOMPLETE");
  if (!input.evidence.some(e => e.verification === "verified")) warnings.push("NO_INDEPENDENTLY_VERIFIED_EVIDENCE");
  const metric = input.metric;
  if (!hasText(metric.id) || !hasText(metric.name) || !hasText(metric.unit)) blockers.push("PRIMARY_METRIC_INCOMPLETE");
  if (!Number.isFinite(metric.baseline)) blockers.push("BASELINE_NOT_ESTABLISHED");
  if (!Number.isFinite(metric.target) || metric.target === metric.baseline) blockers.push("TARGET_NOT_DEFINED");
  if (!hasText(metric.sourceOfTruth)) blockers.push("SOURCE_OF_TRUTH_NOT_DEFINED");
  if (!hasText(metric.population)) blockers.push("MEASUREMENT_POPULATION_NOT_DEFINED");
  if (!metric.periodStart || !metric.periodEnd || Number.isNaN(Date.parse(metric.periodStart)) || Number.isNaN(Date.parse(metric.periodEnd)) || Date.parse(metric.periodEnd) <= Date.parse(metric.periodStart)) blockers.push("MEASUREMENT_PERIOD_INVALID");
  if (metric.attribution === "pending") blockers.push("ATTRIBUTION_METHOD_PENDING");
  if (!nonEmpty(metric.guardrails)) blockers.push("GUARDRAILS_NOT_DEFINED");
  if (!unique(metric.guardrails) || !unique(metric.exclusions)) blockers.push("METRIC_RULES_DUPLICATED");
  if (!hasText(input.scenario.id) || !hasText(input.scenario.rationale) || !Number.isFinite(input.scenario.confidence) || input.scenario.confidence < 0 || input.scenario.confidence > 1) blockers.push("SCENARIO_INVALID");
  for (const range of [input.scenario.estimatedBenefit, input.scenario.estimatedCost]) {
    if (range && (!Number.isFinite(range.min) || !Number.isFinite(range.max) || range.min < 0 || range.max < range.min || !/^[A-Z]{3}$/.test(range.currency))) blockers.push("SCENARIO_ESTIMATE_INVALID");
  }
  if (!nonEmpty(input.scope) || !unique(input.scope)) blockers.push("SCOPE_INCOMPLETE");
  if (!nonEmpty(input.deliverables) || !unique(input.deliverables)) blockers.push("DELIVERABLES_INCOMPLETE");
  if (!unique(input.exclusions)) blockers.push("EXCLUSIONS_DUPLICATED");
  if (input.dependencies.some(d => !hasText(d.description) || !["customer", "provider", "third_party"].includes(d.owner) || !["confirmed", "pending", "blocked"].includes(d.status))) blockers.push("DEPENDENCY_REGISTER_INVALID");
  if (input.dependencies.some(d => d.status !== "confirmed")) warnings.push("DEPENDENCIES_REQUIRE_CONFIRMATION");
  if (!input.responsibilities.some(r => r.party === "customer") || !input.responsibilities.some(r => r.party === "provider") || input.responsibilities.some(r => !hasText(r.description))) blockers.push("RESPONSIBILITIES_INCOMPLETE");
  if (!nonEmpty(input.acceptanceCriteria) || !unique(input.acceptanceCriteria)) blockers.push("ACCEPTANCE_CRITERIA_INCOMPLETE");
  if (!input.pricingLines.length) blockers.push("COMMERCIAL_MODEL_NOT_DEFINED");
  else {
    try { calculatePricing(input.pricingLines); }
    catch (error) { blockers.push(error instanceof Error ? error.message : "PRICING_INVALID"); }
  }
  if (input.deliveryWindowDays !== undefined && (!Number.isInteger(input.deliveryWindowDays) || input.deliveryWindowDays < 1)) blockers.push("DELIVERY_WINDOW_INVALID");
  if (input.deliveryWindowDays && input.deliveryWindowDays > 90) warnings.push("DELIVERY_WINDOW_EXCEEDS_FIRST_90_DAY_CYCLE");
  if (input.scenario.assumptions.length) warnings.push("SCENARIO_DEPENDS_ON_EXPLICIT_ASSUMPTIONS");
  if (input.scenario.risks.length) warnings.push("SCENARIO_HAS_DECLARED_RISKS");
  return Object.freeze({
    status: blockers.length ? "incomplete" : "ready_for_review",
    blockers: Object.freeze([...new Set(blockers)]),
    warnings: Object.freeze([...new Set(warnings)]),
  });
}

export function composeOutcomeProposal(input: OutcomeProposalInput, generatedAt = new Date()): OutcomeProposal {
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("PROPOSAL_GENERATION_DATE_INVALID");
  const readiness = assessProposalReadiness(input);
  let indicativeSummary: PricingSummary | undefined;
  if (input.pricingLines.length) {
    try { indicativeSummary = calculatePricing(input.pricingLines); }
    catch { /* Keep an incomplete proposal inspectable; readiness carries the blocking error. */ }
  }
  const base = {
    id: input.id,
    version: input.version,
    tenantId: input.tenantId,
    status: "draft" as const,
    generatedAt: input.generatedAt ?? generatedAt.toISOString(),
    customer: { name: input.customerName, sector: input.sector },
    context: input.context,
    problem: input.problem,
    desiredOutcome: input.desiredOutcome,
    diagnosisConfidence: input.diagnosisConfidence,
    evidence: input.evidence.map(e => ({ ...e })),
    metric: { ...input.metric, guardrails: [...input.metric.guardrails], exclusions: [...input.metric.exclusions] },
    scenario: { ...input.scenario, assumptions: [...input.scenario.assumptions], risks: [...input.scenario.risks] },
    scope: [...input.scope],
    deliverables: [...input.deliverables],
    exclusions: [...input.exclusions],
    dependencies: input.dependencies.map(d => ({ ...d })),
    responsibilities: input.responsibilities.map(r => ({ ...r })),
    acceptanceCriteria: [...input.acceptanceCriteria],
    pricing: {
      lines: input.pricingLines.map(line => ({ ...line })),
      ...(indicativeSummary ? { indicativeSummary } : {}),
    },
    ...(input.deliveryWindowDays !== undefined ? { deliveryWindowDays: input.deliveryWindowDays } : {}),
    readiness,
    commercialNotice: "Minuta preliminar para revisão. Estimativas e hipóteses não são resultados garantidos. Cobrança por resultado depende de baseline aprovado, fonte de verdade, período, atribuição, guardrails e evidências aceitas pelas partes.",
  };
  return Object.freeze(base);
}

const markdownText = (value: string): string => value.replace(/[\\\\`*_{}\[\]()#+.!|>~-]/g, "\\\\$&");
const bulletList = (values: readonly string[]): string => values.length ? values.map(value => "- " + markdownText(value)).join("\n") : "- A definir";

export function renderOutcomeProposalMarkdown(proposal: OutcomeProposal): string {
  const metric = proposal.metric;
  const range = (value: ProposalScenario["estimatedBenefit"]): string => value
    ? `${value.min}–${value.max} ${value.currency}`
    : "A definir";
  const evidence = proposal.evidence.map(item =>
    `- ${markdownText(item.description)} (fonte: ${markdownText(item.source)}; verificação: ${item.verification}; ID: ${markdownText(item.id)})`
  ).join("\n") || "- Nenhuma evidência registrada";
  const pricing = proposal.pricing.indicativeSummary
    ? `Total indicativo calculado: ${proposal.pricing.indicativeSummary.total} ${proposal.pricing.indicativeSummary.currency}`
    : "Preço ainda não calculável com os dados fornecidos";
  return [
    `# Proposta preliminar — ${markdownText(proposal.id)}`,
    `\n**Cliente:** ${markdownText(proposal.customer.name)}  \n**Setor:** ${markdownText(proposal.customer.sector)}  \n**Versão:** ${proposal.version}  \n**Status:** ${proposal.readiness.status === "ready_for_review" ? "Pronta para revisão humana" : "Incompleta — requer dados adicionais"}`,
    `\n## Contexto e objetivo\n\n${markdownText(proposal.context)}\n\n**Problema:** ${markdownText(proposal.problem)}\n\n**Resultado desejado:** ${markdownText(proposal.desiredOutcome)}\n\n**Confiança do diagnóstico:** ${proposal.diagnosisConfidence}`,
    `\n## Evidências\n\n${evidence}`,
    `\n## Métrica de resultado\n\n- Indicador: ${markdownText(metric.name)} (${markdownText(metric.id)})\n- Baseline: ${metric.baseline ?? "A definir"} ${markdownText(metric.unit)}\n- Meta: ${metric.target ?? "A definir"} ${markdownText(metric.unit)}\n- Período: ${metric.periodStart ?? "A definir"} a ${metric.periodEnd ?? "A definir"}\n- Fonte da verdade: ${markdownText(metric.sourceOfTruth ?? "A definir")}\n- População: ${markdownText(metric.population ?? "A definir")}\n- Atribuição: ${metric.attribution}`,
    `\n**Guardrails**\n\n${bulletList(metric.guardrails)}\n\n**Exclusões de medição**\n\n${bulletList(metric.exclusions)}`,
    `\n## Cenário recomendado\n\n${markdownText(proposal.scenario.rationale)}\n\n- Benefício estimado: ${range(proposal.scenario.estimatedBenefit)}\n- Custo estimado: ${range(proposal.scenario.estimatedCost)}\n- Confiança: ${proposal.scenario.confidence}\n\n**Hipóteses**\n\n${bulletList(proposal.scenario.assumptions)}\n\n**Riscos**\n\n${bulletList(proposal.scenario.risks)}`,
    `\n## Escopo e execução\n\n**Incluído**\n\n${bulletList(proposal.scope)}\n\n**Entregáveis**\n\n${bulletList(proposal.deliverables)}\n\n**Fora do escopo**\n\n${bulletList(proposal.exclusions)}`,
    `\n**Dependências**\n\n${proposal.dependencies.map(item => `- ${markdownText(item.description)} — responsável: ${item.owner}; status: ${item.status}`).join("\n") || "- Nenhuma declarada"}`,
    `\n**Responsabilidades**\n\n${proposal.responsibilities.map(item => `- ${item.party}: ${markdownText(item.description)}`).join("\n") || "- A definir"}`,
    `\n**Critérios de aceite**\n\n${bulletList(proposal.acceptanceCriteria)}`,
    `\n## Condições comerciais\n\n${pricing}\n\nModelos informados: ${proposal.pricing.lines.map(line => line.kind).join(", ") || "A definir"}.`,
    `\n## Pendências para revisão\n\n**Bloqueios**\n\n${bulletList(proposal.readiness.blockers)}\n\n**Alertas**\n\n${bulletList(proposal.readiness.warnings)}`,
    `\n---\n${proposal.commercialNotice}`,
  ].join("\n");
}

export interface ProposalContractDraftInput {
  proposal: OutcomeProposal;
  agreement: Agreement;
  parties: readonly ContractParty[];
  effectiveDate: string;
  expiryDate?: string;
  jurisdiction: string;
  approvedBy: string;
  deliveryPlan?: Readonly<Record<string, unknown>>;
  sla?: Readonly<Record<string, unknown>>;
  security?: Readonly<Record<string, unknown>>;
  dataProcessing?: Readonly<Record<string, unknown>>;
  sectorTerms?: Readonly<Record<string, unknown>>;
}

export function composeContractFromOutcomeProposal(input: ProposalContractDraftInput, generatedAt = new Date()): ContractPackage {
  const { proposal, agreement } = input;
  const readiness = assessProposalReadiness({
    id: proposal.id, version: proposal.version, tenantId: proposal.tenantId,
    customerName: proposal.customer.name, sector: proposal.customer.sector,
    context: proposal.context, problem: proposal.problem, desiredOutcome: proposal.desiredOutcome,
    diagnosisConfidence: proposal.diagnosisConfidence, evidence: proposal.evidence,
    metric: proposal.metric, scenario: proposal.scenario, scope: proposal.scope,
    deliverables: proposal.deliverables, exclusions: proposal.exclusions,
    dependencies: proposal.dependencies, responsibilities: proposal.responsibilities,
    acceptanceCriteria: proposal.acceptanceCriteria, pricingLines: proposal.pricing.lines,
    ...(proposal.deliveryWindowDays !== undefined ? { deliveryWindowDays: proposal.deliveryWindowDays } : {}),
    generatedAt: proposal.generatedAt,
  });
  if (readiness.status !== "ready_for_review") throw new Error("PROPOSAL_NOT_READY_FOR_CONTRACT:" + readiness.blockers.join(","));
  if (agreement.tenantId !== proposal.tenantId) throw new Error("PROPOSAL_CONTRACT_TENANT_MISMATCH");
  if (agreement.status !== "draft" && agreement.status !== "pending_approval") throw new Error("PROPOSAL_CONTRACT_AGREEMENT_NOT_DRAFT");
  if (!input.approvedBy.trim()) throw new Error("PROPOSAL_CONTRACT_APPROVAL_REQUIRED");
  const same = (left: readonly string[], right: readonly string[]) => left.length === right.length && left.every((value, index) => value === right[index]);
  if (!same(agreement.scope, proposal.scope) || !same(agreement.deliverables, proposal.deliverables) || !same(agreement.exclusions, proposal.exclusions)) {
    throw new Error("PROPOSAL_CONTRACT_SCOPE_MISMATCH");
  }
  const metric = proposal.metric;
  if (metric.baseline === undefined || metric.target === undefined || !metric.periodStart || !metric.periodEnd || !metric.sourceOfTruth || !metric.population || metric.attribution === "pending") {
    throw new Error("PROPOSAL_OUTCOME_SCHEDULE_INCOMPLETE");
  }
  if (metric.direction === "target") throw new Error("PROPOSAL_OUTCOME_DIRECTION_REQUIRED");
  const outcome: OutcomeSchedule = {
    metricId: metric.id,
    metricName: metric.name,
    unit: metric.unit,
    baseline: metric.baseline,
    target: metric.target,
    direction: metric.direction,
    population: metric.population,
    sourceOfTruth: metric.sourceOfTruth,
    periodStart: metric.periodStart,
    periodEnd: metric.periodEnd,
    attribution: metric.attribution,
    exclusions: [...metric.exclusions],
    guardrails: [...metric.guardrails],
    approvedBy: input.approvedBy,
  };
  const deliveryPlan = input.deliveryPlan ?? {
    deliveryWindowDays: proposal.deliveryWindowDays ?? null,
    dependencies: proposal.dependencies,
    responsibilities: proposal.responsibilities,
    assumptions: proposal.scenario.assumptions,
    risks: proposal.scenario.risks,
  };
  const acceptance = { criteria: proposal.acceptanceCriteria };
  return composeContract({
    agreement,
    parties: input.parties,
    effectiveDate: input.effectiveDate,
    ...(input.expiryDate ? { expiryDate: input.expiryDate } : {}),
    jurisdiction: input.jurisdiction,
    sector: proposal.customer.sector,
    projectName: proposal.desiredOutcome,
    pricingLines: proposal.pricing.lines,
    outcome,
    deliveryPlan,
    acceptance,
    ...(input.sla ? { sla: input.sla } : {}),
    ...(input.security ? { security: input.security } : {}),
    ...(input.dataProcessing ? { dataProcessing: input.dataProcessing } : {}),
    ...(input.sectorTerms ? { sectorTerms: input.sectorTerms } : {}),
  }, generatedAt);
}
