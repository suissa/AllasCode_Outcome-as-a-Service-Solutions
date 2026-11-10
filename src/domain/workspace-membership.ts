import { createHash } from "node:crypto";
import { parseEntityId } from "./identifiers.ts";
import type { WorkspaceMembership, WorkspaceRole } from "./workspace-isolation.ts";
import type { WorkspaceId, WorkspaceTenantId } from "./workspace-isolation.ts";

export class WorkspaceInvitationError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "WorkspaceInvitationError";
  }
}

export interface GovernedWorkspaceInvitation {
  id: string;
  tenantId: WorkspaceTenantId;
  workspaceId: WorkspaceId;
  recipientHash: string;
  tokenHash: string;
  role: Exclude<WorkspaceRole, "owner">;
  permissions: readonly string[];
  invitedBy: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  createdAt: string;
  expiresAt: string;
  revision: number;
  acceptedAt?: string;
  acceptedBy?: string;
  revokedAt?: string;
  revokedBy?: string;
  revocationReason?: string;
}

export interface WorkspaceInvitationStore {
  findInvitationByIdempotency(tenantId: string, key: string): Promise<GovernedWorkspaceInvitation | undefined>;
  findPendingInvitationByRecipient(tenantId: string, workspaceId: string, recipientHash: string): Promise<GovernedWorkspaceInvitation | undefined>;
  createInvitation(invitation: GovernedWorkspaceInvitation, idempotencyKey: string): Promise<boolean>;
  findInvitationByTokenHash(tenantId: string, tokenHash: string): Promise<GovernedWorkspaceInvitation | undefined>;
  getInvitation(tenantId: string, id: string): Promise<GovernedWorkspaceInvitation | undefined>;
  commitInvitation(updated: GovernedWorkspaceInvitation, expectedRevision: number): Promise<boolean>;
  acceptInvitation(invitation: GovernedWorkspaceInvitation, membership: WorkspaceMembership, expectedRevision: number): Promise<boolean>;
  getMembership(tenantId: string, workspaceId: string, id: string): Promise<WorkspaceMembership | undefined>;
  listMemberships(tenantId: string, workspaceId: string): Promise<readonly WorkspaceMembership[]>;
  commitMembership(updated: WorkspaceMembership, expectedRevision: number): Promise<boolean>;
}

export interface WorkspaceInvitationDependencies {
  store: WorkspaceInvitationStore;
  authorize(actorId: string, tenantId: WorkspaceTenantId, workspaceId: WorkspaceId, action: string): Promise<boolean>;
}

const ROLE_PERMISSIONS: Readonly<Record<WorkspaceRole, readonly string[]>> = {
  owner: ["workspace.read", "outcome.read", "outcome.create", "outcome.update", "outcome.delete", "evidence.read", "evidence.create", "playbook.read", "workspace.members.manage", "workspace.settings.manage", "workspace.delete", "workspace.billing.manage"],
  admin: ["workspace.read", "outcome.read", "outcome.create", "outcome.update", "outcome.delete", "evidence.read", "evidence.create", "playbook.read", "workspace.members.manage", "workspace.settings.manage"],
  member: ["workspace.read", "outcome.read", "outcome.create", "outcome.update", "evidence.read", "evidence.create", "playbook.read"],
  viewer: ["workspace.read", "outcome.read", "evidence.read", "playbook.read"],
};

const required = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 512;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function fail(code: string, path: string): never {
  throw new WorkspaceInvitationError(code, path);
}

