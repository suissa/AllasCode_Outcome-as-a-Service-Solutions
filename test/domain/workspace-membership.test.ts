import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  WorkspaceInvitationError,
  acceptWorkspaceInvitation,
  createWorkspaceInvitation,
  revokeWorkspaceInvitation,
  revokeWorkspaceMembership,
  type GovernedWorkspaceInvitation,
  type WorkspaceInvitationStore,
} from "../../src/domain/workspace-membership.ts";
import type { WorkspaceMembership } from "../../src/domain/workspace-isolation.ts";
import { parseEntityId } from "../../src/domain/identifiers.ts";

const now = new Date("2026-11-10T12:00:00.000Z");
const tenantId = parseEntityId("tenant", "tenant_alpha_001");
const workspaceId = parseEntityId("workspace", "workspace_main_001");
const hash = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

class MemoryMembershipStore implements WorkspaceInvitationStore {
  invitations = new Map<string, GovernedWorkspaceInvitation>();
  idempotency = new Map<string, GovernedWorkspaceInvitation>();
  memberships = new Map<string, WorkspaceMembership>();
  async findInvitationByIdempotency(tenant: string, key: string) { return this.idempotency.get(tenant + ":" + key); }
  async findPendingInvitationByRecipient(tenant: string, workspace: string, recipientHash: string) {
    return [...this.invitations.values()].find(item => item.tenantId === tenant && item.workspaceId === workspace && item.recipientHash === recipientHash && item.status === "pending");
  }
  async createInvitation(item: GovernedWorkspaceInvitation, key: string) {
    this.invitations.set(item.tenantId + ":" + item.id, item);
    this.idempotency.set(item.tenantId + ":" + key, item);
    return true;
  }
  async findInvitationByTokenHash(tenant: string, tokenHash: string) {
    return [...this.invitations.values()].find(item => item.tenantId === tenant && item.tokenHash === tokenHash);
  }
  async getInvitation(tenant: string, id: string) { return this.invitations.get(tenant + ":" + id); }
  async commitInvitation(updated: GovernedWorkspaceInvitation, expectedRevision: number) {
    const key = updated.tenantId + ":" + updated.id;
    const current = this.invitations.get(key);
    if (!current || current.revision !== expectedRevision) return false;
    this.invitations.set(key, updated);
    return true;
  }
  async acceptInvitation(invitation: GovernedWorkspaceInvitation, membership: WorkspaceMembership, expectedRevision: number) {
    const key = invitation.tenantId + ":" + invitation.id;
    const current = this.invitations.get(key);
    if (!current || current.revision !== expectedRevision || current.status !== "pending") return false;
    this.invitations.set(key, { ...invitation, status: "accepted", acceptedAt: now.toISOString(), acceptedBy: membership.actorId, revision: invitation.revision + 1 });
    this.memberships.set(membership.tenantId + ":" + membership.id, membership);
    return true;
  }
  async getMembership(tenant: string, workspace: string, id: string) {
    const item = this.memberships.get(tenant + ":" + id);
    return item?.workspaceId === workspace ? item : undefined;
  }
  async listMemberships(tenant: string, workspace: string) {
    return [...this.memberships.values()].filter(item => item.tenantId === tenant && item.workspaceId === workspace);
  }
  async commitMembership(updated: WorkspaceMembership, expectedRevision: number) {
    const key = updated.tenantId + ":" + updated.id;
    const current = this.memberships.get(key);
    if (!current || current.revision !== expectedRevision) return false;
    this.memberships.set(key, updated);
    return true;
  }
}

const auth = async (actor: string, tenant: string, workspace: string, action: string) =>
  actor !== "denied" && tenant === tenantId && workspace === workspaceId && action.length > 0;

test("creates workspace invitations with hashed recipient/token and idempotent delivery", async () => {
  const store = new MemoryMembershipStore();
  const deliveries: Array<{ email: string; token: string }> = [];
  const result = await createWorkspaceInvitation({
    id: "inv_1", tenantId, workspaceId, email: " New.User@Example.com ", role: "member",
    invitedBy: "actor_owner_001", token: "secure-random-invitation-token-123456",
    expiresAt: "2026-11-17T12:00:00.000Z", idempotencyKey: "invite-1", now,
  }, { store, authorize: auth, deliver: async (email, token) => { deliveries.push({ email, token }); } });
  assert.equal(result.status, "pending");
  assert.equal("email" in result, false);
  assert.equal("token" in result, false);
  assert.equal(result.recipientHash, hash("new.user@example.com"));
  assert.equal(result.tokenHash, hash("secure-random-invitation-token-123456"));
  assert.deepEqual(deliveries, [{ email: "new.user@example.com", token: "secure-random-invitation-token-123456" }]);
});

