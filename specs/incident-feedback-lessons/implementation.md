# Implementation notes

Implemented by `src/operations/incident-feedback-governance.ts`.

- Feedback submission validates tenant, actor, category, rating, time and idempotency, then redacts email addresses, phone numbers and bearer tokens before the store adapter receives the comment.
- Feedback aggregation validates the requested window and all tenant boundaries, then returns deterministic rating/category summaries.
- Incident transitions are authorized, compare-and-swap revisioned and idempotent. Each event includes actor, reason, state transition, timestamp and revision.
- Resolution requires a summary and evidence references. Invalid transitions, stale revisions and unauthorized actors are rejected before persistence.
- Postmortems require a resolved incident, independent reviewer, verified evidence, root cause, impact summary and corrective actions with owners and future due dates. A SHA-256 snapshot hash is returned.
- Durable incident/feedback storage, evidence verification, notification routing and audit ledger integration remain deployment adapters.
