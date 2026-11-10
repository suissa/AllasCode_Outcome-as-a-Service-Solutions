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

test("rejects unknown runtime entity kinds and suffixes outside canonical bounds", () => {
  assert.throws(() => parseEntityId("unknown" as never, "unknown_demo_001"), (error: unknown) =>
    error instanceof IdentifierValidationError && error.issue.code === "ID_KIND_MISMATCH");
  assert.throws(() => parseEntityId("tenant", "tenant_ab"), (error: unknown) =>
    error instanceof IdentifierValidationError && error.issue.code === "ID_INVALID");
  assert.throws(() => parseEntityId("tenant", "tenant_" + "a".repeat(65)), (error: unknown) =>
    error instanceof IdentifierValidationError && error.issue.code === "ID_INVALID");
});

test("canonicalId is deterministic for long keys and avoids prefix-truncation collisions", () => {
  const first = canonicalId("capability", "a".repeat(70) + "-first");
  const second = canonicalId("capability", "a".repeat(70) + "-second");
  assert.notEqual(first, second);
  assert.equal(first, canonicalId("capability", "a".repeat(70) + "-first"));
  assert.ok(first.length <= "capability_".length + 64);
});

test("canonicalId rejects non-string and non-identifying external keys with stable errors", () => {
  for (const value of [null, undefined, 42, "!!!", "a"]) {
    assert.throws(() => canonicalId("tenant", value as never), (error: unknown) =>
      error instanceof IdentifierValidationError && error.issue.code === "ID_INVALID");
  }
});
