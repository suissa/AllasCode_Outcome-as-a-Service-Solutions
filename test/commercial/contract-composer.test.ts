import test from "node:test";
import assert from "node:assert/strict";
import { composeContract, renderContractMarkdown } from "../../src/commercial/contract-composer.ts";
import { calculatePricing } from "../../src/commercial/pricing.ts";
import type { Agreement } from "../../src/commercial/agreement.ts";
const agreement: Agreement = {
  id: "agreement_001", tenantId: "tenant_001", version: 1, status: "draft",
  scope: ["Automatizar conciliação de pedidos"], deliverables: ["Integração ERP", "Painel de indicadores"],
  exclusions: ["Substituição do ERP"], fees: [],
};
const parties = [
  { legalName: "Empresa Cliente Ltda.", representative: "Diretora Financeira", role: "customer" as const },
  { legalName: "OaaS.Quest Soluções Ltda.", representative: "Representante Legal", role: "provider" as const },
];
test("pricing supports fixed, usage, outcome, gain-share, revenue-share and SLA credits", () => {
  const result = calculatePricing([
    { id: "setup", label: "Implantação", kind: "fixed", currency: "BRL", amount: 5000 },
    { id: "events", label: "Eventos excedentes", kind: "usage", currency: "BRL", rate: 2, quantity: 1200, includedQuantity: 1000 },
    { id: "savings", label: "Economia", kind: "gain_share", currency: "BRL", rate: 0.1, eligibleValue: 10000, progress: 1 },
    { id: "growth", label: "Receita incremental", kind: "revenue_share", currency: "BRL", rate: 0.05, eligibleValue: 20000, progress: 0.5, cap: 1000 },
    { id: "sla", label: "Crédito SLA", kind: "sla_credit", currency: "BRL", rate: 0.1, eligibleValue: 5000, progress: 1 },
  ]);
  assert.equal(result.subtotal, 6900);
  assert.equal(result.credits, 500);
  assert.equal(result.total, 6400);
});
test("composer creates pricing, outcome and sector annexes with a reproducible fingerprint", () => {
  const input = {
    agreement, parties, effectiveDate: "2026-11-10", jurisdiction: "Brasil",
    sector: "varejo", projectName: "Redução de ruptura de estoque",
    pricingLines: [{ id: "base", label: "Operação", kind: "fixed" as const, currency: "BRL", amount: 2000 },
      { id: "gain", label: "Economia validada", kind: "gain_share" as const, currency: "BRL", rate: 0.08, eligibleValue: 10000, progress: 0.75 }],
    outcome: { metricId: "stockout_rate", metricName: "Taxa de ruptura", unit: "%", baseline: 12, target: 5, direction: "decrease" as const, population: "lojas participantes", sourceOfTruth: "ERP/WMS", periodStart: "2026-11-01", periodEnd: "2026-12-01", attribution: "contribution" as const, exclusions: ["lojas fechadas"], guardrails: ["não reduzir sortimento"], approvedBy: "customer_admin" },
    deliveryPlan: { phases: ["diagnóstico", "piloto", "expansão"] },
    acceptance: { required: ["dados reconciliados", "teste de integração"] },
    sla: { availability: "99.5%", creditCap: 0.1 },
    security: { access: "least privilege", audit: true },
    dataProcessing: { controller: "customer", processor: "provider", retentionDays: 90 },
    sectorTerms: { inventorySource: "WMS", humanApproval: true },
    clauses: [{ id: "result", title: "Resultado elegível", template: "Métrica {{metric}} medida em {{source}}.", variables: { metric: "taxa de ruptura", source: "ERP/WMS" } }],
  };
  const first = composeContract(input, new Date("2026-11-10T00:00:00.000Z"));
  const second = composeContract(input, new Date("2026-11-10T00:00:00.000Z"));
  assert.equal(first.fingerprint, second.fingerprint);
  assert.deepEqual(first.annexes.map(a => a.kind), ["scope", "pricing", "outcome", "delivery", "acceptance", "sla", "security", "data_processing", "sector_specific"]);
  assert.match(renderContractMarkdown(first), /Fingerprint SHA-256/);
  assert.match(renderContractMarkdown(first), /Métrica taxa de ruptura medida em ERP\/WMS/);
});
test("composer rejects missing parties, incomplete outcome schedule and unresolved clause variables", () => {
  const base = { agreement, parties, effectiveDate: "2026-11-10", jurisdiction: "Brasil", sector: "varejo", projectName: "Projeto", pricingLines: [{ id: "fixed", label: "Base", kind: "fixed" as const, currency: "BRL", amount: 100 }] };
  assert.throws(() => composeContract({ ...base, parties: [parties[0]!] }), /CONTRACT_PARTIES_INCOMPLETE/);
  assert.throws(() => composeContract({ ...base, clauses: [{ id: "x", title: "Cláusula", template: "{{missing}}", variables: {} }] }), /CONTRACT_CLAUSE_VARIABLE_MISSING/);
  assert.throws(() => composeContract({ ...base, outcome: { metricId: "m", metricName: "Métrica", unit: "%", baseline: 10, target: 10, direction: "decrease", population: "all", sourceOfTruth: "ERP", periodStart: "2026-11-01", periodEnd: "2026-12-01", attribution: "direct", exclusions: [], guardrails: [], approvedBy: "actor" } }), /CONTRACT_OUTCOME_SCHEDULE_INVALID/);
});
test("composer rejects active agreements and cross-currency price lines", () => {
  const base = { agreement: { ...agreement, status: "active" as const }, parties, effectiveDate: "2026-11-10", jurisdiction: "Brasil", sector: "varejo", projectName: "Projeto", pricingLines: [{ id: "a", label: "A", kind: "fixed" as const, currency: "BRL", amount: 100 }] };
  assert.throws(() => composeContract(base), /CONTRACT_AGREEMENT_NOT_DRAFT/);
  assert.throws(() => calculatePricing([{ id: "a", label: "A", kind: "fixed", currency: "BRL", amount: 10 }, { id: "b", label: "B", kind: "fixed", currency: "USD", amount: 10 }]), /PRICING_CURRENCY_MISMATCH/);
});
