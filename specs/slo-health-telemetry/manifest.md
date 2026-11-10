# SLO, health and telemetry

- Behavior: Evaluate tenant-scoped service-level objectives, aggregate dependency health and emit correlated privacy-safe telemetry.
- Issue: [#86](https://github.com/suissa/OaaS.Quest/issues/86)
- Version: 1.0.0
- Owner: Platform operations
- Dependencies: canonical tenant and actor context; host-provided probes and observations.
- Maturity: deterministic domain implementation; metrics exporter, durable storage, alert delivery and deployment probes remain host/runtime adapters.
- Invariants: SLO policy and every observation share a tenant; observation identifiers are unique; timestamps are valid and not in the future; health probes are tenant-isolated; trace identifiers follow W3C shape; telemetry attributes are bounded and sensitive-key values are redacted.
- Side effects: none in the domain evaluator. Exporters and alerting are adapters and must execute after policy evaluation.
- Idempotency: evaluation is pure for the same policy, observations and clock; telemetry event creation is deterministic for identical input.
- Errors: stable code and field path through ObservabilityError.
- Privacy: never include raw evidence, credentials, personal identifiers or unbounded payloads in telemetry attributes. Redaction is defense-in-depth, not a substitute for data minimization.
- Operations: insufficient samples are explicitly distinct from healthy; stale critical probes make aggregate health unhealthy; non-critical stale probes degrade health.
