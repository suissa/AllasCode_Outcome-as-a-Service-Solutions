# Metric definitions and semantic units

- **Behavior:** register immutable, versioned metric definitions with explicit unit, aggregation, direction, freshness and permitted sources.
- **Owner:** measurement.
- **Version:** 1.0.0
- **Macro issue:** #3 — Diagnosis, baseline and outcome specification.
- **Atomic issue:** #25.
- **Maturity:** deterministic in-memory registry; durable persistence is an application-layer integration.
- **Risk:** high; ambiguous units or aggregation can invalidate financial and operational outcome calculations.
- **Permissions:** registration and revision require an authorized application actor; this library validates the definition, not the actor.
- **Invariants:** non-empty identity/unit, positive freshness, supported aggregation/direction, unique non-empty source identifiers and monotonically increasing versions.
- **Side effects:** registry mutation only; no external calls.
- **Idempotency:** duplicate initial registration is rejected; revisions append a new version.
