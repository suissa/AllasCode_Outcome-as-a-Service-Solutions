# Explicit intent clarification

- **Behavior:** stop incomplete or ambiguous intents from entering discovery and return concrete questions tied to fields or ambiguity signals.
- **Owner:** discovery/intake.
- **Version:** 1.0.0
- **Macro issue:** #2 — Intent intake, qualification and discovery.
- **Atomic issue:** #20.
- **Maturity:** deterministic clarification planner; collecting answers and revising/persisting intent versions are application-layer workflows.
- **Risk:** medium/high; guessing unresolved requirements can create incorrect plans or commercial commitments.
- **Invariants:** missing outcome, scope or deadline yields a field-specific question; each non-empty ambiguity yields a clarification question; malformed ambiguity signals reject; any clarification blocks discovery dispatch.
- **Side effects:** pure planning; no intent mutation or external action.
- **Audit/idempotency:** callers persist clarification requests and answers against tenant-scoped intent/version IDs and append an audit event.
