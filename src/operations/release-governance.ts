import { createHash } from "node:crypto";

export class ReleaseGovernanceError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "ReleaseGovernanceError";
  }
}

export type GovernedReleaseStatus = "draft" | "approved" | "deploying" | "rolling_out" | "deployed" | "failed" | "rolled_back";
export type MigrationRecoveryStrategy = "down_migration" | "forward_fix" | "backup_restore";

export interface ReleaseMigration {
  id: string;
  checksum: string;
  order: number;
  destructive: boolean;
  reversible: boolean;
  recoveryStrategy: MigrationRecoveryStrategy;
}

export interface GovernedReleaseChecks {
  ciPassed: boolean;
  testsPassed: boolean;
  securityPassed: boolean;
  migrationsVerified: boolean;
  backupVerified: boolean;
  sloHealthy: boolean;
}

export interface GovernedReleaseManifest {
  id: string;
  tenantId: string;
  version: string;
  previousVersion: string;
  commitSha: string;
  artifactHash: string;
  createdBy: string;
  target: "staging" | "production";
  migrations: readonly ReleaseMigration[];
  rollbackPlan: readonly string[];
  checks: GovernedReleaseChecks;
  status: GovernedReleaseStatus;
  revision: number;
  createdAt: string;
  completedMigrations: readonly { id: string; checksum: string; appliedAt: string }[];
  rolloutPercentage: number;
  rolloutHistory: readonly { percentage: number; evaluatedAt: string; healthPassed: boolean }[];
  approvedBy?: string;
  approvedAt?: string;
  startedAt?: string;
  deployedAt?: string;
  failureCode?: string;
  rolledBackBy?: string;
  rolledBackAt?: string;
  rollbackActions: readonly string[];
}

export interface GovernedFeatureFlag {
  tenantId: string;
  key: string;
  enabled: boolean;
  percentage: number;
  allowlist: readonly string[];
  denylist: readonly string[];
  salt: string;
  updatedBy: string;
  updatedAt: string;
  activeFrom?: string;
  expiresAt?: string;
}

const required = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 256;

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function fail(code: string, path: string): never {
  throw new ReleaseGovernanceError(code, path);
}

function validateMigrationPlan(migrations: readonly ReleaseMigration[]): void {
  if (!Array.isArray(migrations) || migrations.length === 0) fail("RELEASE_MIGRATION_PLAN_REQUIRED", "migrations");
  const ids = new Set<string>();
  const orders = new Set<number>();
  for (let index = 0; index < migrations.length; index += 1) {
    const migration = migrations[index]!;
    const path = `migrations[${index}]`;
    if (!migration || !/^\d{4}_[a-z0-9_]+\.sql$/.test(migration.id) ||
        !/^[a-f0-9]{64}$/i.test(migration.checksum) ||
        !Number.isInteger(migration.order) || migration.order < 1 ||
        typeof migration.destructive !== "boolean" || typeof migration.reversible !== "boolean") {
      fail("RELEASE_MIGRATION_INVALID", path);
    }
    if (ids.has(migration.id)) fail("RELEASE_MIGRATION_DUPLICATE", `${path}.id`);
    if (orders.has(migration.order)) fail("RELEASE_MIGRATION_ORDER_INVALID", `${path}.order`);
    ids.add(migration.id);
    orders.add(migration.order);
    if (migration.destructive && !migration.recoveryStrategy) fail("RELEASE_MIGRATION_RECOVERY_REQUIRED", `${path}.recoveryStrategy`);
    if (!["down_migration", "forward_fix", "backup_restore"].includes(migration.recoveryStrategy)) {
      fail("RELEASE_MIGRATION_RECOVERY_REQUIRED", `${path}.recoveryStrategy`);
    }
    if (migration.reversible && migration.recoveryStrategy !== "down_migration") {
      fail("RELEASE_MIGRATION_RECOVERY_INVALID", `${path}.recoveryStrategy`);
    }
    if (!migration.reversible && migration.recoveryStrategy === "down_migration") {
      fail("RELEASE_MIGRATION_RECOVERY_INVALID", `${path}.recoveryStrategy`);
    }
  }
  const sorted = [...migrations].sort((a, b) => a.order - b.order);
  if (sorted.some((item, index) => item.order !== index + 1)) fail("RELEASE_MIGRATION_ORDER_INVALID", "migrations.order");
}

