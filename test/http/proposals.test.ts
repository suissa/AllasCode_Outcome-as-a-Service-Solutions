import test from "node:test";
import assert from "node:assert/strict";
import { createOutcomeHttpServer } from "../../src/http/server.ts";
import type { OutcomeStore } from "../../src/persistence/outcome-store.ts";
import type { PersistedProposal, ProposalEvent, ProposalStore, CreateProposalCommand, TransitionProposalCommand } from "../../src/persistence/proposal-store.ts";

test("proposal API persists a tenant-scoped draft and replays idempotent submissions", async () => {
  let tenantId = "tenant_alpha";
  const values = new Map<string, PersistedProposal>();
  const keys = new Map<string, { fingerprint: string; proposalId: string }>();
  const history = new Map<string, ProposalEvent[]>();
  const proposalStore: ProposalStore = {
    create: async (command: CreateProposalCommand) => {
      const key = command.tenantId + ":" + command.idempotencyKey;
      const prior = keys.get(key);
      if (prior) {
        if (prior.fingerprint !== command.fingerprint) throw new Error("PROPOSAL_IDEMPOTENCY_CONFLICT");
        return { value: values.get(command.tenantId + ":" + prior.proposalId)!, replayed: true };
      }
      values.set(command.tenantId + ":" + command.value.proposal.id, command.value);
      keys.set(key, { fingerprint: command.fingerprint, proposalId: command.value.proposal.id });
      history.set(command.tenantId + ":" + command.value.proposal.id, [command.event]);
      return { value: command.value, replayed: false };
    },
    get: async (tenant, id) => values.get(tenant + ":" + id),
    list: async tenant => [...values.entries()].filter(([key]) => key.startsWith(tenant + ":")).map(([, value]) => value),
    transition: async (_command: TransitionProposalCommand) => { throw new Error("NOT_USED"); },
    events: async (tenant, id) => history.get(tenant + ":" + id) ?? []
  };
  const server = createOutcomeHttpServer({
    store: {} as OutcomeStore,
    proposalStore,
    authenticate: async () => ({ tenantId, actorId: "actor_alpha", roles: ["*"] }),
    authorize: async () => true
  });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = "http://127.0.0.1:" + address.port;
    const payload = {
      snapshot: {
        source: "discovery",
        answers: {
          company_name: { value: "Mercado Aurora" },
          segment: { value: "retail" },
          main_goal: { value: "sales" }
        }
      },
      options: { tenantId: "tenant_attacker", proposalId: "client_supplied", version: 99 }
    };
    const submit = () => fetch(base + "/v1/proposals", {
      method: "POST",
      headers: { "content-type": "application/json", "idempotency-key": "submit-001" },
      body: JSON.stringify(payload)
    });
    const first = await submit();
    assert.equal(first.status, 201);
    const firstBody = await first.json() as { value: PersistedProposal; replayed: boolean };
    assert.equal(firstBody.value.proposal.tenantId, "tenant_alpha");
    assert.notEqual(firstBody.value.proposal.id, "client_supplied");
    assert.equal(firstBody.value.status, "draft");
    assert.equal(firstBody.replayed, false);

    const replay = await submit();
    assert.equal(replay.status, 200);
    const replayBody = await replay.json() as { value: PersistedProposal; replayed: boolean };
    assert.equal(replayBody.value.proposal.id, firstBody.value.proposal.id);
    assert.equal(replayBody.replayed, true);

    const listed = await fetch(base + "/v1/proposals");
    assert.equal(listed.status, 200);
    const listBody = await listed.json() as { value: PersistedProposal[] };
    assert.equal(listBody.value.length, 1);

    tenantId = "tenant_beta";
    const hidden = await fetch(base + "/v1/proposals/" + firstBody.value.proposal.id);
    assert.equal(hidden.status, 404);
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
