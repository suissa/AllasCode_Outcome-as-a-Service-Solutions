import test from "node:test";
import assert from "node:assert/strict";
import { createOutcomeHttpServer } from "../../src/http/server.ts";
import type { OutcomeStore } from "../../src/persistence/outcome-store.ts";
import type { OutcomeCase } from "../../src/application/outcome-case.ts";

function fixture(): OutcomeCase {
  return { id: "outcome_demo_001", tenantId: "tenant_demo_001", stage: "specified", spec: { metric: { id: "metric_demo_001", name: "Revenue", unit: "BRL" } as never, baseline: 10, target: 20, direction: "increase", periodStart: "2026-01-01", periodEnd: "2026-02-01", attribution: "direct", approvedBy: "actor_owner_001" }, evidence: [], observations: [] };
}
test("HTTP adapter exposes health and enforces authentication and tenant scoping", async () => {
  let stored = fixture();
  const store: OutcomeStore = {
    getCase: async (tenant, id) => tenant === stored.tenantId && id === stored.id ? stored : undefined,
    createCase: async (value) => { stored = value; },
    commit: async (command) => { stored = command.value; return { value: stored, replayed: false }; },
    auditTrail: async () => [],
  };
  const server = createOutcomeHttpServer({ store, authenticate: async () => ({ tenantId: "tenant_demo_001", actorId: "actor_owner_001", roles: ["owner"] }), authorize: async () => true });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const base = "http://127.0.0.1:" + address.port;
    assert.equal((await fetch(base + "/health")).status, 200);
    assert.equal((await fetch(base + "/v1/cases/outcome_demo_001")).status, 200);
  } finally { await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())); }
  const denied = createOutcomeHttpServer({ store, authenticate: async () => undefined, authorize: async () => true });
  await new Promise<void>((resolve) => denied.listen(0, "127.0.0.1", resolve));
  try {
    const address = denied.address(); assert.ok(address && typeof address === "object");
    assert.equal((await fetch("http://127.0.0.1:" + address.port + "/v1/cases/outcome_demo_001")).status, 401);
  } finally { await new Promise<void>((resolve, reject) => denied.close((error) => error ? reject(error) : resolve())); }
});
