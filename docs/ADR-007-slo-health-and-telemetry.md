# ADR-007: Tenant-scoped SLO, health and telemetry

## Status

Accepted

## Context

Operational signals must be useful for reliability decisions without crossing tenant boundaries or leaking credentials and personal data. A bare collection of counters does not distinguish missing samples from a healthy service, and a dependency that has stopped reporting can otherwise appear healthy.

## Decision

Implement deterministic, vendor-neutral domain functions. SLO policies define availability, error-rate and p95 latency targets, a bounded rolling window and a minimum sample floor. Every observation is validated and tenant-scoped before evaluation. Insufficient samples return an explicit `insufficient_data` state rather than being treated as success.

Health aggregation validates tenant scope and freshness. A stale critical probe is unhealthy; a stale non-critical probe is degraded; an empty probe set is unhealthy. Trace context requires non-zero W3C trace and span identifiers plus tenant, actor and request identifiers. Telemetry attributes are scalar-only, bounded, and sensitive-key values are redacted.

## Consequences

- Evaluation is deterministic for the same policy, observations and clock.
- Cross-tenant observations and probes fail closed with stable error codes and paths.
- The domain layer performs no network, storage, alerting or exporter side effects.
- Exporters, durable retention, dashboards and paging remain host/runtime responsibilities.
- Key-based redaction is defense-in-depth; producers must still minimize data before emitting telemetry.
