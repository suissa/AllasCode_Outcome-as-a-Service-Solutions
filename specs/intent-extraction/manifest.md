# Structured intent extraction

- **Behavior:** convert a free-text request into candidate outcome, scope, deadline, constraints and ambiguity signals.
- **Owner:** discovery/intake.
- **Version:** 1.0.0
- **Macro issue:** #2 — Intent intake, qualification and discovery.
- **Atomic issue:** #19.
- **Maturity:** provider-neutral extraction port; model/provider selection and prompt versioning are adapter concerns.
- **Risk:** high when an inferred field is treated as fact. Confidence below threshold or any ambiguity must stop capture and request clarification.
- **Permissions:** extractor receives only the minimum request text authorized for the caller; provider-side privacy controls are external.
- **Invariants:** confidence is within [0,1]; structured fields have the expected type; timestamps parse; list entries are non-empty; no inferred output is silently coerced.
- **Side effects:** extractor may call an external provider; this domain function does not persist or execute business actions.
- **Idempotency:** provider calls are not assumed idempotent; caller supplies request-level deduplication and records model/provider evidence.
