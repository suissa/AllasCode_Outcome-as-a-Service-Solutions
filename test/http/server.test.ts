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

test("proposal preview derives tenant scope from the authenticated actor", async () => {
  const store: OutcomeStore = {
    getCase: async () => undefined,
    createCase: async () => {},
    commit: async command => ({ value: command.value, replayed: false }),
    auditTrail: async () => [],
  };
  const authorized: string[] = [];
  const server = createOutcomeHttpServer({
    store,
    authenticate: async () => ({ tenantId: "tenant_authenticated", actorId: "actor_owner", roles: ["owner"] }),
    authorize: async (_actor, action) => { authorized.push(action); return true; },
    now: () => new Date("2026-11-10T12:00:00.000Z"),
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const response = await fetch("http://127.0.0.1:" + address.port + "/v1/proposals/preview", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        snapshot: { source: "guilda", missionId: "mission_http", answers: { company_name: { value: "Cliente API" }, segment: { value: "services" } } },
        options: { tenantId: "tenant_attacker", proposalId: "proposal_attacker", version: 99 },
      }),
    });
    assert.equal(response.status, 200);
    const body = await response.json() as { value: { tenantId: string; id: string; readiness: { status: string } }; source: { missionId?: string } };
    assert.equal(body.value.tenantId, "tenant_authenticated");
    assert.match(body.value.id, /^proposal_preview_/);
    assert.equal(body.value.readiness.status, "incomplete");
    assert.equal(body.source.missionId, "mission_http");
    assert.deepEqual(authorized, ["proposal.preview"]);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("proposal preview enforces authorization and required request fields", async () => {
  const store: OutcomeStore = {
    getCase: async () => undefined,
    createCase: async () => {},
    commit: async command => ({ value: command.value, replayed: false }),
    auditTrail: async () => [],
  };
  const server = createOutcomeHttpServer({
    store,
    authenticate: async () => ({ tenantId: "tenant_authenticated", actorId: "actor_owner", roles: ["owner"] }),
    authorize: async (_actor, action) => action !== "proposal.preview",
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const response = await fetch("http://127.0.0.1:" + address.port + "/v1/proposals/preview", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshot: { answers: {} }, options: {} }),
    });
    assert.equal(response.status, 403);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});


test("proposal submission requires idempotency and authorization, and persists incomplete discovery as a draft", async () => {
  let writes = 0, persisted: any;
  const proposalStore = {
    create: async (command: any) => { writes++; persisted=command.value; return { value: command.value, replayed: false }; },
    get: async () => undefined,
    list: async () => [],
    transition: async () => { throw new Error("not_used"); },
    events: async () => [],
  };
  const server = createOutcomeHttpServer({
    store: {
      getCase: async () => undefined, createCase: async () => {},
      commit: async command => ({ value: command.value, replayed: false }), auditTrail: async () => [],
    },
    proposalStore,
    authenticate: async () => ({ tenantId: "tenant_secure", actorId: "actor_submitter", roles: ["owner"] }),
    authorize: async (_actor, action) => action === "proposal.create",
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const base = "http://127.0.0.1:" + address.port;
    const missingKey = await fetch(base + "/v1/proposals", {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ snapshot: { answers: {} }, options: { tenantId: "tenant_attacker" } }),
    });
    assert.equal(missingKey.status, 400);
    const incomplete = await fetch(base + "/v1/proposals", {
      method: "POST", headers: { "content-type": "application/json", "idempotency-key": "discovery_submit_001" },
      body: JSON.stringify({ snapshot: { source: "guilda", missionId: "mission_001", answers: {} }, options: { tenantId: "tenant_attacker", proposalId: "attacker_id", version: 99 } }),
    });
    assert.equal(incomplete.status, 201);
    const payload = await incomplete.json() as { value: { status: string; proposal: { tenantId: string; id: string; readiness: { status: string } } } };
    assert.equal(payload.value.status, "draft");
    assert.equal(payload.value.proposal.tenantId, "tenant_secure");
    assert.equal(payload.value.proposal.readiness.status, "incomplete");
    assert.equal(persisted.proposal.tenantId, "tenant_secure");
    assert.equal(persisted.proposal.id.startsWith("proposal_"), true);
    assert.equal(writes, 1);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});

test("proposal routes are unavailable unless a durable store is configured", async () => {
  const server = createOutcomeHttpServer({
    store: { getCase: async () => undefined, createCase: async () => {}, commit: async command => ({ value: command.value, replayed: false }), auditTrail: async () => [] },
    authenticate: async () => ({ tenantId: "tenant_secure", actorId: "actor_submitter", roles: ["owner"] }),
    authorize: async () => true,
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address(); assert.ok(address && typeof address === "object");
    const response = await fetch("http://127.0.0.1:" + address.port + "/v1/proposals");
    assert.equal(response.status, 503);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