export function createGovernedRelease(
  input: Omit<GovernedReleaseManifest, "status" | "revision" | "createdAt" | "completedMigrations" | "rolloutPercentage" | "rolloutHistory" | "rollbackActions">,
  now = new Date(),
): Readonly<GovernedReleaseManifest> {
  if (!input || !required(input.id) || !required(input.tenantId) ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(input.version) ||
      !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(input.previousVersion) ||
      !/^(?:[a-f0-9]{40}|[a-f0-9]{64})$/i.test(input.commitSha) ||
      !/^[a-f0-9]{64}$/i.test(input.artifactHash) || !required(input.createdBy) ||
      (input.target !== "staging" && input.target !== "production") ||
      !input.checks || Object.values(input.checks).some(value => typeof value !== "boolean") ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("RELEASE_MANIFEST_INVALID", "manifest");
  }
  if (!Array.isArray(input.rollbackPlan) || input.rollbackPlan.length === 0 ||
      input.rollbackPlan.some(action => !required(action)) ||
      new Set(input.rollbackPlan).size !== input.rollbackPlan.length) fail("RELEASE_ROLLBACK_PLAN_REQUIRED", "rollbackPlan");
  validateMigrationPlan(input.migrations);
  return Object.freeze({
    ...input,
    migrations: Object.freeze([...input.migrations].sort((a, b) => a.order - b.order).map(item => Object.freeze({ ...item }))),
    rollbackPlan: Object.freeze([...input.rollbackPlan]),
    checks: Object.freeze({ ...input.checks }),
    status: "draft",
    revision: 1,
    createdAt: now.toISOString(),
    completedMigrations: Object.freeze([]),
    rolloutPercentage: 0,
    rolloutHistory: Object.freeze([]),
    rollbackActions: Object.freeze([]),
  });
}

export function approveGovernedRelease(
  release: GovernedReleaseManifest,
  actor: string,
  now = new Date(),
): Readonly<GovernedReleaseManifest> {
  if (!release || release.status !== "draft" || !required(actor) || actor === release.createdBy ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("RELEASE_APPROVAL_INDEPENDENT_REQUIRED", "approvedBy");
  }
  if (Object.values(release.checks).some(value => value !== true)) fail("RELEASE_GATES_FAILED", "checks");
  return Object.freeze({ ...release, status: "approved", approvedBy: actor, approvedAt: now.toISOString(), revision: release.revision + 1 });
}

export function startGovernedRelease(release: GovernedReleaseManifest, now = new Date()): Readonly<GovernedReleaseManifest> {
  if (!release || release.status !== "approved" || !release.approvedBy ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) fail("RELEASE_NOT_APPROVED", "status");
  return Object.freeze({ ...release, status: "deploying", startedAt: now.toISOString(), revision: release.revision + 1 });
}

export function verifyReleaseMigrations(
  expected: readonly ReleaseMigration[],
  applied: readonly { id: string; checksum: string }[],
): boolean {
  validateMigrationPlan(expected);
  if (!Array.isArray(applied) || applied.length !== expected.length) fail("RELEASE_MIGRATION_SET_MISMATCH", "applied");
  const ordered = [...expected].sort((a, b) => a.order - b.order);
  for (let index = 0; index < ordered.length; index += 1) {
    if (applied[index]?.id !== ordered[index]!.id) fail("RELEASE_MIGRATION_SET_MISMATCH", `applied[${index}].id`);
    if (applied[index]?.checksum !== ordered[index]!.checksum) fail("RELEASE_MIGRATION_CHECKSUM_DRIFT", `applied[${index}].checksum`);
  }
  return true;
}

export function recordReleaseMigration(
  release: GovernedReleaseManifest,
  applied: { id: string; checksum: string; appliedAt: string },
): Readonly<GovernedReleaseManifest> {
  if (!release || release.status !== "deploying") fail("RELEASE_NOT_DEPLOYING", "status");
  const expected = release.migrations[release.completedMigrations.length];
  if (!expected || applied.id !== expected.id) fail("RELEASE_MIGRATION_ORDER_INVALID", "migration.id");
  if (applied.checksum !== expected.checksum) fail("RELEASE_MIGRATION_CHECKSUM_DRIFT", "migration.checksum");
  if (!validTimestamp(applied.appliedAt) ||
      (release.startedAt !== undefined && Date.parse(applied.appliedAt) < Date.parse(release.startedAt))) {
    fail("RELEASE_MIGRATION_TIMESTAMP_INVALID", "migration.appliedAt");
  }
  const completed = Object.freeze([...release.completedMigrations, Object.freeze({ ...applied })]);
  return Object.freeze({ ...release, completedMigrations: completed, revision: release.revision + 1 });
}

export function advanceReleaseRollout(
  release: GovernedReleaseManifest,
  percentage: number,
  healthPassed: boolean,
  now = new Date(),
): Readonly<GovernedReleaseManifest> {
  if (!release || (release.status !== "deploying" && release.status !== "rolling_out")) fail("RELEASE_NOT_DEPLOYING", "status");
  if (release.completedMigrations.length !== release.migrations.length) fail("RELEASE_MIGRATIONS_INCOMPLETE", "completedMigrations");
  if (!Number.isInteger(percentage) || percentage < 1 || percentage > 100) fail("RELEASE_ROLLOUT_PERCENTAGE_INVALID", "percentage");
  if (percentage <= release.rolloutPercentage) fail("RELEASE_ROLLOUT_NOT_MONOTONIC", "percentage");
  if (healthPassed !== true) fail("RELEASE_HEALTH_GATE_FAILED", "healthPassed");
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("RELEASE_TIMESTAMP_INVALID", "now");
  const history = Object.freeze([...release.rolloutHistory, Object.freeze({ percentage, evaluatedAt: now.toISOString(), healthPassed })]);
  return Object.freeze({ ...release, status: "rolling_out", rolloutPercentage: percentage, rolloutHistory: history, revision: release.revision + 1 });
}

