# ADR-001: Durable storage and HTTP boundary

- Status: Accepted.
- Context: The in-memory reference runtime loses cases, audit events and idempotency records on restart.
- Decision: Keep domain contracts driver-neutral; define a transactional SQL port and PostgreSQL adapter. Persist case snapshots, append-only audit events and idempotency results in one transaction. Tenant ID is part of every key and query predicate. Expose an HTTP adapter with injected authentication and authorization; never trust tenant IDs supplied by request bodies.
- Alternatives: A document database simplifies snapshots but makes transactional audit/idempotency constraints less direct. A hosted BaaS couples the core to a vendor. A local file store is unsuitable for concurrent multi-tenant production traffic.
- Consequences: Deployment must supply a PostgreSQL-compatible SqlDatabase, migration runner, TLS, backups, connection limits and real identity/policy adapters. This adapter is not a complete identity provider. Production readiness still requires integration tests against a real database, threat modeling and deployment configuration.
