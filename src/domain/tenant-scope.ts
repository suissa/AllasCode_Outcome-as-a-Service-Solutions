import type { EntityId } from "./identifiers.ts";
import { IdentifierValidationError } from "./identifiers.ts";

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
  if (!scope.tenantId || !record?.tenantId) {
    throw new IdentifierValidationError({
      code: "ID_REQUIRED", path,
      message: "Tenant scope and record tenant ID are mandatory.",
    });
  }
  if (scope.tenantId !== record.tenantId) {
    throw new TenantIsolationError(path, scope.tenantId, record.tenantId);
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
  if (!scope?.tenantId || !scope.actorId || !scope.correlationId) {
    throw new TenantIsolationError("scope", "tenant_missing" as TenantId, "record_missing" as TenantId);
  }
  return scope;
}
