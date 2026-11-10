# Incident, feedback and lessons-learned governance

- Behavior: collect tenant feedback, manage incident lifecycle transitions, and produce evidence-backed postmortems with owned corrective actions.
- Issue: [#93](https://github.com/suissa/OaaS.Quest/issues/93)
- Version: 1.0.0
- Feedback: tenant/subject/actor scoped, rating 1–5, category, strict timestamp and idempotency key. Free-text comments are bounded and sensitive contact/token patterns are redacted before persistence.
- Feedback analytics: deterministic tenant-only aggregation over an explicit time window; duplicate IDs, cross-tenant data and future timestamps are rejected.
- Incidents: severity, lifecycle state, revision, actor, reason and idempotency key are validated for every transition.
- Lifecycle: open → acknowledged → investigating/mitigated → resolved → closed. Resolution requires summary and evidence references.
- Lessons: postmortems require a resolved incident, independent preparer/reviewer, verified evidence, root cause, impact summary and owned action items with future due dates.
- Audit: transition events carry previous/next state, actor, reason, time, revision and idempotency key; store commit is compare-and-swap.
- Privacy: feedback comments are scrubbed for common contact details and bearer tokens; incident/postmortem artifacts contain evidence references, not raw evidence payloads.
- Side effects: persistence, evidence verification and notifications are explicit adapters.
