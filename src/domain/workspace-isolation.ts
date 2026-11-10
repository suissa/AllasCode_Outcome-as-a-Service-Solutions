import { IdentifierValidationError, parseEntityId } from "./identifiers.ts";
import type { EntityId } from "./identifiers.ts";

export type WorkspaceTenantId = EntityId<"tenant">;
export type WorkspaceId = EntityId<"workspace">;

export interface WorkspaceScope {
  readonly tenantId: WorkspaceTenantId;
  readonly workspaceId: WorkspaceId;
  readonly actorId: string;
  readonly correlationId: string;
}

export interface WorkspaceScopedRecord {
  readonly id: string;
  readonly tenantId: WorkspaceTenantId;
  readonly workspaceId: WorkspaceId;
}

export type WorkspaceRole = "owner" | "admin" | "member" | "viewer";

export interface WorkspaceMembership {
  id: string;
  tenantId: WorkspaceTenantId;
  workspaceId: WorkspaceId;
  actorId: string;
  role: WorkspaceRole;
  permissions: readonly string[];
  status: "pending" | "active" | "suspended" | "revoked";
  grantedBy: string;
  grantedAt: string;
  expiresAt?: string;
  revision: number;
}

export class WorkspaceIsolationError extends Error {
  constructor(readonly code: string, readonly path: string) {
    super(`Workspace isolation violation (${code}) at ${path}.`);
    this.name = "WorkspaceIsolationError";
  }
}

const ROLE_PERMISSIONS: Readonly<Record<WorkspaceRole, ReadonlySet<string>>> = {
  viewer: new Set(["workspace.read", "outcome.read", "evidence.read", "playbook.read"]),
  member: new Set(["workspace.read", "outcome.read", "outcome.create", "outcome.update", "evidence.read", "evidence.create", "playbook.read"]),
  admin: new Set(["workspace.read", "outcome.read", "outcome.create", "outcome.update", "outcome.delete", "evidence.read", "evidence.create", "playbook.read", "workspace.members.manage", "workspace.settings.manage"]),
  owner: new Set(["workspace.read", "outcome.read", "outcome.create", "outcome.update", "outcome.delete", "evidence.read", "evidence.create", "playbook.read", "workspace.members.manage", "workspace.settings.manage", "workspace.delete", "workspace.billing.manage"]),
};

const required = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 256;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function fail(code: string, path: string): never {
  throw new WorkspaceIsolationError(code, path);
}

function parseScopedId(kind: "tenant" | "workspace", value: unknown, path: string): string {
  try {
    return parseEntityId(kind, value, path);
  } catch (error) {
    if (error instanceof IdentifierValidationError) fail("WORKSPACE_SCOPE_INVALID", path);
    throw error;
  }
}

export function requireWorkspaceScope(scope: WorkspaceScope | null | undefined): WorkspaceScope {
  if (!scope || !required(scope.actorId) || !required(scope.correlationId) ||
      /\s/.test(scope.actorId) || /\s/.test(scope.correlationId)) {
    fail("WORKSPACE_SCOPE_INVALID", "scope");
  }
  parseScopedId("tenant", scope.tenantId, "scope.tenantId");
  parseScopedId("workspace", scope.workspaceId, "scope.workspaceId");
  return scope;
}

export function buildWorkspaceQueryFilter(scope: WorkspaceScope): Readonly<{
  tenantId: WorkspaceTenantId;
  workspaceId: WorkspaceId;
}> {
  const valid = requireWorkspaceScope(scope);
  return Object.freeze({ tenantId: valid.tenantId, workspaceId: valid.workspaceId });
}

export function assertWorkspaceRecordScope<T extends WorkspaceScopedRecord>(
  scope: WorkspaceScope,
  record: T,
  path = "record",
): T {
  const valid = requireWorkspaceScope(scope);
  if (!record || !required(record.id)) fail("WORKSPACE_RECORD_INVALID", `${path}.id`);
  const recordTenantId = parseScopedId("tenant", record.tenantId, `${path}.tenantId`);
  const recordWorkspaceId = parseScopedId("workspace", record.workspaceId, `${path}.workspaceId`);
  if (recordTenantId !== valid.tenantId) fail("WORKSPACE_TENANT_MISMATCH", `${path}.tenantId`);
  if (recordWorkspaceId !== valid.workspaceId) fail("WORKSPACE_BOUNDARY_MISMATCH", `${path}.workspaceId`);
  return record;
}

export function assertWorkspaceRecordsScope<T extends WorkspaceScopedRecord>(
  scope: WorkspaceScope,
  records: readonly T[],
): readonly T[] {
  if (!Array.isArray(records)) fail("WORKSPACE_COLLECTION_INVALID", "records");
  const ids = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    const record = assertWorkspaceRecordScope(scope, records[index]!, `records[${index}]`);
    if (ids.has(record.id)) fail("WORKSPACE_RECORD_DUPLICATE", `records[${index}].id`);
    ids.add(record.id);
  }
  return Object.freeze([...records]);
}

export function authorizeWorkspaceAction(
  scope: WorkspaceScope,
  membership: WorkspaceMembership,
  action: string,
  now = new Date(),
): boolean {
  const validScope = requireWorkspaceScope(scope);
  if (!membership || !required(membership.id) || !required(membership.actorId) ||
      !required(membership.grantedBy) || !["owner", "admin", "member", "viewer"].includes(membership.role) ||
      !["pending", "active", "suspended", "revoked"].includes(membership.status) ||
      !Array.isArray(membership.permissions) ||
      membership.permissions.some(permission => !required(permission)) ||
      new Set(membership.permissions).size !== membership.permissions.length ||
      !validTimestamp(membership.grantedAt) ||
      (membership.expiresAt !== undefined && !validTimestamp(membership.expiresAt)) ||
      !Number.isInteger(membership.revision) || membership.revision < 1 ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("WORKSPACE_MEMBERSHIP_INVALID", "membership");
  }
  parseScopedId("tenant", membership.tenantId, "membership.tenantId");
  parseScopedId("workspace", membership.workspaceId, "membership.workspaceId");
  if (membership.tenantId !== validScope.tenantId || membership.workspaceId !== validScope.workspaceId ||
      membership.actorId !== validScope.actorId) {
    fail("WORKSPACE_MEMBERSHIP_MISMATCH", "membership.scope");
  }
  if (Date.parse(membership.grantedAt) > now.getTime()) fail("WORKSPACE_MEMBERSHIP_INVALID", "membership.grantedAt");
  if (membership.expiresAt && Date.parse(membership.expiresAt) <= now.getTime()) return false;
  if (membership.status !== "active") return false;
  const rolePermissions = ROLE_PERMISSIONS[membership.role];
  if (membership.permissions.some(permission => !rolePermissions.has(permission))) {
    fail("WORKSPACE_MEMBERSHIP_INVALID", "membership.permissions");
  }
  if (!required(action)) fail("WORKSPACE_ACTION_INVALID", "action");
  return rolePermissions.has(action) && membership.permissions.includes(action);
}
