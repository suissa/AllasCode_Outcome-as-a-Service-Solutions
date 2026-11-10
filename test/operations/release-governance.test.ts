import test from "node:test";
import assert from "node:assert/strict";
import {
  ReleaseGovernanceError,
  advanceReleaseRollout,
  approveGovernedRelease,
  completeGovernedRelease,
  createGovernedRelease,
  evaluateGovernedFeatureFlag,
  recordReleaseMigration,
  rollbackGovernedRelease,
  startGovernedRelease,
  validateGovernedFeatureFlag,
  verifyReleaseMigrations,
  type GovernedFeatureFlag,
  type GovernedReleaseManifest,
} from "../../src/operations/release-governance.ts";

const now = new Date("2026-11-10T12:00:00.000Z");
const migrations = [
  { id: "0001_core.sql", checksum: "a".repeat(64), order: 1, destructive: false, reversible: true, recoveryStrategy: "down_migration" as const },
  { id: "0002_indexes.sql", checksum: "b".repeat(64), order: 2, destructive: true, reversible: false, recoveryStrategy: "backup_restore" as const },
];
const manifest: Omit<GovernedReleaseManifest, "status" | "revision"> = {
  id: "release_2026_11", tenantId: "tenant_a", version: "2.0.0", previousVersion: "1.9.0",
  commitSha: "c".repeat(40), artifactHash: "d".repeat(64), createdBy: "release_owner",
  target: "production", migrations,
  rollbackPlan: ["disable_feature_flags", "restore_previous_artifact", "verify_recovery"],
  checks: { ciPassed: true, testsPassed: true, securityPassed: true, migrationsVerified: true, backupVerified: true, sloHealthy: true },
};

function release() {
  return createGovernedRelease(manifest, now);
}

test("creates and independently approves only complete release candidates with all quality gates", () => {
  const candidate = release();
  assert.equal(candidate.status, "draft");
  assert.equal(approveGovernedRelease(candidate, "reviewer", now).status, "approved");
  assert.throws(() => approveGovernedRelease(candidate, "release_owner", now), /RELEASE_APPROVAL_INDEPENDENT_REQUIRED/);
  assert.throws(() => createGovernedRelease({ ...manifest, rollbackPlan: [] }, now), /RELEASE_ROLLBACK_PLAN_REQUIRED/);
  assert.throws(() => approveGovernedRelease({ ...candidate, checks: { ...candidate.checks, securityPassed: false } }, "reviewer", now), /RELEASE_GATES_FAILED/);
});

test("validates migration order, checksums and explicit recovery for destructive changes", () => {
  assert.equal(verifyReleaseMigrations(manifest.migrations, [
    { id: "0001_core.sql", checksum: "a".repeat(64) },
    { id: "0002_indexes.sql", checksum: "b".repeat(64) },
  ]), true);
  assert.throws(() => verifyReleaseMigrations(manifest.migrations, [
    { id: "0001_core.sql", checksum: "a".repeat(64) },
  ]), /RELEASE_MIGRATION_SET_MISMATCH/);
  assert.throws(() => verifyReleaseMigrations(manifest.migrations, [
    { id: "0001_core.sql", checksum: "a".repeat(64) },
    { id: "0002_indexes.sql", checksum: "f".repeat(64) },
  ]), /RELEASE_MIGRATION_CHECKSUM_DRIFT/);
  assert.throws(() => createGovernedRelease({
    ...manifest, migrations: [{ ...migrations[1]!, recoveryStrategy: undefined as never }],
  }, now), /RELEASE_MIGRATION_RECOVERY_REQUIRED/);
});

test("release migration execution is ordered, checksum-bound and revisioned", () => {
  let current = startGovernedRelease(approveGovernedRelease(release(), "reviewer", now), now);
  current = recordReleaseMigration(current, { id: "0001_core.sql", checksum: "a".repeat(64), appliedAt: now.toISOString() });
  assert.equal(current.completedMigrations.length, 1);
  assert.throws(() => recordReleaseMigration(current, { id: "0001_core.sql", checksum: "a".repeat(64), appliedAt: now.toISOString() }), /RELEASE_MIGRATION_ORDER_INVALID/);
  assert.throws(() => recordReleaseMigration(current, { id: "0002_indexes.sql", checksum: "f".repeat(64), appliedAt: now.toISOString() }), /RELEASE_MIGRATION_CHECKSUM_DRIFT/);
  current = recordReleaseMigration(current, { id: "0002_indexes.sql", checksum: "b".repeat(64), appliedAt: now.toISOString() });
  assert.equal(current.completedMigrations.length, 2);
});

test("cannot begin rollout before all migrations have completed", () => {
  const approved = approveGovernedRelease(release(), "reviewer", now);
  const started = startGovernedRelease(approved, now);
  assert.throws(() => advanceReleaseRollout(started, 10, true, now), /RELEASE_MIGRATIONS_INCOMPLETE/);
});

