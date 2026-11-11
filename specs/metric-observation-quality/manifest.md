# Metric observation validation and data quality

- **Behavior:** validate observations against a registered metric's semantic unit, allowed source, freshness and confidence boundaries; aggregate source completeness and quality.
- **Owner:** measurement.
- **Version:** 1.0.0
- **Macro issue:** #3 — Diagnosis, baseline and outcome specification.
- **Atomic issues:** #26 (baseline observations and provenance) and #27 (data quality/freshness/confidence).
- **Maturity:** deterministic domain validation; connectors and persistence remain application integrations.
- **Risk:** high; stale, malformed or unauthorized-source observations must never silently enter a baseline.
- **Permissions:** the caller must authorize source access and tenant scope before invoking this primitive.
- **Invariants:** finite values/confidence in [0,1], valid non-future timestamp within metric freshness, matching metric/unit and declared source; all required sources are accounted for.
- **Side effects:** pure validation and aggregation.
- **Idempotency:** observations are identified by tenant, metric, source and upstream event identifier at the persistence boundary.
