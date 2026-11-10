# Implementation notes

The domain implementation is `src/operations/trace-correlation.ts`.

- `correlateOutcomeSignals` accepts trace, log and metric signals and requires tenant, outcome and execution scope.
- Every signal is validated against the requested scope and a shared W3C trace ID. Span IDs are validated; trace span definitions cannot be duplicated.
- Timestamps are strict UTC, bounded by the supplied clock, and malformed or future records are rejected.
- Log records use bounded event codes and levels instead of arbitrary log messages. Metrics require finite numeric values and explicit units.
- Structured attributes reuse the existing telemetry sanitizer for scalar validation, size bounds and sensitive-key redaction.
- Results are immutable and sorted deterministically by timestamp, kind and signal ID. Counts and observed time bounds are included.
- The function is pure and has no persistence, network, exporter or alerting side effects. Those integrations remain adapters at the host/runtime boundary.
