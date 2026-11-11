# Diagnosis findings, bottlenecks, risks and constraints

- **Behavior:** record evidence-grounded diagnosis findings and a tenant-scoped root-cause analysis with alternatives for review.
- **Owner:** diagnosis.
- **Version:** 1.0.0
- **Macro issue:** #3 — Diagnosis, baseline and outcome specification.
- **Atomic issue:** #28.
- **Maturity:** deterministic domain validation; evidence authorization and persistence are application-layer responsibilities.
- **Risk:** high; unsupported claims or cross-tenant evidence can drive unsafe investment and execution decisions.
- **Permissions:** caller must authorize tenant and evidence access before this primitive; approval must be performed by an independent actor.
- **Invariants:** finding identity, category, impact, non-empty evidence references, finite confidence [0,1], valid constraints, same-tenant findings, unique finding IDs and explicit alternatives.
- **Side effects:** pure validation and immutable approval result; no external action.
- **Idempotency:** caller should use tenant + diagnosis version as idempotency scope; this primitive performs no persistence.
