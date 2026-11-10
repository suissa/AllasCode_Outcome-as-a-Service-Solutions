import test from "node:test";
import assert from "node:assert/strict";
import { assessProposalReadiness, composeOutcomeProposal, type OutcomeProposalInput } from "../../src/commercial/proposal.ts";

const valid: OutcomeProposalInput = {
  id: "proposal_001",
  version: 1,
  tenantId: "tenant_001",
  customerName: "Cliente Exemplo Ltda.",
  sector: "varejo",
  context: "Operação com duas lojas e estoque centralizado.",
  problem: "Rupturas frequentes reduzem vendas e dificultam reposição.",
  desiredOutcome: "Reduzir a taxa de ruptura sem elevar o estoque médio.",
  diagnosisConfidence: 0.82,
  evidence: [{ id: "ev_sales", description: "Histórico de vendas", source: "ERP", period: "2026-Q3", verification: "verified" }],
  metric: {
    id: "stockout_rate", name: "Taxa de ruptura", unit: "%", direction: "decrease",
    baseline: 12, target: 7, periodStart: "2026-11-10", periodEnd: "2027-02-08",
    sourceOfTruth: "ERP/WMS reconciliado", population: "Duas lojas participantes",
    attribution: "contribution", guardrails: ["Não reduzir sortimento", "Não elevar estoque médio"],
    exclusions: ["Produtos descontinuados"],
  },
  scenario: {
    id: "scenario_pilot", rationale: "Piloto com previsão de demanda e alertas de reposição.",
    confidence: 0.7, estimatedBenefit: { min: 12000, max: 24000, currency: "BRL" },
    estimatedCost: { min: 5000, max: 8000, currency: "BRL" },
    assumptions: ["Histórico de estoque disponível por loja"], risks: ["Qualidade do cadastro de produtos"],
  },
  scope: ["Instrumentar ruptura por loja e produto", "Executar piloto de reposição assistida"],
  deliverables: ["Painel de ruptura", "Alertas de reposição", "Relatório de validação"],
  exclusions: ["Substituição do ERP"],
  dependencies: [{ description: "Acesso de leitura ao ERP", owner: "customer", status: "confirmed" }],
  responsibilities: [
    { party: "customer", description: "Disponibilizar dados e validar regras comerciais." },
    { party: "provider", description: "Implementar integração, painel e acompanhamento." },
  ],
  acceptanceCriteria: ["Métricas reconciliadas com o ERP", "Alertas testados em ambiente piloto"],
  pricingLines: [
    { id: "setup", label: "Implantação", kind: "fixed", currency: "BRL", amount: 5000 },
    { id: "gain", label: "Economia validada", kind: "gain_share", currency: "BRL", rate: 0.08, eligibleValue: 10000, progress: 0.5 },
  ],
  deliveryWindowDays: 90,
};

test("composes a review-ready proposal without treating estimates as guarantees", () => {
  const proposal = composeOutcomeProposal(valid, new Date("2026-11-10T12:00:00.000Z"));
  assert.equal(proposal.status, "draft");
  assert.equal(proposal.readiness.status, "ready_for_review");
  assert.deepEqual(proposal.readiness.blockers, []);
  assert.ok(proposal.pricing.indicativeSummary);
  assert.match(proposal.commercialNotice, /não são resultados garantidos/);
  assert.equal(proposal.metric.baseline, 12);
  assert.equal(proposal.metric.target, 7);
  assert.equal(proposal.pricing.indicativeSummary?.total, 5400);
});

test("keeps incomplete discovery inspectable and blocks outcome fee readiness", () => {
  const { baseline: _baseline, sourceOfTruth: _sourceOfTruth, ...metricWithoutBaseline } = valid.metric;
  const incomplete: OutcomeProposalInput = {
    ...valid,
    metric: { ...metricWithoutBaseline, attribution: "pending" },
    evidence: [{ ...valid.evidence[0]!, verification: "pending" }],
    pricingLines: [],
  };
  const readiness = assessProposalReadiness(incomplete);
  assert.equal(readiness.status, "incomplete");
  assert.ok(readiness.blockers.includes("BASELINE_NOT_ESTABLISHED"));
  assert.ok(readiness.blockers.includes("SOURCE_OF_TRUTH_NOT_DEFINED"));
  assert.ok(readiness.blockers.includes("ATTRIBUTION_METHOD_PENDING"));
  assert.ok(readiness.blockers.includes("COMMERCIAL_MODEL_NOT_DEFINED"));
  assert.ok(readiness.warnings.includes("NO_INDEPENDENTLY_VERIFIED_EVIDENCE"));
});

test("rejects malformed price lines and invalid scenario estimates", () => {
  const malformed: OutcomeProposalInput = {
    ...valid,
    scenario: { ...valid.scenario, estimatedBenefit: { min: 100, max: 10, currency: "BRL" } },
    pricingLines: [{ id: "bad", label: "Preço inválido", kind: "fixed", currency: "BRL", amount: -1 }],
  };
  const readiness = assessProposalReadiness(malformed);
  assert.ok(readiness.blockers.includes("SCENARIO_ESTIMATE_INVALID"));
  assert.ok(readiness.blockers.some(code => code.includes("PRICING")));
});

test("requires a valid generation clock", () => {
  assert.throws(() => composeOutcomeProposal(valid, new Date("invalid")), /PROPOSAL_GENERATION_DATE_INVALID/);
});
