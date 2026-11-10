# Implementation notes

Implemented by `src/operations/anomaly-detection.ts`.

- Metric outliers use a historical per-metric median and median absolute deviation (MAD), with a configurable multiplier and minimum absolute deviation.
- Current observations are evaluated only inside the current window; baseline observations are drawn from the preceding baseline window and exclude the current window.
- Execution failure rates are evaluated only after a minimum sample count; findings include sorted failure codes without copying arbitrary log content.
- Each breached SLO dimension is emitted as a critical finding, scoped to its tenant and policy.
- Input identifiers, tenant scope, timestamp validity, metric values, execution states and SLO dimensions are validated with stable error codes and paths.
- Finding IDs are deterministic; results are deduplicated, sorted and immutable.
- Insufficient baseline or execution data is surfaced explicitly and never classified as healthy.
- Detection is a pure domain operation. Alert delivery, incident persistence, dashboards, paging and automated remediation are intentionally external adapters.
