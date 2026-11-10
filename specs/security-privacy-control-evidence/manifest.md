# Security and privacy control execution with evidence collection

- Behavior: execute a tenant-scoped control evaluation over independently produced, provenance-bearing evidence and compile a tamper-evident compliance bundle.
- Issue: [#90](https://github.com/suissa/OaaS.Quest/issues/90)
- Version: 1.0.0
- Categories: access, privacy, retention, secrets, encryption, audit and governance.
- Evidence: source, capture time, SHA-256 content digest, classification, check outcome and optional expiry; personal/sensitive evidence also requires legal basis or consent and independent verification.
- Evaluation: every enabled control declares required evidence kinds, minimum counts, freshness window and severity.
- Outcomes: passed, failed, not_evidenced or not_applicable. Missing/stale evidence is never silently treated as pass.
- Isolation: controls and evidence must match the requested tenant; evidence must map to a declared control and required kind.
- Bundle: deterministic control runs and evidence references are serialized into a SHA-256 snapshot; review verifies integrity and requires a reviewer independent from the preparer.
- Side effects: control probes, evidence storage and durable audit transport are explicit host adapters; the domain evaluator is deterministic and side-effect-free.
- Privacy: no evidence payloads or secrets are copied into the compliance bundle, only evidence IDs and hashes.
