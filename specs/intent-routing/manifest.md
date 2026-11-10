# Intent routing and rejection explanations

- **Behavior:** route a request to discovery, clarification or rejection and explain every decision with stable codes and user-readable messages.
- **Owner:** discovery/intake.
- **Version:** 1.0.0
- **Macro issue:** #2 — Intent intake, qualification and discovery.
- **Atomic issue:** #23.
- **Maturity:** deterministic domain routing; transport response formatting and persisted decision/audit events are application-layer responsibilities.
- **Risk:** high; incorrect routing can start work for an unqualified or invalid request.
- **Invariants:** only structurally valid, complete, unambiguous and rule-qualified intents route to discovery; incomplete intents request clarification; invalid structure or disallowed rules reject; each reason has a stable code and explanation.
- **Side effects:** pure decision only; discovery task creation is separate and blocked unless route=discovery.
- **Idempotency:** deterministic for the same intent, ambiguity list, rule and evaluation time.
