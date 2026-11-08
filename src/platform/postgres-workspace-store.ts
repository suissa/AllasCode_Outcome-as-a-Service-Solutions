import type { SqlDatabase } from "../persistence/sql.ts";
import { acceptInvitation, createInvitation, revokeMembership, validateWorkspace, type Membership, type Workspace } from "./workspace.ts";

export interface WorkspaceStore {
  createWorkspace(workspace: Workspace): Promise<Workspace>;
  getWorkspace(tenantId: string, workspaceId: string): Promise<Workspace | undefined>;
  invite(input: Omit<Membership, "status" | "createdAt">, now?: Date): Promise<Membership>;
  getMembership(tenantId: string, workspaceId: string, actorId: string): Promise<Membership | undefined>;
  accept(tenantId: string, workspaceId: string, actorId: string, tokenHash: string, now?: Date): Promise<Membership>;
  revoke(tenantId: string, workspaceId: string, actorId: string, revokedBy: string): Promise<Membership>;
}
interface WorkspaceRow extends Record<string, unknown> { payload: Workspace | string }
interface MembershipRow extends Record<string, unknown> { payload: Membership | string }
const decode = <T>(payload: T | string): T => typeof payload === "string" ? JSON.parse(payload) as T : payload;

export class PostgresWorkspaceStore implements WorkspaceStore {
  constructor(private readonly db: SqlDatabase) {}

  async createWorkspace(workspace: Workspace): Promise<Workspace> {
    const errors = validateWorkspace(workspace);
    if (errors.length) throw new Error("WORKSPACE_INVALID:" + errors.join(","));
    const value = Object.freeze({ ...workspace });
    try {
      await this.db.query(
        "insert into workspaces (tenant_id, workspace_id, slug, payload) values ($1,$2,$3,$4::jsonb)",
        [workspace.tenantId, workspace.id, workspace.slug, JSON.stringify(value)],
      );
    } catch (error) {
      const code = (error as { code?: string }).code;
      if (code === "23505") throw new Error("WORKSPACE_SLUG_CONFLICT");
      throw error;
    }
    return value;
  }

  async getWorkspace(tenantId: string, workspaceId: string): Promise<Workspace | undefined> {
    const result = await this.db.query<WorkspaceRow>(
      "select payload from workspaces where tenant_id=$1 and workspace_id=$2",
      [tenantId, workspaceId],
    );
    const row = result.rows[0];
    return row ? decode(row.payload) : undefined;
  }

  async invite(input: Omit<Membership, "status" | "createdAt">, now = new Date()): Promise<Membership> {
    const membership = createInvitation(input, now);
    await this.db.query(
      "insert into workspace_memberships (tenant_id,workspace_id,actor_id,status,expires_at,invitation_token_hash,payload) values ($1,$2,$3,$4,$5,$6,$7::jsonb)",
      [membership.tenantId, membership.workspaceId, membership.actorId, membership.status, membership.expiresAt, membership.invitationTokenHash, JSON.stringify(membership)],
    );
    return membership;
  }

  async getMembership(tenantId: string, workspaceId: string, actorId: string): Promise<Membership | undefined> {
    const result = await this.db.query<MembershipRow>(
      "select payload from workspace_memberships where tenant_id=$1 and workspace_id=$2 and actor_id=$3",
      [tenantId, workspaceId, actorId],
    );
    const row = result.rows[0];
    return row ? decode(row.payload) : undefined;
  }

  async accept(tenantId: string, workspaceId: string, actorId: string, tokenHash: string, now = new Date()): Promise<Membership> {
    return this.db.transaction(async tx => {
      const result = await tx.query<MembershipRow>(
        "select payload from workspace_memberships where tenant_id=$1 and workspace_id=$2 and actor_id=$3 for update",
        [tenantId, workspaceId, actorId],
      );
      const row = result.rows[0];
      if (!row) throw new Error("MEMBERSHIP_NOT_FOUND");
      const current = decode(row.payload);
      const accepted = acceptInvitation(current, actorId, tokenHash, now);
      await tx.query(
        "update workspace_memberships set status=$4,payload=$5::jsonb where tenant_id=$1 and workspace_id=$2 and actor_id=$3",
        [tenantId, workspaceId, actorId, accepted.status, JSON.stringify(accepted)],
      );
      return accepted;
    });
  }

  async revoke(tenantId: string, workspaceId: string, actorId: string, revokedBy: string): Promise<Membership> {
    return this.db.transaction(async tx => {
      const result = await tx.query<MembershipRow>(
        "select payload from workspace_memberships where tenant_id=$1 and workspace_id=$2 and actor_id=$3 for update",
        [tenantId, workspaceId, actorId],
      );
      const row = result.rows[0];
      if (!row) throw new Error("MEMBERSHIP_NOT_FOUND");
      const revoked = revokeMembership(decode(row.payload), revokedBy);
      await tx.query(
        "update workspace_memberships set status=$4,payload=$5::jsonb where tenant_id=$1 and workspace_id=$2 and actor_id=$3",
        [tenantId, workspaceId, actorId, revoked.status, JSON.stringify(revoked)],
      );
      return revoked;
    });
  }
}
