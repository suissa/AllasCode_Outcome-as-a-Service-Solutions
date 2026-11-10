# Intent capture and normalization

- **Behavior:** capture a customer outcome request from web, API, conversation or import channels with source provenance.
- **Owner:** discovery/intake.
- **Version:** 1.0.0
- **Macro issue:** #2 — Intent intake, qualification and discovery.
- **Atomic issue:** #17 (normalization is shared with #18).
- **Maturity:** deterministic domain library; channel adapters and durable delivery are external integrations.
- **Risk:** medium/high; incorrect tenant or actor attribution can contaminate downstream discovery.
- **Permissions:** the transport adapter authenticates the actor and supplies the tenant context; this primitive validates presence, not authorization.
- **Invariants:** known channel, non-empty intent and identity fields, non-empty source identifier, valid capture/creation timestamps, capture not later than ingestion, and no silent dropping of malformed scope/constraint items.
- **Side effects:** pure normalization and in-memory object creation only; persistence and audit are application-layer responsibilities.
- **Idempotency:** callers must persist using a tenant-scoped request/idempotency key; this primitive does not deduplicate submissions.
