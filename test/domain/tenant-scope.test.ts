import test from "node:test";
import assert from "node:assert/strict";
import { IdentifierValidationError, parseEntityId } from "../../src/domain/identifiers.ts";
import { assertTenantScope, requireTenantScope, TenantIsolationError } from "../../src/domain/tenant-scope.ts";

const tenantA = parseEntityId("tenant", "tenant_alpha_001");
const tenantB = parseEntityId("tenant", "tenant_bravo_001");
const scope = { tenantId: tenantA, actorId: "actor_owner_001", correlationId: "req_test_001" };

test("allows access only when record tenant matches active scope", () => {
  const record = { tenantId: tenantA, value: "private" };
  assert.equal(assertTenantScope(scope, record), record);
});

test("rejects cross-tenant records without leaking tenant identifiers", () => {
  assert.throws(() => assertTenantScope(scope, { tenantId: tenantB }), (error: unknown) => {
    assert.ok(error instanceof TenantIsolationError);
    assert.equal(error.code, "TENANT_SCOPE_MISMATCH");
    assert.equal(error.path, "record.tenantId");
    assert.equal(error.message.includes("alpha"), false);
    assert.equal(error.message.includes("bravo"), false);
    return true;
  });
});

test("requires a complete tenant execution context", () => {
  assert.equal(requireTenantScope(scope), scope);
  assert.throws(() => requireTenantScope(undefined), TenantIsolationError);
  assert.throws(() => requireTenantScope({ tenantId: tenantA, actorId: "", correlationId: "req_test_001" }), TenantIsolationError);
});

test("rejects malformed runtime tenant IDs and incomplete correlation metadata", () => {
  assert.throws(() => requireTenantScope({ tenantId: "not-a-tenant" as never, actorId: "actor_owner_001", correlationId: "req_test_001" }),
    (error: unknown) => error instanceof IdentifierValidationError && error.issue.code === "ID_INVALID");
  assert.throws(() => requireTenantScope({ tenantId: tenantA, actorId: "actor_owner_001", correlationId: " " }),
    TenantIsolationError);
  assert.throws(() => assertTenantScope(scope, { tenantId: "tenant_invalid" as never }),
    /ID_INVALID/);
});
