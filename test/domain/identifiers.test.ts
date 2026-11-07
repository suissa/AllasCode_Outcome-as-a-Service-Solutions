import test from "node:test";
import assert from "node:assert/strict";
import { canonicalId, parseEntityId, IdentifierValidationError } from "../../src/domain/identifiers.ts";

test("accepts canonical ID matching the requested entity kind", () => {
  assert.equal(parseEntityId("tenant", "tenant_demo_001"), "tenant_demo_001");
});

test("rejects missing and whitespace-padded identifiers with stable issue codes", () => {
  for (const value of [undefined, null, "", "  "]) {
    assert.throws(() => parseEntityId("tenant", value), (error: unknown) =>
      error instanceof IdentifierValidationError && error.issue.code === "ID_REQUIRED");
  }
  assert.throws(() => parseEntityId("tenant", " tenant_demo_001 "), (error: unknown) =>
    error instanceof IdentifierValidationError && error.issue.code === "ID_INVALID");
});

test("rejects malformed and wrong-kind IDs", () => {
  assert.throws(() => parseEntityId("tenant", "Tenant_demo_001"), (error: unknown) =>
    error instanceof IdentifierValidationError && error.issue.code === "ID_INVALID");
  assert.throws(() => parseEntityId("tenant", "actor_demo_001"), (error: unknown) =>
    error instanceof IdentifierValidationError && error.issue.code === "ID_KIND_MISMATCH");
});

test("canonicalId normalizes external keys deterministically", () => {
  assert.equal(canonicalId("workspace", "My Workspace / São Paulo"), "workspace_my_workspace_sao_paulo");
  assert.equal(canonicalId("actor", "Owner #1"), "actor_owner_1");
});
