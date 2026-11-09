# ADR-004: Durable settlement action workflow

## Status
Accepted

## Context
Outcome acceptance can trigger invoice issuance, bonus credit, refund or dispute actions. Provider calls are external side effects and cannot safely be executed as an untracked in-memory sequence: a process can crash after the provider commits but before the application records completion.

## Decision
Persist each planned settlement action in PostgreSQL with a tenant-scoped idempotency key and canonical SHA-256 fingerprint. Workers claim actions using a lease and compare-and-set state transition. Provider adapters receive the original idempotency key. Success records the provider reference; retryable failures return to pending until the attempt limit; terminal failures remain visible. Each queue transition is written to an append-only event table in the same database transaction.

Refund planning requires an explicit `paymentCaptured=true` signal. A requested refund without confirmed capture produces a hold action instead of issuing a refund.

## Consequences
- Actions survive process restarts and can be safely reclaimed after expired leases.
- Provider execution is at-least-once; exactly-once external effects require each provider adapter to honor the supplied idempotency key or support reconciliation.
- Settlement event history is immutable; action state is mutable only through guarded transitions.
- Payment provider reconciliation, refund approvals and dispute adjudication remain adapter/business-policy responsibilities.
