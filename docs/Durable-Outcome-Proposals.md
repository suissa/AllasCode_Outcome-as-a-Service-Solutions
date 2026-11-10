# Durable Outcome Proposals

Discovery submission is an explicit, authenticated operation. Browser-local answers are not transmitted on page load. A submission must include an idempotency key and is accepted only when the composed proposal passes readiness validation; incomplete previews remain non-persistent.

## API

- `POST /v1/proposals/preview`: authenticated, non-persistent preview (`proposal.preview`).
- `POST /v1/proposals`: persist a proposal ready for human review (`proposal.create`). Tenant identity is always taken from the authenticated actor. The request's tenant, proposal ID and version are ignored.
- `GET /v1/proposals/:id`: tenant-scoped read (`proposal.read`).
- `GET /v1/proposals`: tenant-scoped list (`proposal.list`).
- `GET /v1/proposals/:id/events`: tenant-scoped audit history (`proposal.audit.read`).
- `POST /v1/proposals/:id/review`: explicit approve/reject decision (`proposal.approve` or `proposal.reject`), protected by optimistic version checks. Approval does not create a contract or start execution.

Submission requires `Idempotency-Key`. Replays with the same payload return the original record; key reuse with a different payload returns conflict. Rejected proposals require a reason. Every persisted status change appends an event in the same database transaction.

## Storage

Migration `0014_durable_outcome_proposals.sql` adds tenant-scoped proposal records, append-only proposal events, and an idempotency ledger. The store uses the existing SQL port and PostgreSQL driver; no new database or ORM is introduced.

## Review boundary

Persisted records begin in `ready_for_review` only after `assessProposalReadiness` reports no blockers. A proposal can be approved or rejected by a separately authorized actor. Contract composition remains a distinct operation and continues to require explicit approval and matching scope.