export function completeGovernedRelease(
  release: GovernedReleaseManifest,
  now = new Date(),
): Readonly<GovernedReleaseManifest> {
  if (!release || release.status !== "rolling_out" || release.rolloutPercentage !== 100) {
    fail("RELEASE_ROLLOUT_INCOMPLETE", "rolloutPercentage");
  }
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("RELEASE_TIMESTAMP_INVALID", "now");
  return Object.freeze({ ...release, status: "deployed", deployedAt: now.toISOString(), revision: release.revision + 1 });
}

export function rollbackGovernedRelease(
  release: GovernedReleaseManifest,
  actor: string,
  now = new Date(),
): Readonly<GovernedReleaseManifest> {
  if (!release || !["deploying", "rolling_out", "deployed", "failed"].includes(release.status)) {
    fail("RELEASE_NOT_ROLLBACKABLE", "status");
  }
  if (!required(actor) || actor === release.createdBy || actor === release.approvedBy) {
    fail("RELEASE_ROLLBACK_ACTOR_INVALID", "actor");
  }
  if (!release.rollbackPlan.length || !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("RELEASE_ROLLBACK_PLAN_REQUIRED", "rollbackPlan");
  }
  return Object.freeze({
    ...release,
    status: "rolled_back",
    rolledBackBy: actor,
    rolledBackAt: now.toISOString(),
    rollbackActions: Object.freeze([...release.rollbackPlan]),
    revision: release.revision + 1,
  });
}

export function validateGovernedFeatureFlag(flag: GovernedFeatureFlag, now = new Date()): void {
  if (!flag || !required(flag.tenantId) || !required(flag.key) || !required(flag.salt) ||
      !required(flag.updatedBy) || !validTimestamp(flag.updatedAt) ||
      typeof flag.enabled !== "boolean" ||
      !Array.isArray(flag.allowlist) || !Array.isArray(flag.denylist) ||
      flag.allowlist.some(item => !required(item)) || flag.denylist.some(item => !required(item)) ||
      (flag.activeFrom !== undefined && !validTimestamp(flag.activeFrom)) ||
      (flag.expiresAt !== undefined && !validTimestamp(flag.expiresAt)) ||
      !(now instanceof Date) || !Number.isFinite(now.getTime())) {
    fail("FEATURE_FLAG_INVALID", "flag");
  }
  if (!Number.isInteger(flag.percentage) || flag.percentage < 0 || flag.percentage > 100) fail("FEATURE_FLAG_PERCENTAGE_INVALID", "percentage");
  if (new Set(flag.allowlist).size !== flag.allowlist.length || new Set(flag.denylist).size !== flag.denylist.length) fail("FEATURE_FLAG_ACTOR_DUPLICATE", "allowlist/denylist");
  if (Date.parse(flag.updatedAt) > now.getTime()) fail("FEATURE_FLAG_TIMESTAMP_INVALID", "updatedAt");
  if (flag.expiresAt && flag.activeFrom && Date.parse(flag.expiresAt) <= Date.parse(flag.activeFrom)) {
    fail("FEATURE_FLAG_INVALID", "expiresAt");
  }
}

export function evaluateGovernedFeatureFlag(
  flag: GovernedFeatureFlag,
  tenantId: string,
  subjectId: string,
  now = new Date(),
): boolean {
  validateGovernedFeatureFlag(flag, now);
  if (flag.tenantId !== tenantId) return false;
  if (flag.expiresAt && Date.parse(flag.expiresAt) <= now.getTime()) fail("FEATURE_FLAG_EXPIRED", "expiresAt");
  if (flag.activeFrom && Date.parse(flag.activeFrom) > now.getTime()) fail("FEATURE_FLAG_NOT_YET_ACTIVE", "activeFrom");
  if (!required(subjectId) || !flag.enabled) return false;
  if (flag.denylist.includes(subjectId)) return false;
  if (flag.allowlist.includes(subjectId)) return true;
  if (flag.percentage === 0) return false;
  if (flag.percentage === 100) return true;
  const digest = createHash("sha256").update(`${flag.tenantId}: ${flag.key}: ${flag.salt}: ${subjectId}`, "utf8").digest("hex");
  const bucket = Number.parseInt(digest.slice(0, 8), 16) % 10_000;
  return bucket < flag.percentage * 100;
}
