# Backup, restore, disaster recovery and data export

- Behavior: validate backup manifests and integrity, assess recovery objectives, restore through an isolated staging target, and authorize/verify data exports.
- Issue: [#91](https://github.com/suissa/OaaS.Quest/issues/91)
- Version: 1.0.0
- Backup invariants: tenant-bound scope, strict timestamps, SHA-256 content hash, non-empty size, consistency point not after snapshot time, encryption metadata and unexpired retention.
- Disaster recovery: evaluate RPO, RTO, required replica regions, backup freshness and independent restore-drill evidence.
- Restore: require tenant authorization; production promotion requires an independent approver. Restore to staging, verify content hash, tenant and exact scope, validate staged data, then promote. Any failure triggers rollback.
- Idempotency: restore provider must deduplicate by idempotency key and return the same staged operation on retry.
- Export: purpose-bound authorization, independent approval for personal/sensitive data, tenant-matched artifact, strict expiry and content-hash verification.
- Privacy: exports are classified; personal data is opt-in and independently approved. No export payload is returned by the authorization API.
- Side effects: backup storage, restore execution and export generation are explicit provider adapters; domain policy does not access infrastructure directly.
