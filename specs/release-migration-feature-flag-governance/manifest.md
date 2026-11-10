# Release, migration, feature flag and rollback governance

- Behavior: validate release manifests, enforce independent approval and quality gates, sequence migrations, progressively roll out, and execute controlled rollback.
- Issue: [#92](https://github.com/suissa/OaaS.Quest/issues/92)
- Version: 1.0.0
- Release identity: tenant, semantic version, previous version, commit SHA, artifact SHA-256 and creator.
- Gates: CI, tests, security, migration verification, backup verification and SLO health must all pass before approval.
- Approval: approver must differ from release creator.
- Migrations: ordered IDs and SHA-256 checksums; destructive or irreversible migrations require explicit recovery strategy. Applied IDs/checksums must match the manifest exactly.
- Rollout: migrations complete before traffic rollout; percentages are monotonic, bounded and health-gated.
- Rollback: independent operator, immutable rollback plan and versioned state transition.
- Feature flags: tenant-scoped, deterministic hash bucket, percentage rollout, allowlist/denylist precedence, activation and expiry windows.
- Side effects: deployment, migration execution, flag persistence and artifact restoration are host adapters. This module provides policy and deterministic state transitions.