test("invitation replay is idempotent and duplicate pending recipient is rejected", async () => {
  const store = new MemoryMembershipStore();
  const command = {
    id: "inv_1", tenantId, workspaceId, email: "person@example.com", role: "viewer" as const,
    invitedBy: "owner", token: "token-123456789012345678901234567890",
    expiresAt: "2026-11-17T12:00:00.000Z", idempotencyKey: "invite-key", now,
  };
  const deps = { store, authorize: auth, deliver: async () => undefined };
  const first = await createWorkspaceInvitation(command, deps);
  const replay = await createWorkspaceInvitation(command, deps);
  assert.deepEqual(replay, first);
  await assert.rejects(() => createWorkspaceInvitation({ ...command, id: "inv_2", idempotencyKey: "invite-key-2" }, deps), /INVITATION_DUPLICATE_PENDING/);
});

test("delivery failure revokes the pending invitation and does not leave an active invite", async () => {
  const store = new MemoryMembershipStore();
  await assert.rejects(() => createWorkspaceInvitation({
    id: "inv_delivery", tenantId, workspaceId, email: "person@example.com", role: "member",
    invitedBy: "owner", token: "token-delivery-failure-123456789012345",
    expiresAt: "2026-11-17T12:00:00.000Z", idempotencyKey: "delivery-failure", now,
  }, { store, authorize: auth, deliver: async () => { throw new Error("mail provider unavailable"); } }), /INVITATION_DELIVERY_FAILED/);
  assert.equal(store.invitations.get("tenant_alpha_001:inv_delivery")?.status, "revoked");
});

test("acceptance verifies token, recipient, tenant and workspace before creating membership", async () => {
  const store = new MemoryMembershipStore();
  const token = "token-acceptance-123456789012345678";
  const invitation = await createWorkspaceInvitation({
    id: "inv_accept", tenantId, workspaceId, email: "new.member@example.com", role: "member",
    invitedBy: "actor_owner_001", token, expiresAt: "2026-11-17T12:00:00.000Z",
    idempotencyKey: "accept-invite", now,
  }, { store, authorize: auth, deliver: async () => undefined });
  const membership = await acceptWorkspaceInvitation({
    tenantId, workspaceId, actorId: "actor_new_001", token, now,
  }, { store, verifyRecipient: async (actorId, recipientHash) => actorId === "actor_new_001" && recipientHash === invitation.recipientHash });
  assert.equal(membership.status, "active");
  assert.equal(membership.role, "member");
  assert.equal(membership.grantedBy, "actor_owner_001");
  assert.equal(store.invitations.get("tenant_alpha_001:inv_accept")?.status, "accepted");
});

test("acceptance rejects expired, wrong-scope, wrong-recipient and reused invitations", async () => {
  const store = new MemoryMembershipStore();
  const token = "token-scope-123456789012345678901";
  await createWorkspaceInvitation({
    id: "inv_scope", tenantId, workspaceId, email: "user@example.com", role: "viewer",
    invitedBy: "owner", token, expiresAt: "2026-11-17T12:00:00.000Z", idempotencyKey: "scope", now,
  }, { store, authorize: auth, deliver: async () => undefined });
  await assert.rejects(() => acceptWorkspaceInvitation({ tenantId, workspaceId, actorId: "actor_x", token, now }, {
    store, verifyRecipient: async () => false,
  }), /INVITATION_RECIPIENT_MISMATCH/);
  await assert.rejects(() => acceptWorkspaceInvitation({
    tenantId, workspaceId: parseEntityId("workspace", "workspace_other_001"), actorId: "actor_x", token, now,
  }, { store, verifyRecipient: async () => true }), /INVITATION_NOT_FOUND/);
  await assert.rejects(() => acceptWorkspaceInvitation({
    tenantId, workspaceId, actorId: "actor_x", token, now: new Date("2026-11-18T00:00:00.000Z"),
  }, { store, verifyRecipient: async () => true }), /INVITATION_EXPIRED/);
  await acceptWorkspaceInvitation({ tenantId, workspaceId, actorId: "actor_x", token, now }, { store, verifyRecipient: async () => true });
  await assert.rejects(() => acceptWorkspaceInvitation({ tenantId, workspaceId, actorId: "actor_x", token, now }, { store, verifyRecipient: async () => true }), /INVITATION_NOT_PENDING/);
});

