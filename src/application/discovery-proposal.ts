import type {
  OutcomeProposal,
  OutcomeProposalInput,
  ProposalDependency,
  ProposalEvidence,
  ProposalMetric,
  ProposalResponsibility,
  ProposalScenario,
} from "../commercial/proposal.ts";
import { composeOutcomeProposal } from "../commercial/proposal.ts";

export interface DiscoveryAnswer {
  value: unknown;
  status?: "provided" | "unknown";
  source?: string;
  updatedAt?: string;
}
export interface DiscoverySnapshot {
  answers: Readonly<Record<string, DiscoveryAnswer>>;
  source?: string;
  missionId?: string;
  updatedAt?: string;
}
export interface DiscoveryProposalOptions {
  tenantId: string;
  proposalId: string;
  version: number;
  generatedAt?: string;
  metric?: {
    unit?: string;
    direction?: ProposalMetric["direction"];
    periodStart?: string;
    periodEnd?: string;
    sourceOfTruth?: string;
    population?: string;
    attribution?: ProposalMetric["attribution"];
    guardrails?: readonly string[];
    exclusions?: readonly string[];
  };
  scenario?: Partial<ProposalScenario>;
  evidence?: readonly ProposalEvidence[];
  scope?: readonly string[];
  deliverables?: readonly string[];
  exclusions?: readonly string[];
  dependencies?: readonly ProposalDependency[];
  responsibilities?: readonly ProposalResponsibility[];
  acceptanceCriteria?: readonly string[];
  pricingLines?: OutcomeProposalInput["pricingLines"];
  deliveryWindowDays?: number;
}
export interface DiscoveryProposalBridgeResult {
  proposal: OutcomeProposal;
  source: { kind: string; missionId?: string; answerCount: number; knownAnswerCount: number };
  unmapped: readonly string[];
}

const text = (value: unknown): string | undefined =>
  typeof value === "string" && value.trim() ? value.trim() : undefined;
const numeric = (value: unknown): number | undefined => {
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value !== "string" || !/^-?(?:0|[1-9]\d*)(?:\.\d+)?$/.test(value.trim())) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};
const values = (snapshot: DiscoverySnapshot) => Object.fromEntries(
  Object.entries(snapshot.answers).map(([key, answer]) => [key, answer?.status === "unknown" ? undefined : answer?.value]),
);
const SECTORS: Record<string, string> = {
  retail: "Comércio", services: "Serviços", industry: "Indústria",
  technology: "Tecnologia", food: "Alimentação", health: "Saúde", other: "Outro setor",
};
const GOALS: Record<string, string> = {
  sales: "Aumentar vendas", profit: "Aumentar lucro", cost: "Reduzir custos",
  productivity: "Aumentar produtividade", service: "Melhorar atendimento",
  automation: "Automatizar processos", expansion: "Expandir operação",
  retention: "Melhorar retenção", other: "Resultado a detalhar",
};
const METRICS: Record<string, string> = {
  revenue: "Receita", profit: "Lucro", sales_count: "Quantidade de vendas",
  ticket: "Ticket médio", conversion: "Taxa de conversão", retention: "Retenção",
  cost: "Custo", productivity: "Produtividade", satisfaction: "Satisfação",
  other: "Indicador a definir",
};
const BOTTLENECKS: Record<string, string> = {
  service: "Atendimento", overload: "Sobrecarga operacional", process: "Processos",
  information: "Informação e visibilidade", people: "Pessoas", other: "Outro",
};
const SOURCES: Record<string, string> = {
  system: "Sistema operacional (fonte específica pendente)",
  finance: "Sistema financeiro/contábil (fonte específica pendente)",
  analytics: "Ferramenta de analytics (fonte específica pendente)",
  survey: "Pesquisa (instrumento específico pendente)",
  manual: "Registro manual (método de coleta pendente)",
};
function knownAnswerCount(answers: Readonly<Record<string, DiscoveryAnswer>>): number {
  return Object.values(answers).filter(answer =>
    answer?.status !== "unknown" && answer?.value !== null && answer?.value !== undefined && answer?.value !== "",
  ).length;
}

/**
 * Converts a browser Discovery snapshot into an explicitly incomplete proposal draft.
 * Only enrichment supplied by a reviewer may establish evidence, measurement rules,
 * scope, delivery commitments or commercial terms.
 */
