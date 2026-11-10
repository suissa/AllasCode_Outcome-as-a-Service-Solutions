import test from "node:test";
import assert from "node:assert/strict";
import { assessProposalReadiness, composeContractFromOutcomeProposal, composeOutcomeProposal, renderOutcomeProposalMarkdown, type OutcomeProposalInput } from "../../src/commercial/proposal.ts";

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
  const markdown = renderOutcomeProposalMarkdown(proposal);
  assert.match(markdown, /## Métrica de resultado/);
  assert.match(markdown, /Baseline: 12 %/);
  assert.match(markdown, /não são resultados garantidos/);
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

test("rejects a malformed proposal timestamp without losing the draft", () => {
  const proposal = composeOutcomeProposal({ ...valid, generatedAt: "not-a-date" });
  assert.equal(proposal.readiness.status, "incomplete");
  assert.ok(proposal.readiness.blockers.includes("PROPOSAL_TIMESTAMP_INVALID"));
});

test("requires a valid generation clock", () => {
  assert.throws(() => composeOutcomeProposal(valid, new Date("invalid")), /PROPOSAL_GENERATION_DATE_INVALID/);
});

test("creates a contract draft from a review-ready proposal after explicit approval", () => {
  const proposal = composeOutcomeProposal(valid, new Date("2026-11-10T12:00:00.000Z"));
  const contract = composeContractFromOutcomeProposal({
    proposal,
    agreement: {
      id: "agreement_001", tenantId: "tenant_001", version: 1, status: "draft",
      scope: [...proposal.scope], deliverables: [...proposal.deliverables], exclusions: [...proposal.exclusions], fees: [],
    },
    parties: [
      { legalName: "Cliente Exemplo Ltda.", representative: "Diretora", role: "customer" },
      { legalName: "OaaS.Quest", representative: "Representante", role: "provider" },
    ],
    effectiveDate: "2026-11-10",
    jurisdiction: "Brasil",
    approvedBy: "customer_admin",
  }, new Date("2026-11-10T12:00:00.000Z"));
  assert.equal(contract.status, "draft");
  assert.equal(contract.tenantId, proposal.tenantId);
  assert.ok(contract.annexes.some(annex => annex.kind === "outcome"));
  assert.ok(contract.annexes.some(annex => annex.kind === "acceptance"));
});

test("blocks contract composition when proposal is incomplete or agreement scope diverges", () => {
  const proposal = composeOutcomeProposal({ ...valid, metric: { ...valid.metric, attribution: "pending" } });
  const agreement = {
    id: "agreement_001", tenantId: "tenant_001", version: 1, status: "draft" as const,
    scope: [...valid.scope], deliverables: [...valid.deliverables], exclusions: [...valid.exclusions], fees: [],
  };
  const parties = [
    { legalName: "Cliente Exemplo Ltda.", representative: "Diretora", role: "customer" as const },
    { legalName: "OaaS.Quest", representative: "Representante", role: "provider" as const },
  ];
  assert.throws(() => composeContractFromOutcomeProposal({
    proposal, agreement, parties, effectiveDate: "2026-11-10", jurisdiction: "Brasil", approvedBy: "customer_admin",
  }), /PROPOSAL_NOT_READY_FOR_CONTRACT/);
  const forgedReady = { ...proposal, readiness: { status: "ready_for_review" as const, blockers: [], warnings: [] } };
  assert.throws(() => composeContractFromOutcomeProposal({
    proposal: forgedReady, agreement, parties, effectiveDate: "2026-11-10", jurisdiction: "Brasil", approvedBy: "customer_admin",
  }), /PROPOSAL_NOT_READY_FOR_CONTRACT/);
  const ready = composeOutcomeProposal(valid);
  assert.throws(() => composeContractFromOutcomeProposal({
    proposal: ready, agreement: { ...agreement, scope: ["Outro escopo"] }, parties,
    effectiveDate: "2026-11-10", jurisdiction: "Brasil", approvedBy: "customer_admin",
  }), /PROPOSAL_CONTRACT_SCOPE_MISMATCH/);
});
