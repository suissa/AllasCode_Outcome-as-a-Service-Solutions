# Implementation notes

Implemented by `src/security/compliance-controls.ts`.

- `runSecurityPrivacyControls` validates runner authorization, tenant boundaries, control definitions, evidence provenance, SHA-256 hashes, capture timestamps, period membership, freshness, classification and privacy basis.
- Each enabled control reports passed, failed or not_evidenced; disabled controls report not_applicable.
- Missing evidence and stale evidence are explicit; failed checks and expired evidence fail the control.
- Personal/sensitive evidence requires consent or legal basis plus an independent verifier.
- `buildComplianceEvidenceBundle` compiles only control results and evidence IDs, then hashes the canonical snapshot.
- `reviewComplianceEvidenceBundle` recomputes the snapshot hash and requires an independent reviewer.
- The module does not execute cloud infrastructure probes or persist evidence. Those operations are delegated to deployment adapters that produce the typed observations consumed by this evaluator.
