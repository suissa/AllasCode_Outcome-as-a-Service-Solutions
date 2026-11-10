import test from "node:test";
import assert from "node:assert/strict";
import {
  WorkspaceIsolationError,
  assertWorkspaceRecordScope,
  assertWorkspaceRecordsScope,
  authorizeWorkspaceAction,
  buildWorkspaceQueryFilter,
  requireWorkspaceScope,
  type WorkspaceMembership,
  type WorkspaceScope,
} from "../../src/domain/workspace-isolation.ts";
import { parseEntityId } from "../../src/domain/identifiers.ts";

const tenantId = parseEntityId("tenant", "tenant_alpha_001");
const workspaceId = parseEntityId("workspace", "workspace_main_001");
const now = new Date("2026-11-10T12:00:00.000Z");
const scope: WorkspaceScope = { tenantId, workspaceId, actorId: "actor_owner_001", correlationId: "req_workspace_001" };
const membership: WorkspaceMembership = {
  id: "membership_1", tenantId, workspaceId, actorId: "actor_owner_001", role: "member",
  permissions: ["workspace.read", "outcome.read", "outcome.create"],
  status: "active", grantedBy: "actor_admin_001", grantedAt: "2026-11-01T00:00:00.000Z", revision: 1,
};

test("requires canonical tenant/workspace scope and returns stable query filters", () => {
  assert.equal(requireWorkspaceScope(scope), scope);
  assert.deepEqual(buildWorkspaceQueryFilter(scope), { tenantId, workspaceId });
  assert.throws(() => requireWorkspaceScope({ ...scope, workspaceId: "invalid" as never }), /WORKSPACE_SCOPE_INVALID/);
  assert.throws(() => requireWorkspaceScope({ ...scope, correlationId: " " }), WorkspaceIsolationError);
});

test("asserts both tenant and workspace ownership before record access", () => {
  const record = { id: "outcome_1", tenantId, workspaceId };
  assert.equal(assertWorkspaceRecordScope(scope, record), record);
  assert.throws(() => assertWorkspaceRecordScope(scope, { ...record, tenantId: parseEntityId("tenant", "tenant_other_001") }),
    /WORKSPACE_TENANT_MISMATCH/);
  assert.throws(() => assertWorkspaceRecordScope(scope, { ...record, workspaceId: parseEntityId("workspace", "workspace_other_001") }),
    /WORKSPACE_BOUNDARY_MISMATCH/);
});

test("rejects mixed-tenant and mixed-workspace collections rather than partially processing them", () => {
  const records = [
    { id: "one", tenantId, workspaceId },
    { id: "two", tenantId, workspaceId },
  ];
  assert.equal(assertWorkspaceRecordsScope(scope, records).length, 2);
  assert.throws(() => assertWorkspaceRecordsScope(scope, [...records, {
    id: "cross", tenantId, workspaceId: parseEntityId("workspace", "workspace_other_001"),
  }]), /WORKSPACE_BOUNDARY_MISMATCH/);
});

test("authorizes only active membership with role-bounded permissions in the same scope", () => {
  assert.equal(authorizeWorkspaceAction(scope, membership, "outcome.create", now), true);
  assert.equal(authorizeWorkspaceAction(scope, membership, "workspace.members.manage", now), false);
  assert.throws(() => authorizeWorkspaceAction(scope, { ...membership, role: "member", permissions: ["workspace.delete"] }, "workspace.delete", now),
    /WORKSPACE_MEMBERSHIP_INVALID/);
});

test("rejects actor, tenant and workspace membership mismatches", () => {
  assert.throws(() => authorizeWorkspaceAction({ ...scope, actorId: "actor_other_001" }, membership, "outcome.read", now),
    /WORKSPACE_MEMBERSHIP_MISMATCH/);
  assert.throws(() => authorizeWorkspaceAction({ ...scope, tenantId: parseEntityId("tenant", "tenant_other_001") }, membership, "outcome.read", now),
    /WORKSPACE_MEMBERSHIP_MISMATCH/);
  assert.throws(() => authorizeWorkspaceAction({ ...scope, workspaceId: parseEntityId("workspace", "workspace_other_001") }, membership, "outcome.read", now),
    /WORKSPACE_MEMBERSHIP_MISMATCH/);
});

test("rejects inactive, expired, future-dated and malformed membership records", () => {
  assert.equal(authorizeWorkspaceAction(scope, { ...membership, status: "suspended" }, "outcome.read", now), false);
  assert.equal(authorizeWorkspaceAction(scope, { ...membership, expiresAt: "2026-11-10T11:00:00.000Z" }, "outcome.read", now), false);
  assert.throws(() => authorizeWorkspaceAction(scope, { ...membership, grantedAt: "2026-11-10T12:01:00.000Z" }, "outcome.read", now),
    /WORKSPACE_MEMBERSHIP_INVALID/);
  assert.throws(() => authorizeWorkspaceAction(scope, { ...membership, revision: 0 }, "outcome.read", now),
    /WORKSPACE_MEMBERSHIP_INVALID/);
});

test("fails closed for malformed records and does not disclose tenant/workspace identifiers", () => {
  const error = assert.throws(() => assertWorkspaceRecordScope(scope, { id: "x", tenantId: "tenant_bad!" as never, workspaceId }),
    WorkspaceIsolationError);
  assert.equal(error.message.includes("tenant_alpha"), false);
  assert.equal(error.message.includes("tenant_bad"), false);
});
