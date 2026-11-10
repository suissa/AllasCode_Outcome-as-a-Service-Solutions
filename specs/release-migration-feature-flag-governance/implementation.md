# Implementation notes

Implemented by `src/operations/release-governance.ts`.

- Release candidates are immutable, tenant-scoped manifests with semantic versions, commit/artifact hashes and explicit rollback steps.
- Approval is independent and requires CI, tests, security, migration, backup and SLO gates.
- Migration manifests are ordered, unique and checksum-bound. Destructive migrations require a declared recovery strategy; execution records must match the manifest exactly.
- Rollout cannot begin before all migrations are recorded. Percentage advances are monotonic and each step requires a passing health gate.
- Rollback requires an operator different from both creator and approver and returns the explicit rollback action list.
- Feature flags use deterministic SHA-256 buckets scoped by tenant/key/salt/subject, with denylist before allowlist, and support activation/expiry timestamps.
- Deployment systems, migration runners, persistent feature flag stores and rollback executors remain external adapters.