test("progressive rollout is monotonic, bounded and health-gated", () => {
  let current = approveGovernedRelease(release(), "reviewer", now);
  current = startGovernedRelease(current, now);
  current = recordReleaseMigration(current, { id: "0001_core.sql", checksum: "a".repeat(64), appliedAt: now.toISOString() });
  current = recordReleaseMigration(current, { id: "0002_indexes.sql", checksum: "b".repeat(64), appliedAt: now.toISOString() });
  current = advanceReleaseRollout(current, 5, true, now);
  assert.equal(current.rolloutPercentage, 5);
  assert.throws(() => advanceReleaseRollout(current, 10, false, now), /RELEASE_HEALTH_GATE_FAILED/);
  current = advanceReleaseRollout(current, 25, true, now);
  assert.throws(() => advanceReleaseRollout(current, 10, true, now), /RELEASE_ROLLOUT_NOT_MONOTONIC/);
  assert.throws(() => advanceReleaseRollout(current, 101, true, now), /RELEASE_ROLLOUT_PERCENTAGE_INVALID/);
  current = advanceReleaseRollout(current, 100, true, now);
  assert.equal(completeGovernedRelease(current, now).status, "deployed");
});

test("failed releases can be rolled back only by an independent operator", () => {
  let current = approveGovernedRelease(release(), "reviewer", now);
  current = startGovernedRelease(current, now);
  assert.throws(() => rollbackGovernedRelease(current, "reviewer", now), /RELEASE_ROLLBACK_ACTOR_INVALID/);
  assert.throws(() => rollbackGovernedRelease(current, "release_owner", now), /RELEASE_ROLLBACK_ACTOR_INVALID/);
  const failed = { ...current, status: "failed" as const, failureCode: "DEPLOYMENT_HEALTH_FAILED" };
  const rolledBack = rollbackGovernedRelease(failed, "operator", now);
  assert.equal(rolledBack.status, "rolled_back");
  assert.equal(rolledBack.rollbackActions.length, 3);
});

test("feature flags use deterministic tenant-scoped percentage buckets with deny precedence", () => {
  const flag: GovernedFeatureFlag = {
    tenantId: "tenant_a", key: "new-checkout", enabled: true, percentage: 50,
    allowlist: ["actor_allowed"], denylist: ["actor_denied"], salt: "release-2026-11",
    updatedBy: "operator", updatedAt: now.toISOString(),
  };
  const first = evaluateGovernedFeatureFlag(flag, "tenant_a", "actor_1", now);
  assert.equal(evaluateGovernedFeatureFlag(flag, "tenant_a", "actor_1", now), first);
  assert.equal(evaluateGovernedFeatureFlag(flag, "tenant_a", "actor_allowed", now), true);
  assert.equal(evaluateGovernedFeatureFlag(flag, "tenant_a", "actor_denied", now), false);
  assert.equal(evaluateGovernedFeatureFlag(flag, "tenant_b", "actor_allowed", now), false);
  assert.throws(() => evaluateGovernedFeatureFlag(flag, "tenant_a", "actor_1", new Date("2026-11-10T11:00:00.000Z")), /FEATURE_FLAG_NOT_YET_ACTIVE/);
});

test("feature flag validation rejects invalid percentages, duplicate actors and expired flags", () => {
  const flag: GovernedFeatureFlag = {
    tenantId: "tenant_a", key: "feature-x", enabled: true, percentage: 20,
    allowlist: ["actor_1"], denylist: [], salt: "salt",
    updatedBy: "operator", updatedAt: now.toISOString(), expiresAt: "2027-01-01T00:00:00.000Z",
  };
  assert.doesNotThrow(() => validateGovernedFeatureFlag(flag, now));
  assert.throws(() => validateGovernedFeatureFlag({ ...flag, percentage: 101 }, now), /FEATURE_FLAG_PERCENTAGE_INVALID/);
  assert.throws(() => validateGovernedFeatureFlag({ ...flag, allowlist: ["actor_1", "actor_1"] }, now), /FEATURE_FLAG_ACTOR_DUPLICATE/);
  assert.throws(() => evaluateGovernedFeatureFlag({ ...flag, expiresAt: "2026-11-10T11:00:00.000Z" }, "tenant_a", "actor_1", now), /FEATURE_FLAG_EXPIRED/);
});

test("release rejects malformed metadata, duplicate migrations and tenantless flags", () => {
  assert.throws(() => createGovernedRelease({ ...manifest, commitSha: "bad" }, now), /RELEASE_MANIFEST_INVALID/);
  assert.throws(() => createGovernedRelease({ ...manifest, migrations: [migrations[0]!, migrations[0]!] }, now), /RELEASE_MIGRATION_DUPLICATE/);
  assert.throws(() => evaluateGovernedFeatureFlag({
    tenantId: "tenant_a", key: "x", enabled: true, percentage: 50, allowlist: [], denylist: [],
    salt: "s", updatedBy: "op", updatedAt: "invalid",
  }, "tenant_a", "actor", now), /FEATURE_FLAG_INVALID/);
});
