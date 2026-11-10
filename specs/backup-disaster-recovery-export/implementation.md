# Implementation notes

Implemented by `src/operations/backup-governance.ts`.

- `validateBackupManifest` checks tenant metadata, scope, timestamps, consistency point, digest, size, encryption metadata and retention.
- `assessDisasterRecovery` computes backup age against RPO and checks required replica regions, latest restore-drill status/freshness and measured duration against RTO.
- `planBackupRestore` authorizes a tenant-scoped restore and requires independent approval for production targets.
- `executeBackupRestore` stages first, verifies hash and exact tenant/scope, validates staged data, promotes only after validation and attempts rollback on failure.
- `authorizeDataExport` requires a purpose and authorization; personal/sensitive exports require independent approval.
- `verifyExportArtifact` checks tenant, classification, content hash, size, authorization time and expiry.
- Storage, encryption, restore engine, backup scheduler, export generation and durable idempotency remain explicit infrastructure adapters. This module does not claim a live storage backend.
