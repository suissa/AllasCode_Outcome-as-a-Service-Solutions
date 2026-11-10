# Durable Contract Workflow

## Scope

This workflow connects a review-ready outcome proposal to a tenant-scoped contract draft, persists the draft, records review and approval decisions, verifies signatures through an injected provider adapter, and activates the agreement only after every required signer has a verified signature.

It is an API/domain integration. The repository does not include a production electronic-signature provider, legal validation service, PDF renderer, or tax engine.

## Lifecycle

`draft -> in_review -> approved -> active`

- **draft**: immutable contract document generated from the proposal, approved scope and pricing inputs; no execution authorization.
- **in_review**: submitted for internal/customer review.
- **approved**: approved for signature. Agreement state becomes `pending_approval`.
- **active**: every required signer has a verified signature and the agreement activation invariant passes.

A signature cannot be recorded before approval. A signer not listed in `requiredSigners` is rejected. Activation fails closed until all required signers are present. A signature verifier must be configured; without it the HTTP endpoint returns `SIGNATURE_VERIFIER_NOT_CONFIGURED`.

## HTTP API

All endpoints require authentication, tenant scope and action-level authorization. Mutating requests require an `Idempotency-Key` header.

| Method | Path | Action |
|---|---|---|
| POST | `/v1/contracts/drafts` | Compose and persist a draft from a ready proposal and agreement |
| GET | `/v1/contracts/:contractId` | Read a tenant-scoped contract |
| GET | `/v1/contracts/:contractId/events` | Read append-only lifecycle events |
| POST | `/v1/contracts/:contractId/submit-review` | Submit draft for review |
| POST | `/v1/contracts/:contractId/approve` | Approve the draft for signature |
| POST | `/v1/contracts/:contractId/signatures` | Verify and record a required signer's signature |
| POST | `/v1/contracts/:contractId/activate` | Activate only after all required signatures verify |

### Draft request

The body contains the structured proposal, agreement, parties, effective date, jurisdiction, required signer actor IDs and optional operational/security annex data. The server overwrites the approval actor with the authenticated actor and enforces tenant equality between the proposal, agreement and authenticated principal.

### Signature verifier

The server option `verifyContractSignature` is an injected `SignatureVerifier`. It must validate the signature with the configured provider, including provider response integrity, signer identity, document fingerprint, timestamp and verification reference. A boolean stub is appropriate only in tests. Do not accept a client-supplied `signatureHash` as proof without independently verifying it.

## Persistence and consistency

Migration `0014_durable_contract_registry.sql` creates:
- `contract_records`: current versioned state and full immutable document snapshot;
- `contract_events`: append-only lifecycle events with revision, actor and correlation ID;
- `contract_idempotency`: tenant-scoped command replay protection.

The Postgres store uses transactions, advisory locks, optimistic revision checks and a unique idempotency key per tenant. Event rows reject update, delete and truncate. A retry with the same key and payload returns the prior result; reusing a key with a different fingerprint fails.

## Operational rules

- Proposal readiness, evidence, metric baseline, target, attribution, scope and pricing are validated before draft creation.
- Contract draft generation does not imply acceptance or permit execution.
- Review and approval are separate commands and are audit-visible.
- Signature verification is an integration boundary; never replace it with a truthy client flag.
- Activation is the only transition that changes the agreement to `active`.
- A project/execution workflow must separately consume an active agreement and its frozen scope, version and fingerprint.
- Corrections require a new agreement version or an explicit lifecycle event; never rewrite a signed document snapshot.

## Tests

`test/http/contracts.test.ts` exercises draft creation, review, approval, multi-signer verification, activation, event history and tenant mismatch rejection. The CI typecheck and complete test suite remain the acceptance gate.