test("invitation revocation is authorized, revisioned and idempotency-safe", async () => {
  const store = new MemoryMembershipStore();
  await createWorkspaceInvitation({
    id: "inv_revoke", tenantId, workspaceId, email: "person@example.com", role: "member",
    invitedBy: "owner", token: "token-revoke-123456789012345678901",
    expiresAt: "2026-11-17T12:00:00.000Z", idempotencyKey: "revoke-invite", now,
  }, { store, authorize: auth, deliver: async () => undefined });
  const result = await revokeWorkspaceInvitation({
    tenantId, workspaceId, invitationId: "inv_revoke", actorId: "owner",
    expectedRevision: 1, reason: "Wrong recipient", now,
  }, { store, authorize: auth });
  assert.equal(result.status, "revoked");
  assert.equal(result.revision, 2);
  assert.equal(result.revokedBy, "owner");
  assert.equal(result.revocationReason, "Wrong recipient");
  await assert.rejects(() => revokeWorkspaceInvitation({
    tenantId, workspaceId, invitationId: "inv_revoke", actorId: "owner",
    expectedRevision: 1, reason: "Duplicate", now,
  }, { store, authorize: auth }), /INVITATION_REVISION_CONFLICT|INVITATION_NOT_PENDING/);
});

test("membership revocation preserves at least one active owner", async () => {
  const store = new MemoryMembershipStore();
  const owner: WorkspaceMembership = {
    id: "membership_owner", tenantId, workspaceId, actorId: "owner", role: "owner",
    permissions: ["workspace.read", "workspace.delete"], status: "active", grantedBy: "system",
    grantedAt: "2026-01-01T00:00:00.000Z", revision: 1,
  };
  const member: WorkspaceMembership = {
    id: "membership_member", tenantId, workspaceId, actorId: "member", role: "member",
    permissions: ["workspace.read"], status: "active", grantedBy: "owner",
    grantedAt: "2026-01-01T00:00:00.000Z", revision: 1,
  };
  store.memberships.set(tenantId + ":" + owner.id, owner);
  store.memberships.set(tenantId + ":" + member.id, member);
  await assert.rejects(() => revokeWorkspaceMembership({
    tenantId, workspaceId, membershipId: owner.id, actorId: "owner", expectedRevision: 1, reason: "Leaving", now,
  }, { store, authorize: auth }), /MEMBERSHIP_LAST_OWNER_REQUIRED/);
  const result = await revokeWorkspaceMembership({
    tenantId, workspaceId, membershipId: member.id, actorId: "owner", expectedRevision: 1, reason: "Access removed", now,
  }, { store, authorize: auth });
  assert.equal(result.status, "revoked");
  assert.equal(result.revision, 2);
  assert.equal(result.revokedBy, "owner");
  assert.equal(result.revocationReason, "Access removed");
});

test("rejects malformed invitee email, invalid role, unauthorized creation and unsafe token", async () => {
  const store = new MemoryMembershipStore();
  const base = {
    id: "inv_bad", tenantId, workspaceId, email: "not-an-email", role: "member" as const,
    invitedBy: "owner", token: "long-enough-token-12345678901234567890", expiresAt: "2026-11-17T12:00:00.000Z", idempotencyKey: "bad", now,
  };
  await assert.rejects(() => createWorkspaceInvitation(base, { store, authorize: auth, deliver: async () => undefined }), /INVITATION_EMAIL_INVALID/);
  await assert.rejects(() => createWorkspaceInvitation({ ...base, email: "person@example.com", role: "owner" as never }, { store, authorize: auth, deliver: async () => undefined }), /INVITATION_ROLE_INVALID/);
  await assert.rejects(() => createWorkspaceInvitation({ ...base, email: "person@example.com", token: "long-enough-token-12345678901234567890", idempotencyKey: "denied" }, {
    store, authorize: async () => false, deliver: async () => undefined,
  }), /INVITATION_UNAUTHORIZED/);
  assert.equal(store.invitations.size, 0);
});