export function mapDiscoveryToOutcomeProposal(
  snapshot: DiscoverySnapshot,
  options: DiscoveryProposalOptions,
  generatedAt = new Date(),
): DiscoveryProposalBridgeResult {
  if (!snapshot || typeof snapshot !== "object" || !snapshot.answers || typeof snapshot.answers !== "object") {
    throw new Error("DISCOVERY_SNAPSHOT_INVALID");
  }
  if (!options.tenantId.trim() || !options.proposalId.trim() || !Number.isInteger(options.version) || options.version < 1) {
    throw new Error("DISCOVERY_PROPOSAL_IDENTITY_INVALID");
  }
  if (!Number.isFinite(generatedAt.getTime())) throw new Error("DISCOVERY_PROPOSAL_CLOCK_INVALID");

  const answer = values(snapshot);
  const company = text(answer.company_name) ?? "";
  const sector = SECTORS[String(answer.segment)] ?? "";
  const goal = text(answer.goal_target) ?? GOALS[String(answer.main_goal)] ?? "";
  const priority = text(answer.top_priority);
  const bottleneck = BOTTLENECKS[String(answer.operational_bottleneck)] ?? text(answer.operational_bottleneck);
  const problem = [priority ? "Prioridade declarada: " + priority : "", bottleneck ? "Dificuldade operacional declarada: " + bottleneck : ""]
    .filter(Boolean).join(". ");
  const contextParts = [
    text(answer.business_model) ? "Modelo comercial: " + text(answer.business_model) : "",
    text(answer.sales_mode) ? "Canais de venda: " + text(answer.sales_mode) : "",
    text(answer.team_size) ? "Tamanho da equipe: " + text(answer.team_size) : "",
    text(answer.systems) ? "Ferramentas: " + text(answer.systems) : "",
    text(answer.integration) ? "Integração de sistemas: " + text(answer.integration) : "",
    text(answer.sales_process) ? "Processo comercial: " + text(answer.sales_process) : "",
    text(answer.goal_deadline) ? "Horizonte desejado: " + text(answer.goal_deadline) : "",
  ].filter(Boolean);
  const metricId = text(answer.primary_kpi) ?? "metric_pending";
  const baseline = numeric(answer.baseline_value);
  const target = numeric(answer.target_value);
  const metricOptions = options.metric ?? {};
  const metric: ProposalMetric = {
    id: metricId,
    name: METRICS[metricId] ?? metricId,
    unit: metricOptions.unit ?? "",
    direction: metricOptions.direction ?? "target",
    ...(baseline !== undefined ? { baseline } : {}),
    ...(target !== undefined ? { target } : {}),
    ...(metricOptions.periodStart ? { periodStart: metricOptions.periodStart } : {}),
    ...(metricOptions.periodEnd ? { periodEnd: metricOptions.periodEnd } : {}),
    ...(metricOptions.sourceOfTruth ? { sourceOfTruth: metricOptions.sourceOfTruth } : {}),
    ...(metricOptions.population ? { population: metricOptions.population } : {}),
    attribution: metricOptions.attribution ?? "pending",
    guardrails: [...(metricOptions.guardrails ?? [])],
    exclusions: [...(metricOptions.exclusions ?? [])],
  };
  const scenario: ProposalScenario = {
    id: options.scenario?.id ?? "scenario_pending",
    rationale: options.scenario?.rationale ?? "",
    confidence: options.scenario?.confidence ?? 0,
    ...(options.scenario?.estimatedBenefit ? { estimatedBenefit: options.scenario.estimatedBenefit } : {}),
    ...(options.scenario?.estimatedCost ? { estimatedCost: options.scenario.estimatedCost } : {}),
    assumptions: [...(options.scenario?.assumptions ?? [])],
    risks: [...(options.scenario?.risks ?? [])],
  };
  const evidence = [...(options.evidence ?? [])];
  const dependencies = [...(options.dependencies ?? [])];
  const responsibilities = [...(options.responsibilities ?? [])];
  const scope = [...(options.scope ?? [])];
  const deliverables = [...(options.deliverables ?? [])];
  const exclusions = [...(options.exclusions ?? [])];
  const acceptanceCriteria = [...(options.acceptanceCriteria ?? [])];
  const pricingLines = [...(options.pricingLines ?? [])];
  const unmapped = [
    ...(baseline === undefined ? ["baseline_value"] : []),
    ...(target === undefined ? ["target_value"] : []),
    ...(!metricOptions.unit ? ["metric.unit"] : []),
    ...(!metricOptions.sourceOfTruth ? ["metric.sourceOfTruth"] : []),
    ...(!metricOptions.periodStart || !metricOptions.periodEnd ? ["metric.period"] : []),
    ...(!metricOptions.population ? ["metric.population"] : []),
    ...(!metricOptions.guardrails?.length ? ["metric.guardrails"] : []),
    ...(!evidence.length ? ["evidence"] : []),
    ...(!scope.length ? ["scope"] : []),
    ...(!deliverables.length ? ["deliverables"] : []),
    ...(!dependencies.length ? ["dependencies"] : []),
    ...(!responsibilities.length ? ["responsibilities"] : []),
    ...(!acceptanceCriteria.length ? ["acceptanceCriteria"] : []),
    ...(!pricingLines.length ? ["pricingLines"] : []),
  ];
  const input: OutcomeProposalInput = {
    id: options.proposalId,
    version: options.version,
    tenantId: options.tenantId,
    customerName: company,
    sector,
    context: contextParts.join("; "),
    problem,
    desiredOutcome: goal,
    diagnosisConfidence: 0,
    evidence,
    metric,
    scenario,
    scope,
    deliverables,
    exclusions,
    dependencies,
    responsibilities,
    acceptanceCriteria,
    pricingLines,
    ...(options.deliveryWindowDays !== undefined ? { deliveryWindowDays: options.deliveryWindowDays } : {}),
    ...(options.generatedAt ? { generatedAt: options.generatedAt } : {}),
  };
  const proposal = composeOutcomeProposal(input, generatedAt);
  return Object.freeze({
    proposal,
    source: Object.freeze({
      kind: snapshot.source ?? "discovery",
      ...(snapshot.missionId ? { missionId: snapshot.missionId } : {}),
      answerCount: Object.keys(snapshot.answers).length,
      knownAnswerCount: knownAnswerCount(snapshot.answers),
    }),
    unmapped: Object.freeze(unmapped),
  });
}
