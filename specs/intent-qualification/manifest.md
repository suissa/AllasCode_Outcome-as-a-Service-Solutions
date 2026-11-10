# Intent completeness and qualification

- **Behavior:** validate a normalized intent against a versioned qualification rule before discovery or proposal work.
- **Owner:** discovery/intake.
- **Version:** 1.0.0
- **Macro issue:** #2 — Intent intake, qualification and discovery.
- **Atomic issue:** #21.
- **Maturity:** deterministic rule evaluator; rule authoring, version approval and persistence are application-layer responsibilities.
- **Risk:** medium/high; invalid qualification can dispatch work outside agreed scope or time constraints.
- **Invariants:** rules have valid IDs, required-field declarations, scope bounds and domain allowlists; malformed values fail closed; diagnostics use stable codes.
- **Side effects:** pure evaluation only; no discovery task is created by this behavior.
- **Idempotency:** deterministic for the same input, rule and evaluation clock; callers persist rule version with the decision.
