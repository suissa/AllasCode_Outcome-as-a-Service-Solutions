# Anomaly, failure and SLO breach detection

- Behavior: detect metric outliers, execution failure-rate spikes and breached tenant SLO dimensions.
- Issue: [#88](https://github.com/suissa/OaaS.Quest/issues/88)
- Version: 1.0.0
- Dependencies: tenant-scoped operational samples and SLO evaluation results.
- Inputs: historical baseline samples, current metric samples, execution outcomes, evaluated SLO results and an explicit evaluation clock.
- Invariants: tenant isolation; strict UTC timestamps; no future samples; unique sample identities; deterministic output; no external side effects.
- Detection: per-metric median/MAD robust baseline; configurable failure-rate floor and sample minimum; every reported SLO breach becomes a critical finding.
- Insufficient data: explicitly reported; never interpreted as healthy.
- Idempotency: stable finding identifiers derived from tenant, metric/sample or SLO policy/dimension and evaluation window.
- Privacy: finding payloads contain operational identifiers and codes only; no raw log bodies or customer attributes.
- Side effects: none. Alert routing, persistence, ticket creation and remediation remain host/runtime adapters.
- Errors: AnomalyDetectionError exposes stable code and path.