function digest(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function normalizeEmail(value: unknown): string {
  if (typeof value !== "string") fail("INVITATION_EMAIL_INVALID", "email");
  const normalized = value.trim().toLowerCase();
  if (normalized.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
    fail("INVITATION_EMAIL_INVALID", "email");
  }
  return normalized;
}

function validateScope(tenantId: unknown, workspaceId: unknown): void {
  try {
    parseEntityId("tenant", tenantId);
    parseEntityId("workspace", workspaceId);
  } catch {
    fail("INVITATION_SCOPE_INVALID", "tenantId/workspaceId");
  }
}

async function authorize(
  actorId: string,
  tenantId: WorkspaceTenantId,
  workspaceId: WorkspaceId,
  action: string,
  dependencies: WorkspaceInvitationDependencies,
): Promise<void> {
  if (!required(actorId)) fail("INVITATION_INPUT_INVALID", "actorId");
  if (!await dependencies.authorize(actorId, tenantId, workspaceId, action)) fail("INVITATION_UNAUTHORIZED", "actorId");
}

export async function createWorkspaceInvitation(
  input: {
    id: string;
    tenantId: WorkspaceTenantId;
    workspaceId: WorkspaceId;
    email: string;
    role: WorkspaceRole;
    invitedBy: string;
    token: string;
    expiresAt: string;
    idempotencyKey: string;
    now?: Date;
  },
  dependencies: WorkspaceInvitationDependencies & {
    deliver(email: string, token: string, invitation: Readonly<GovernedWorkspaceInvitation>): Promise<void>;
  },
): Promise<Readonly<GovernedWorkspaceInvitation>> {
  if (!input || !required(input.id) || !required(input.idempotencyKey) ||
      !required(input.invitedBy) || !required(input.token) || input.token.length < 32 ||
      !["admin", "member", "viewer"].includes(input.role) || !validTimestamp(input.expiresAt)) {
    if (input && input.role === "owner") fail("INVITATION_ROLE_INVALID", "role");
    if (input && (!required(input.token) || input.token.length < 32)) fail("INVITATION_TOKEN_INVALID", "token");
    fail("INVITATION_INPUT_INVALID", "input");
  }
  validateScope(input.tenantId, input.workspaceId);
  const email = normalizeEmail(input.email);
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("INVITATION_CLOCK_INVALID", "now");
  if (Date.parse(input.expiresAt) <= now.getTime() || Date.parse(input.expiresAt) > now.getTime() + 30 * 86400_000) {
    fail("INVITATION_EXPIRY_INVALID", "expiresAt");
  }
  await authorize(input.invitedBy, input.tenantId, input.workspaceId, "workspace.members.manage", dependencies);
  const recipientHash = digest(email);
  const replay = await dependencies.store.findInvitationByIdempotency(input.tenantId, input.idempotencyKey);
  if (replay) {
    if (replay.id !== input.id || replay.recipientHash !== recipientHash) fail("INVITATION_IDEMPOTENCY_CONFLICT", "idempotencyKey");
    return Object.freeze({ ...replay, permissions: Object.freeze([...replay.permissions]) });
  }
  if (await dependencies.store.findPendingInvitationByRecipient(input.tenantId, input.workspaceId, recipientHash)) {
    fail("INVITATION_DUPLICATE_PENDING", "email");
  }
  const invitation: GovernedWorkspaceInvitation = Object.freeze({
    id: input.id, tenantId: input.tenantId, workspaceId: input.workspaceId,
    recipientHash, tokenHash: digest(input.token), role: input.role as Exclude<WorkspaceRole, "owner">,
    permissions: Object.freeze([...ROLE_PERMISSIONS[input.role]]),
    invitedBy: input.invitedBy, status: "pending",
    createdAt: now.toISOString(), expiresAt: input.expiresAt, revision: 1,
  });
  if (!await dependencies.store.createInvitation(invitation, input.idempotencyKey)) {
    fail("INVITATION_IDEMPOTENCY_CONFLICT", "idempotencyKey");
  }
  try {
    await dependencies.deliver(email, input.token, invitation);
  } catch {
    const revoked = Object.freeze({
      ...invitation, status: "revoked" as const, revokedAt: now.toISOString(),
      revokedBy: input.invitedBy, revocationReason: "DELIVERY_FAILED", revision: invitation.revision + 1,
    });
    if (!await dependencies.store.commitInvitation(revoked, invitation.revision)) {
      fail("INVITATION_DELIVERY_RECOVERY_REQUIRED", "invitation.revision");
    }
    fail("INVITATION_DELIVERY_FAILED", "delivery");
  }
  return invitation;
}

export async function acceptWorkspaceInvitation(
  input: {
    tenantId: WorkspaceTenantId;
    workspaceId: WorkspaceId;
    actorId: string;
    token: string;
    now?: Date;
  },
  dependencies: {
    store: WorkspaceInvitationStore;
    verifyRecipient(actorId: string, recipientHash: string): Promise<boolean>;
  },
): Promise<Readonly<WorkspaceMembership>> {
  if (!input || !required(input.actorId) || !required(input.token) || input.token.length < 32) {
    fail("INVITATION_ACCEPT_INPUT_INVALID", "input");
  }
  validateScope(input.tenantId, input.workspaceId);
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("INVITATION_CLOCK_INVALID", "now");
  const invitation = await dependencies.store.findInvitationByTokenHash(input.tenantId, digest(input.token));
  if (!invitation) fail("INVITATION_NOT_FOUND", "token");
  if (invitation.tenantId !== input.tenantId || invitation.workspaceId !== input.workspaceId) {
    fail("INVITATION_NOT_FOUND", "token");
  }
  if (invitation.status !== "pending") fail("INVITATION_NOT_PENDING", "invitation.status");
  if (Date.parse(invitation.expiresAt) <= now.getTime()) fail("INVITATION_EXPIRED", "invitation.expiresAt");
  if (!await dependencies.verifyRecipient(input.actorId, invitation.recipientHash)) {
    fail("INVITATION_RECIPIENT_MISMATCH", "actorId");
  }
  const membership: WorkspaceMembership = Object.freeze({
    id: `membership_${invitation.id}`,
    tenantId: invitation.tenantId,
    workspaceId: invitation.workspaceId,
    actorId: input.actorId,
    role: invitation.role,
    permissions: Object.freeze([...invitation.permissions]),
    status: "active",
    grantedBy: invitation.invitedBy,
    grantedAt: now.toISOString(),
    revision: 1,
  });
  if (!await dependencies.store.acceptInvitation(invitation, membership, invitation.revision)) {
    fail("INVITATION_NOT_PENDING", "invitation.revision");
  }
  return membership;
}

export async function revokeWorkspaceInvitation(
  input: {
    tenantId: WorkspaceTenantId;
    workspaceId: WorkspaceId;
    invitationId: string;
    actorId: string;
    expectedRevision: number;
    reason: string;
    now?: Date;
  },
  dependencies: WorkspaceInvitationDependencies,
): Promise<Readonly<GovernedWorkspaceInvitation>> {
  if (!input || !required(input.invitationId) || !required(input.reason) ||
      !Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    fail("INVITATION_REVOCATION_INPUT_INVALID", "input");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("INVITATION_CLOCK_INVALID", "now");
  await authorize(input.actorId, input.tenantId, input.workspaceId, "workspace.members.manage", dependencies);
  const current = await dependencies.store.getInvitation(input.tenantId, input.invitationId);
  if (!current || current.workspaceId !== input.workspaceId) fail("INVITATION_NOT_FOUND", "invitationId");
  if (current.status !== "pending") fail("INVITATION_NOT_PENDING", "invitation.status");
  if (current.revision !== input.expectedRevision) fail("INVITATION_REVISION_CONFLICT", "expectedRevision");
  const updated = Object.freeze({
    ...current, status: "revoked" as const, revokedAt: now.toISOString(),
    revokedBy: input.actorId, revocationReason: input.reason, revision: current.revision + 1,
  });
  if (!await dependencies.store.commitInvitation(updated, current.revision)) fail("INVITATION_REVISION_CONFLICT", "invitation.revision");
  return updated;
}

export async function revokeWorkspaceMembership(
  input: {
    tenantId: WorkspaceTenantId;
    workspaceId: WorkspaceId;
    membershipId: string;
    actorId: string;
    expectedRevision: number;
    reason: string;
    now?: Date;
  },
  dependencies: WorkspaceInvitationDependencies,
): Promise<Readonly<WorkspaceMembership>> {
  if (!input || !required(input.membershipId) || !required(input.reason) ||
      !Number.isInteger(input.expectedRevision) || input.expectedRevision < 1) {
    fail("MEMBERSHIP_REVOCATION_INPUT_INVALID", "input");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("INVITATION_CLOCK_INVALID", "now");
  await authorize(input.actorId, input.tenantId, input.workspaceId, "workspace.members.manage", dependencies);
  const current = await dependencies.store.getMembership(input.tenantId, input.workspaceId, input.membershipId);
  if (!current) fail("MEMBERSHIP_NOT_FOUND", "membershipId");
  if (current.revision !== input.expectedRevision) fail("MEMBERSHIP_REVISION_CONFLICT", "expectedRevision");
  if (current.status !== "active") fail("MEMBERSHIP_NOT_ACTIVE", "membership.status");
  if (current.role === "owner") {
    const activeOwners = (await dependencies.store.listMemberships(input.tenantId, input.workspaceId))
      .filter(item => item.role === "owner" && item.status === "active");
    if (activeOwners.length <= 1) fail("MEMBERSHIP_LAST_OWNER_REQUIRED", "membership.role");
  }
  const updated: WorkspaceMembership = Object.freeze({
    ...current, status: "revoked", revokedAt: now.toISOString(), revokedBy: input.actorId,
    revocationReason: input.reason, revision: current.revision + 1,
  });
  if (!await dependencies.store.commitMembership(updated, current.revision)) {
    fail("MEMBERSHIP_REVISION_CONFLICT", "membership.revision");
  }
  return updated;
}
