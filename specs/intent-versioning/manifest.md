# Persist intent versions and provenance

- **Behavior:** persist immutable, tenant-scoped intent snapshots with actor, time and change reason.
- **Owner:** discovery/intake persistence.
- **Version:** 1.0.0
- **Macro issue:** #2 — Intent intake, qualification and discovery.
- **Atomic issue:** #22.
- **Maturity:** PostgreSQL adapter and append-only history; identity provider and retention schedule remain deployment concerns.
- **Risk:** high; history supports accountability, replay and downstream outcome provenance.
- **Permissions:** caller must authenticate and authorize the actor before append; the store enforces tenant ownership in its query and payload checks.
- **Invariants:** intent/version IDs agree; version sequence is contiguous; snapshot and provenance validate; change actor/reason/timestamp are required; change time cannot precede intent creation.
- **Side effects:** append-only insert under a tenant/intent advisory transaction lock.
- **Idempotency:** duplicate version append conflicts; caller uses tenant-scoped request idempotency to replay a prior operation.
- **Immutability:** database triggers reject update/delete/truncate; controlled maintenance purge requires an explicit transaction-local maintenance flag.
