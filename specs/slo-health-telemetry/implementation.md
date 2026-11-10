# Implementation notes

The domain layer is implemented in `src/operations/observability.ts`.

- `evaluateTenantSlo` validates policy and observations, enforces tenant equality and unique IDs, rejects malformed/future timestamps, applies a bounded rolling window and minimum sample floor, then computes availability, error rate and nearest-rank p95 deterministically.
- `aggregateTenantHealth` isolates probes by tenant, detects duplicate IDs and stale timestamps, and treats stale critical dependencies as unhealthy and stale non-critical dependencies as degraded.
- `validateTraceContext` validates non-zero W3C trace/span identifiers and requires tenant, actor and request correlation.
- `createTelemetryEvent` bounds attribute count and string size, accepts scalar values only, redacts sensitive-key values and returns frozen event data.
- All validation failures use `ObservabilityError(code, path)`.

The module is deliberately transport- and vendor-neutral. A production host still needs to connect probes, metrics exporters, durable event storage, alert routing, dashboards, retention policies and on-call escalation. SLO evaluation alone does not constitute an uptime guarantee.
