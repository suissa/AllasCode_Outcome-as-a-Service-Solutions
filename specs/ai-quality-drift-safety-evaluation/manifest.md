# AI/model behavior, quality drift and safety regression evaluation

- Behavior: create tamper-evident model evaluation snapshots and compare model behavior against a tenant-scoped baseline to detect quality drift and safety regressions.
- Issue: [#94](https://github.com/suissa/OaaS.Quest/issues/94)
- Version: 1.0.0
- Snapshot identity: tenant, model, model version, prompt version, dataset version, evaluation timestamp and per-case result metadata.
- Evaluation categories: quality, safety, privacy, fairness, robustness, latency and cost.
- Result contract: case ID, normalized score, pass/fail, criticality and issue codes; raw prompts and generated outputs are not stored in snapshots.
- Comparability: same tenant, model and dataset; unique case IDs; minimum comparable sample count and coverage.
- Drift: overall score regression, category regression, newly failing cases and recovered cases are reported separately.
- Safety: critical safety regressions block release regardless of aggregate quality; minimum safety pass-rate policy is an independent release gate.
- Integrity: canonical SHA-256 snapshot hashes are verified before comparison.
- Side effects: model execution, dataset storage and release blocking are orchestrated by host adapters; comparison is deterministic and side-effect-free.
