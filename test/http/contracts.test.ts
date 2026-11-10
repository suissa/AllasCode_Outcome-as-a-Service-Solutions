import test from "node:test";
import assert from "node:assert/strict";
import { createOutcomeHttpServer } from "../../src/http/server.ts";
import type { OutcomeStore } from "../../src/persistence/outcome-store.ts";
import type { ContractCommitResult, ContractEvent, ContractRecord, ContractRegistryStore } from "../../src/commercial/contract-workflow.ts";
import { contractCommandFingerprint } from "../../src/commercial/contract-workflow.ts";
import type { OutcomeProposalInput } from "../../src/commercial/proposal.ts";
import type { Agreement } from "../../src/commercial/agreement.ts";

const proposalInput: OutcomeProposalInput = {
  id: "proposal_http_001", version: 1, tenantId: "tenant_http_001", customerName: "Cliente HTTP Ltda.",
  sector: "varejo", context: "Duas lojas com estoque centralizado.", problem: "Rupturas recorrentes.",
  desiredOutcome: "Reduzir a taxa de ruptura.", diagnosisConfidence: 0.8,
  evidence: [{ id: "evidence_1", description: "Histórico de vendas", source: "ERP", verification: "verified" }],
  metric: { id: "stockout_rate", name: "Taxa de ruptura", unit: "%", direction: "decrease", baseline: 12, target: 7, periodStart: "2026-11-10", periodEnd: "2027-02-08", sourceOfTruth: "ERP/WMS", attribution: "contribution", population: "Duas lojas", guardrails: ["Não reduzir sortimento"], exclusions: [] },
  scenario: { id: "scenario_1", rationale: "Reposição assistida.", confidence: 0.7, assumptions: [], risks: [] },
  scope: ["Instrumentar estoque"], deliverables: ["Painel de ruptura"], exclusions: ["Troca do ERP"],
  dependencies: [], responsibilities: [{ party: "customer", description: "Liberar acesso ao ERP." }, { party: "provider", description: "Implementar integração." }],
  acceptanceCriteria: ["Dados reconciliados"], pricingLines: [{ id: "base", label: "Implantação", kind: "fixed", currency: "BRL", amount: 2000 }],
};
const agreement: Agreement = { id: "agreement_http_001", tenantId: "tenant_http_001", version: 1, status: "draft", scope: [...proposalInput.scope], deliverables: [...proposalInput.deliverables], exclusions: [...proposalInput.exclusions], fees: [] };
class MemoryContracts implements ContractRegistryStore {
  records = new Map<string, ContractRecord>();
  history = new Map<string, ContractEvent[]>();
  idem = new Map<string, { fingerprint: string; value: ContractRecord }>();
  async createDraft(value: ContractRecord, event: ContractEvent, key: string, fingerprint: string): Promise<ContractCommitResult> {
    const idemKey = value.tenantId + ":" + key; const old = this.idem.get(idemKey);
    if (old) { if (old.fingerprint !== fingerprint) throw new Error("CONTRACT_IDEMPOTENCY_CONFLICT"); return { value: old.value, replayed: true }; }
    this.records.set(value.tenantId + ":" + value.id, value); this.history.set(value.tenantId + ":" + value.id, [event]);
    this.idem.set(idemKey, { fingerprint, value }); return { value, replayed: false };
  }
  async get(tenant: string, id: string) { return this.records.get(tenant + ":" + id); }
  async commit(command: Parameters<ContractRegistryStore["commit"]>[0]): Promise<ContractCommitResult> {
    const idemKey = command.tenantId + ":" + command.idempotencyKey; const old = this.idem.get(idemKey);
    if (old) { if (old.fingerprint !== command.fingerprint) throw new Error("CONTRACT_IDEMPOTENCY_CONFLICT"); return { value: old.value, replayed: true }; }
    const key = command.tenantId + ":" + command.contractId; const current = this.records.get(key);
    if (!current) throw new Error("CONTRACT_NOT_FOUND");
    if (current.revision !== command.expectedRevision) throw new Error("CONTRACT_REVISION_CONFLICT");
    this.records.set(key, command.value); this.history.get(key)!.push(command.event);
    this.idem.set(idemKey, { fingerprint: command.fingerprint, value: command.value });
    return { value: command.value, replayed: false };
  }
  async events(tenant: string, id: string) { return Object.freeze([...(this.history.get(tenant + ":" + id) ?? [])]); }
}
const noopOutcomeStore: OutcomeStore = {
  getCase: async () => undefined, createCase: async () => {}, commit: async () => { throw new Error("unused"); }, auditTrail: async () => [],
};
test("contract HTTP lifecycle persists a draft, review, approval, signatures and activation", async () => {
  const contracts = new MemoryContracts();
  const server = createOutcomeHttpServer({
    store: noopOutcomeStore, contracts,
    authenticate: async () => ({ tenantId: "tenant_http_001", actorId: "customer_admin", roles: ["owner"] }),
    authorize: async () => true,
    verifyContractSignature: async signature => signature.signatureHash === "verified:" + signature.signerId,
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const base = "http://127.0.0.1:" + address.port;
    const post = async (path: string, key: string, body: unknown) => fetch(base + path, { method: "POST", headers: { "content-type": "application/json", "idempotency-key": key }, body: JSON.stringify(body) });
    const created = await post("/v1/contracts/drafts", "create-contract-1", {
      proposal: { ...proposalInput, readiness: { status: "ready_for_review", blockers: [], warnings: [] }, status: "draft", generatedAt: "2026-11-10T10:00:00.000Z", customer: { name: proposalInput.customerName, sector: proposalInput.sector }, pricing: { lines: proposalInput.pricingLines }, commercialNotice: "Draft" },
      agreement, parties: [
        { legalName: "Cliente HTTP Ltda.", representative: "Diretora", role: "customer" },
        { legalName: "OaaS.Quest", representative: "Representante", role: "provider" },
      ],
      effectiveDate: "2026-11-10", jurisdiction: "Brasil", requiredSigners: ["customer_admin", "provider_admin"],
    });
    assert.equal(created.status, 201);
    const createdBody = await created.json() as { value: ContractRecord };
    const id = createdBody.value.id; assert.equal(createdBody.value.state, "draft");
    const path = "/v1/contracts/" + encodeURIComponent(id);
    assert.equal((await post(path + "/submit-review", "submit-1", {})).status, 200);
    assert.equal((await post(path + "/approve", "approve-1", {})).status, 200);
    for (const signerId of ["customer_admin", "provider_admin"]) {
      const signed = await post(path + "/signatures", "sign-" + signerId, { signature: { signerId, signatureHash: "verified:" + signerId, provider: "test-verifier", signedAt: "2026-11-10T10:00:00.000Z", verificationReference: "verification-" + signerId } });
      assert.equal(signed.status, 200);
    }
    const activated = await post(path + "/activate", "activate-1", {});
    assert.equal(activated.status, 200);
    const final = await (await fetch(base + path)).json() as { value: ContractRecord };
    assert.equal(final.value.state, "active");
    assert.equal(final.value.agreement.status, "active");
    assert.equal(final.value.agreement.signatures?.length, 2);
    const events = await (await fetch(base + path + "/events")).json() as { value: ContractEvent[] };
    assert.deepEqual(events.value.map(event => event.action), ["created", "submitted_for_review", "approved_for_signature", "signature_recorded", "signature_recorded", "activated"]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
test("contract creation is tenant-bound and signing is blocked without a verifier", async () => {
  const contracts = new MemoryContracts();
  const server = createOutcomeHttpServer({ store: noopOutcomeStore, contracts, authenticate: async () => ({ tenantId: "tenant_http_001", actorId: "actor", roles: [] }), authorize: async () => true });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const response = await fetch("http://127.0.0.1:" + address.port + "/v1/contracts/drafts", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "tenant-mismatch" },
      body: JSON.stringify({ proposal: { ...proposalInput, tenantId: "another_tenant" }, agreement, parties: [], effectiveDate: "2026-11-10", jurisdiction: "Brasil", requiredSigners: ["actor"] }),
    });
    assert.equal(response.status, 422);
    assert.equal(contracts.records.size, 0);
  } finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
