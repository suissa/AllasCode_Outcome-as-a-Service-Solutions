import test from "node:test";
import assert from "node:assert/strict";
import { mapDiscoveryToOutcomeProposal } from "../../src/application/discovery-proposal.ts";

const snapshot = {
  source: "guilda",
  missionId: "mission_123",
  answers: {
    company_name: { value: "Mercado Exemplo" },
    segment: { value: "retail" },
    team_size: { value: "6_15" },
    main_goal: { value: "sales" },
    goal_target: { value: "Aumentar vendas em 15%" },
    sales_process: { value: "Venda presencial e WhatsApp" },
    primary_kpi: { value: "conversion" },
    baseline_value: { value: "12%" },
    target_value: { value: "18%" },
    measurement_source: { value: "system" },
    operational_bottleneck: { value: "service" },
    top_priority: { value: "conversion" },
    integration: { value: "partial" },
    channels: { value: ["store", "whatsapp"] },
    unknown_field: { value: null, status: "unknown" as const },
  },
};

test("maps Discovery context while keeping ambiguous numeric answers and evidence pending", () => {
  const result = mapDiscoveryToOutcomeProposal(snapshot, {
    tenantId: "tenant_001", proposalId: "proposal_001", version: 1,
  }, new Date("2026-11-10T12:00:00.000Z"));
  assert.equal(result.proposal.customer.name, "Mercado Exemplo");
  assert.equal(result.proposal.customer.sector, "Comércio");
  assert.equal(result.proposal.desiredOutcome, "Aumentar vendas em 15%");
  assert.equal(result.proposal.metric.id, "conversion");
  assert.equal(result.proposal.metric.baseline, undefined);
  assert.equal(result.proposal.metric.target, undefined);
  assert.equal(result.proposal.metric.attribution, "pending");
  assert.equal(result.proposal.evidence.length, 0);
  assert.equal(result.proposal.readiness.status, "incomplete");
  assert.ok(result.unmapped.includes("baseline_value"));
  assert.ok(result.unmapped.includes("evidence"));
  assert.equal(result.source.kind, "guilda");
  assert.equal(result.source.missionId, "mission_123");
});

test("accepts strict numeric values but does not invent a measurement source from a category", () => {
  const numericSnapshot = {
    ...snapshot,
    answers: {
      ...snapshot.answers,
      baseline_value: { value: 12 },
      target_value: { value: 18 },
    },
  };
  const result = mapDiscoveryToOutcomeProposal(numericSnapshot, {
    tenantId: "tenant_001", proposalId: "proposal_002", version: 1,
    metric: { unit: "%", direction: "increase", periodStart: "2026-11-10", periodEnd: "2027-02-08", population: "Leads das duas lojas" },
  });
  assert.equal(result.proposal.metric.baseline, 12);
  assert.equal(result.proposal.metric.target, 18);
  assert.equal(result.proposal.metric.sourceOfTruth, undefined);
  assert.ok(result.unmapped.includes("metric.sourceOfTruth"));
});

test("can produce a review-ready draft when required enrichment is explicitly supplied", () => {
  const readySnapshot = { ...snapshot, answers: { ...snapshot.answers, baseline_value: { value: 12 }, target_value: { value: 18 } } };
  const result = mapDiscoveryToOutcomeProposal(readySnapshot, {
    tenantId: "tenant_001", proposalId: "proposal_003", version: 1,
    metric: {
      unit: "%", direction: "increase", periodStart: "2026-11-10", periodEnd: "2027-02-08",
      sourceOfTruth: "CRM reconciliado com vendas do ERP", population: "Leads recebidos nas duas lojas",
      attribution: "contribution", guardrails: ["Não reduzir ticket médio"], exclusions: ["Leads duplicados"],
    },
    scenario: { id: "scenario_001", rationale: "Instrumentar funil e testar acompanhamento de leads", confidence: 0.65, assumptions: ["CRM permite exportação"], risks: ["Dados históricos incompletos"] },
    evidence: [{ id: "evidence_001", description: "Exportação histórica do CRM", source: "CRM", verification: "verified" }],
    scope: ["Instrumentar origem e status dos leads", "Testar acompanhamento de oportunidades"],
    deliverables: ["Painel de conversão", "Relatório de piloto"],
    dependencies: [{ description: "Acesso de leitura ao CRM", owner: "customer", status: "confirmed" }],
    responsibilities: [
      { party: "customer", description: "Disponibilizar dados e validar o funil." },
      { party: "provider", description: "Configurar instrumentação e acompanhar o piloto." },
    ],
    acceptanceCriteria: ["Eventos reconciliados com o CRM", "Painel validado pelo cliente"],
    pricingLines: [{ id: "setup", label: "Implantação", kind: "fixed", currency: "BRL", amount: 2500 }],
    deliveryWindowDays: 90,
  }, new Date("2026-11-10T12:00:00.000Z"));
  assert.equal(result.proposal.readiness.status, "ready_for_review");
  assert.deepEqual(result.proposal.readiness.blockers, []);
  assert.ok(result.proposal.readiness.warnings.includes("SCENARIO_DEPENDS_ON_EXPLICIT_ASSUMPTIONS"));
  assert.equal(result.proposal.pricing.indicativeSummary?.total, 2500);
});

test("rejects invalid identity and generation timestamps", () => {
  assert.throws(() => mapDiscoveryToOutcomeProposal(snapshot, {
    tenantId: "", proposalId: "proposal_004", version: 1,
  }), /DISCOVERY_PROPOSAL_IDENTITY_INVALID/);
  assert.throws(() => mapDiscoveryToOutcomeProposal(snapshot, {
    tenantId: "tenant_001", proposalId: "proposal_004", version: 1,
  }, new Date("invalid")), /DISCOVERY_PROPOSAL_CLOCK_INVALID/);
});

test("does not reuse a stale value marked unknown and reports missing company context", () => {
  const stale = {
    source: "discovery",
    answers: {
      company_name: { value: "Nome antigo", status: "unknown" as const },
      segment: { value: "retail", status: "unknown" as const },
      goal_target: { value: "Objetivo anterior", status: "unknown" as const },
      baseline_value: { value: 10, status: "unknown" as const },
    },
  };
  const result = mapDiscoveryToOutcomeProposal(stale, {
    tenantId: "tenant_001", proposalId: "proposal_005", version: 1,
  });
  assert.equal(result.proposal.customer.name, "");
  assert.equal(result.proposal.customer.sector, "");
  assert.equal(result.proposal.desiredOutcome, "");
  assert.equal(result.proposal.metric.baseline, undefined);
  assert.ok(result.unmapped.includes("company_name"));
  assert.ok(result.unmapped.includes("segment"));
});
