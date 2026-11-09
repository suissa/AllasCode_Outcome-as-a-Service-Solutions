# ADR-003: Immutable calculation snapshots

## Status
Accepted

## Context
Outcome settlement must be reproducible after source observations, evidence, calculation methodology or target specification change. A mutable report or in-memory calculation is insufficient for dispute resolution and audit.

## Decision
Persist each calculation snapshot under the composite tenant/snapshot identity. The snapshot records the outcome ID, specification version, calculation-method version, source evidence hashes, complete result and calculation timestamp. A canonical SHA-256 fingerprint covers the tenant, snapshot identity, methodology, evidence hashes and result. The timestamp remains provenance metadata and is deliberately excluded from the fingerprint so identical calculations remain comparable.

Snapshot rows are append-only at the database level. Snapshot insertion and its calculation.snapshot.persisted audit event are written in the same PostgreSQL transaction and share the tenant audit-ledger advisory lock. Repeated identical writes are idempotent; reusing a snapshot ID with different content is rejected. Reads are tenant-scoped and recompute the fingerprint before returning data.

## Consequences
- A snapshot can be reproduced and checked against its exact evidence and methodology versions.
- Audit history records who persisted the snapshot and correlates it with the request.
- The immutable table requires retention/export policies to operate through controlled archival workflows rather than row mutation.
- Hash chains provide tamper evidence, not cryptographic proof against a database superuser who can rewrite both data and chain; periodic external anchoring and independent backups remain operational requirements.