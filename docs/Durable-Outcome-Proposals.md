# Durable Outcome Proposals

Discovery submission is an explicit, authenticated operation. Browser-local answers are not transmitted on page load. A submission must include an idempotency key and is accepted only when the composed proposal passes readiness validation; incomplete previews remain non-persistent.

## API

- `POST /v1/proposals/preview`: authenticated, non-persistent preview (`proposal.preview`).
- `POST /v1/proposals`: persist a submitted Discovery as a tenant-scoped draft, or as `ready_for_review` only if all readiness gates are already satisfied (`proposal.create`). Tenant identity is always taken from the authenticated actor. The request's tenant, proposal ID and version are ignored.
- `GET /v1/proposals/:id`: tenant-scoped read (`proposal.read`).
- `GET /v1/proposals`: tenant-scoped list (`proposal.list`).
- `GET /v1/proposals/:id/events`: tenant-scoped audit history (`proposal.audit.read`).
- `POST /v1/proposals/:id/review`: explicit approve/reject decision (`proposal.approve` or `proposal.reject`), protected by optimistic version checks. Approval does not create a contract or start execution.

Submission requires `Idempotency-Key`. Replays with the same payload return the original record; key reuse with a different payload returns conflict. A draft is not reviewable/approvable until a separately authorized enrichment workflow makes it ready. Rejected proposals require a reason. Every persisted status change appends an event in the same database transaction.

## Storage

Migration `0014_durable_outcome_proposals.sql` adds tenant-scoped proposal records, append-only proposal events, and an idempotency ledger. The store uses the existing SQL port and PostgreSQL driver; no new database or ORM is introduced.

## Review boundary

Persisted records begin in `ready_for_review` only after `assessProposalReadiness` reports no blockers. A proposal can be approved or rejected by a separately authorized actor distinct from the submitter (maker-checker separation). Contract composition remains a distinct operation and continues to require explicit approval and matching scope.

## Browser integration boundary

The current chat and site interface are intentionally unchanged. Discovery answers remain browser-local; this rebuild does not wire automatic submission or add a new consent panel to the existing page. The authenticated API is ready for a future explicit-consent host integration, but no browser data is transmitted by this release.

When that UI integration is approved, the authenticated host may expose this bridge before the Discovery page loads:

```js
window.OaaSProposalConfig = {
  baseUrl: "/api", // same-origin reverse proxy to the Outcome API
  getAccessToken: async () => authSession.getAccessToken()
};
```

The bridge must return a short-lived access token from the host's existing auth session; do not put secrets or long-lived tokens in page config/localStorage. Requests use Bearer authentication, `credentials: omit`, and `cache: no-store`. The recommended deployment is a same-origin reverse proxy. The API's authenticate/authorize functions remain responsible for validating the token and tenant permissions.

When connected through an explicit-consent host flow, the visitor can preview readiness first, then submit the Discovery. Incomplete answers are stored as `draft` for commercial enrichment—not mislabeled as an approved or ready proposal. The response returns its server-generated proposal ID and persisted status. No contract or execution is triggered. Proposal IDs are server-generated and should be used for support and audit references.
