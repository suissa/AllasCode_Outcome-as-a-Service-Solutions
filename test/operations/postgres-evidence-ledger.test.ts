import assert from "node:assert/strict";
import { describe, it } from "node:test";
import postgres from "postgres";
import { PostgresAppendOnlyLedger, ledgerDigest } from "../../src/operations/postgres-evidence-ledger.js";

const databaseUrl = process.env.DATABASE_URL;

describe("PostgresAppendOnlyLedger", { skip: !databaseUrl }, () => {
  const sql = postgres(databaseUrl!, { max: 4 });
  const ledger = new PostgresAppendOnlyLedger<{ value: number }>(sql);
  const tenant = "ledger-test-" + process.pid;

  it("serializes concurrent appends and verifies the tenant hash chain", async () => {
    try {
      const inputs = Array.from({ length: 12 }, (_, index) => ({
        tenantId: tenant, eventId: "event-" + index, eventType: "test.append",
        occurredAt: new Date(Date.UTC(2026, 10, 10, 0, 0, index)).toISOString(),
        payload: { value: index }
      }));
      await Promise.all(inputs.map(input => ledger.append(input)));
      const events = await ledger.readTenant(tenant);
      assert.equal(events.length, inputs.length);
      assert.deepEqual(events.map(event => event.sequence), Array.from({ length: 12 }, (_, i) => i + 1));
      assert.equal((await ledger.verifyTenant(tenant)).valid, true);
    } finally {
      await sql`DELETE FROM syntropic_ledger_events WHERE tenant_id = ${tenant}`;
    }
  });

  it("rejects duplicate event IDs within a tenant", async () => {
    const input = {
      tenantId: tenant, eventId: "duplicate", eventType: "test.append",
      occurredAt: new Date().toISOString(), payload: { value: 1 }
    };
    try {
      await ledger.append(input);
      await assert.rejects(ledger.append(input), /LEDGER-DUPLICATE-EVENT/);
    } finally {
      await sql`DELETE FROM syntropic_ledger_events WHERE tenant_id = ${tenant}`;
    }
  });

  it("uses deterministic canonical digests", () => {
    assert.equal(ledgerDigest({ b: 2, a: 1 }), ledgerDigest({ a: 1, b: 2 }));
  });

  // Close explicitly so this suite does not retain database sockets.
  it("closes the test connection pool", async () => {
    await sql.end();
  });
});
