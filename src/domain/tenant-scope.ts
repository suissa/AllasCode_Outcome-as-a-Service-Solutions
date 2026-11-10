import type { EntityId } from "./identifiers.ts";
import { IdentifierValidationError, parseEntityId } from "./identifiers.ts";

export type TenantId = EntityId<"tenant">;

export interface TenantScoped {
  readonly tenantId: TenantId;
}

export interface TenantScope {
  readonly tenantId: TenantId;
  readonly actorId: string;
  readonly correlationId: string;
}

/** Validate that a record belongs to the active tenant before any access or mutation. */
export function assertTenantScope<T extends TenantScoped>(
  scope: TenantScope,
  record: T,
  path = "record.tenantId",
): T {
  const activeScope = requireTenantScope(scope);
  const recordTenantId = parseEntityId("tenant", record?.tenantId, path);
  if (activeScope.tenantId !== recordTenantId) {
    throw new TenantIsolationError(path, activeScope.tenantId, recordTenantId);
  }
  return record;
}

export class TenantIsolationError extends Error {
  readonly code = "TENANT_SCOPE_MISMATCH" as const;
  readonly path: string;
  /** IDs intentionally omitted from message to avoid cross-tenant disclosure. */
  constructor(path: string, _expected: TenantId, _actual: TenantId) {
    super("Record is outside the active tenant scope.");
    this.name = "TenantIsolationError";
    this.path = path;
  }
}

/** Fail closed when tenant scope is absent; never fall back to a global query. */
export function requireTenantScope(scope: TenantScope | null | undefined): TenantScope {
  if (!scope?.tenantId || typeof scope.actorId !== "string" || !scope.actorId.trim() || scope.actorId.length > 256 ||
      typeof scope.correlationId !== "string" || !scope.correlationId.trim() || scope.correlationId.length > 256 ||
      /\\s/.test(scope.actorId) || /\\s/.test(scope.correlationId)) {
    throw new TenantIsolationError("scope", "tenant_missing" as TenantId, "record_missing" as TenantId);
  }
  const tenantId = parseEntityId("tenant", scope.tenantId, "scope.tenantId");
  return Object.freeze({ ...scope, tenantId });
}
