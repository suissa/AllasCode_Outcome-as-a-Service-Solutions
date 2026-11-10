# Privacy classification, consent and retention

- **Behavior:** classify stored data and validate purpose, lawful basis and retention metadata.
- **Owner:** platform governance/security.
- **Version:** 1.0.0
- **Macro issue:** #1 — Outcome domain, workspace and governance foundation.
- **Atomic issue:** #16.
- **Maturity:** reference implementation; deployment-specific retention schedules and lawful-basis policy remain tenant/legal configuration.
- **Risk:** high; invalid metadata can cause unlawful processing or premature retention.
- **Permissions:** callers must already be authorized to create or change the associated record; consent is tenant- and subject-scoped.
- **Invariants:** purpose is non-empty; classification is from the declared enum; personal/sensitive data requires a non-empty consent reference or legal basis; retention timestamps must parse and be in the future at validation time; consent must be granted for the exact purpose, unexpired and not withdrawn.
- **Observability:** emit stable validation codes; never log consent content or secret values.
- **Side effects:** validators are pure. Consent withdrawal returns a new immutable record; persistence and audit are the caller's responsibility.
- **Idempotency:** validation is deterministic for the same input and clock; repeated withdrawal is rejected rather than silently replayed.
