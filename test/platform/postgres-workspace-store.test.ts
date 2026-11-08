import test from "node:test";
import assert from "node:assert/strict";
import { PostgresWorkspaceStore } from "../../src/platform/postgres-workspace-store.ts";
import type { SqlDatabase, SqlExecutor } from "../../src/persistence/sql.ts";
import type { Membership, Workspace } from "../../src/platform/workspace.ts";

test("Postgres workspace store persists tenant-scoped workspaces and invitation transitions", async () => {
  const workspaces = new Map<string, Workspace>();
  const memberships = new Map<string, Membership>();
  const statements: string[] = [];
  const key = (tenant: string, workspace: string, actor = "") => [tenant, workspace, actor].join(":");
  const executor: SqlExecutor = {
    query: async <T extends Record<string, unknown>>(sql: string, params: readonly unknown[] = []) => {
      statements.push(sql);
      if (sql.includes("insert into workspaces")) {
        const value = JSON.parse(String(params[3])) as Workspace;
        workspaces.set(key(value.tenantId, value.id), value);
      } else if (sql.includes("select payload from workspaces")) {
        const value = workspaces.get(key(String(params[0]), String(params[1])));
        return { rows: (value ? [{ payload: value }] : []) as unknown as T[], rowCount: value ? 1 : 0 };
      } else if (sql.includes("insert into workspace_memberships")) {
        const value = JSON.parse(String(params[6])) as Membership;
        memberships.set(key(value.tenantId, value.workspaceId, value.actorId), value);
      } else if (sql.includes("select payload from workspace_memberships")) {
        const value = memberships.get(key(String(params[0]), String(params[1]), String(params[2])));
        return { rows: (value ? [{ payload: value }] : []) as unknown as T[], rowCount: value ? 1 : 0 };
      } else if (sql.includes("update workspace_memberships")) {
        const id = key(String(params[0]), String(params[1]), String(params[2]));
        const value = JSON.parse(String(params[4])) as Membership;
        memberships.set(id, value);
      }
      return { rows: [], rowCount: 1 };
    },
  };
  const db: SqlDatabase = { query: executor.query, transaction: async <T>(work: (tx: SqlExecutor) => Promise<T>) => work(executor) };
  const store = new PostgresWorkspaceStore(db);
  const workspace: Workspace = { id: "workspace_001", tenantId: "tenant_001" as never, name: "Operations", slug: "operations", status: "active", createdAt: "2026-11-08T00:00:00Z" };
  await store.createWorkspace(workspace);
  assert.equal((await store.getWorkspace("tenant_001", "workspace_001"))?.slug, "operations");
  assert.equal(await store.getWorkspace("tenant_other", "workspace_001"), undefined);

  const invitation = await store.invite({
    workspaceId: workspace.id, tenantId: workspace.tenantId, actorId: "actor_002", role: "analyst",
    status: "invited" as never, invitedBy: "owner_001", expiresAt: "2026-12-01T00:00:00Z", invitationTokenHash: "token_hash",
  } as Omit<Membership, "status" | "createdAt">, new Date("2026-11-08T00:00:00Z"));
  assert.equal(invitation.status, "invited");
  await assert.rejects(() => store.accept("tenant_other", workspace.id, "actor_002", "token_hash"), /MEMBERSHIP_NOT_FOUND/);
  await assert.rejects(() => store.accept("tenant_001", workspace.id, "actor_002", "wrong"), /INVITATION_TOKEN_INVALID/);
  assert.equal((await store.accept("tenant_001", workspace.id, "actor_002", "token_hash", new Date("2026-11-09T00:00:00Z"))).status, "active");
  assert.equal((await store.revoke("tenant_001", workspace.id, "actor_002", "owner_001")).status, "revoked");
  assert.ok(statements.some(sql => sql.includes("for update")));
});
