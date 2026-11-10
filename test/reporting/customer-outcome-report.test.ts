import test from "node:test";
import assert from "node:assert/strict";
import {
  buildCustomerOutcomeReport,
  renderCustomerOutcomeReport,
  CustomerReportError,
} from "../../src/reporting/report.ts";
import type { EvidenceRecord } from "../../src/evidence/evidence.ts";

const now = new Date("2026-11-10T12:00:00.000Z");
const evidence: EvidenceRecord[] = [
  { id: "ev_public", tenantId: "tenant_a", sourceId: "crm", capturedAt: "2026-11-10T11:00:00.000Z", contentHash: "a".repeat(64), classification: "public" },
  { id: "ev_private", tenantId: "tenant_a", sourceId: "erp", capturedAt: "2026-11-10T11:00:00.000Z", contentHash: "b".repeat(64), classification: "confidential", verifiedBy: "auditor", verifiedAt: "2026-11-10T11:30:00.000Z" },
];
const input = {
  id: "report_a1",
  tenantId: "tenant_a",
  outcomeId: "outcome_a1",
  metric: { id: "appointment_wait", name: "Tempo de confirmação", unit: "minutos" },
  period: { start: "2026-10-01", end: "2026-10-31" },
  result: { baseline: 120, target: 30, observed: 24, absoluteChange: -96, targetProgress: 1, confidence: 0.92, achieved: true },
  evidenceIds: ["ev_public", "ev_private"],
  methodology: "Comparação direta da média diária; mesma população e janela.",
  attribution: "Contribuição estimada; outras mudanças operacionais podem influenciar o resultado.",
  limitations: ["A janela não cobre sazonalidade anual."],
  guardrails: [{ name: "Taxa de cancelamento", status: "within_limit" as const, observed: "2.1%", limit: "3%" }],
};
const access = { tenantId: "tenant_a", actorId: "customer_1", purpose: "customer_outcome_report", allowedClassifications: ["public", "confidential"] as const };
const signer = async (item: EvidenceRecord, expiresAt: string) =>
  `https://evidence.example.test/${item.id}?expires=${encodeURIComponent(expiresAt)}`;

test("builds a deterministic customer report with scoped expiring evidence links", async () => {
  const report = await buildCustomerOutcomeReport(input, evidence, access, signer, now);
  assert.equal(report.metric.name, input.metric.name);
  assert.equal(report.result.achieved, true);
  assert.equal(report.evidenceLinks.length, 2);
  assert.ok(report.evidenceLinks.every(link => Date.parse(link.expiresAt) === now.getTime() + 15 * 60_000));
  assert.ok(Object.isFrozen(report));
  assert.ok(Object.isFrozen(report.evidenceLinks));
});

test("rejects duplicate evidence identifiers before invoking the signer", async () => {
  let calls = 0;
  await assert.rejects(
    () => buildCustomerOutcomeReport({ ...input, evidenceIds: ["ev_public", "ev_public"] }, evidence, access, async () => { calls++; return "https://evidence.example.test/x"; }, now),
    (error: unknown) => error instanceof CustomerReportError && error.code === "REPORT_EVIDENCE_DUPLICATE" && error.path === "evidenceIds",
  );
  assert.equal(calls, 0);
});

test("rejects cross-tenant, unauthorized, expired and unverified evidence without signing", async () => {
  let calls = 0;
  const sign = async () => { calls++; return "https://evidence.example.test/x"; };
  await assert.rejects(() => buildCustomerOutcomeReport(input, [{ ...evidence[0]!, tenantId: "tenant_b" }, evidence[1]!], access, sign, now), /REPORT_EVIDENCE_NOT_FOUND/);
  await assert.rejects(() => buildCustomerOutcomeReport(input, evidence, { ...access, allowedClassifications: ["public"] }, sign, now), /REPORT_EVIDENCE_ACCESS_DENIED/);
  await assert.rejects(() => buildCustomerOutcomeReport(input, [{ ...evidence[0]!, validUntil: "2026-11-10T11:59:00.000Z" }, evidence[1]!], access, sign, now), /REPORT_EVIDENCE_ACCESS_DENIED/);
  const { verifiedBy: _verifiedBy, verifiedAt: _verifiedAt, ...unverifiedEvidence } = evidence[1]!;
  await assert.rejects(() => buildCustomerOutcomeReport(input, [unverifiedEvidence, evidence[0]!], access, sign, now), /REPORT_EVIDENCE_ACCESS_DENIED/);
  assert.equal(calls, 0);
});

test("rejects malformed result, metric, period, methodology and unsafe signed links", async () => {
  await assert.rejects(() => buildCustomerOutcomeReport({ ...input, result: { ...input.result, confidence: 1.2 } }, evidence, access, signer, now), /REPORT_RESULT_INVALID/);
  await assert.rejects(() => buildCustomerOutcomeReport({ ...input, period: { start: "2026-11-01", end: "2026-10-01" } }, evidence, access, signer, now), /REPORT_PERIOD_INVALID/);
  await assert.rejects(() => buildCustomerOutcomeReport({ ...input, methodology: " " }, evidence, access, signer, now), /REPORT_METHOD_REQUIRED/);
  await assert.rejects(() => buildCustomerOutcomeReport(input, evidence, access, async () => "http://unsafe.example.test/x", now), /REPORT_EVIDENCE_LINK_INVALID/);
  await assert.rejects(() => buildCustomerOutcomeReport(input, evidence, access, async () => "https://user:pass@evidence.example.test/x", now), /REPORT_EVIDENCE_LINK_INVALID/);
});

test("renders customer-safe Markdown with escaped untrusted text and explicit attribution limits", async () => {
  const report = await buildCustomerOutcomeReport({ ...input, metric: { ...input.metric, name: "Vendas <script>alert(1)</script>" } }, evidence, access, signer, now);
  const markdown = renderCustomerOutcomeReport(report);
  assert.match(markdown, /Resultado alcançado/);
  assert.match(markdown, /Contribuição estimada/);
  assert.match(markdown, /&lt;script&gt;/);
  assert.match(markdown, /ev_public/);
  assert.doesNotMatch(markdown, /<script>/);
  assert.match(markdown, /não constitui prova causal/);
});

test("renderer rejects incomplete or mutated report structures", () => {
  assert.throws(() => renderCustomerOutcomeReport({ ...input, generatedAt: "invalid" } as never), /REPORT_DOCUMENT_INVALID/);
});
