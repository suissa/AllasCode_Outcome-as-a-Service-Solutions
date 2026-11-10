# Outcome telemetry correlation

- Behavior: correlate trace spans, structured logs and numeric metrics for a single outcome execution.
- Issue: [#87](https://github.com/suissa/OaaS.Quest/issues/87)
- Version: 1.0.0
- Owner: Platform operations
- Dependencies: canonical tenant, outcome, execution, actor and request identifiers; W3C trace context.
- Invariants: every signal belongs to the requested tenant, outcome and execution; every signal shares one trace ID; signal IDs and trace-span definitions are unique; timestamps are strict UTC and not in the future.
- Side effects: none. Correlation is a pure in-memory projection; exporters and persistence are host adapters.
- Idempotency: identical input and clock produce identical ordering and counts.
- Errors: CorrelationError exposes a stable code and path; invalid input is rejected before a result is returned.
- Privacy: attributes are scalar-only, bounded and redacted by sensitive key; logs use event codes rather than arbitrary message bodies.
- Ordering: occurredAt ascending, then kind, then signal ID. The output window is derived from the first and last normalized signal.
- Limitations: this module correlates supplied signals; it does not ingest telemetry, infer causal relationships, or guarantee trace completeness.
