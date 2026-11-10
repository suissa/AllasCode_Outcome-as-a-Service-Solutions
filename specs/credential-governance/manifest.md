# Credential governance, secret rotation and access reviews

- Behavior: rotate tenant-owned secret references through a vault adapter and independently review credential access grants.
- Issue: [#89](https://github.com/suissa/OaaS.Quest/issues/89)
- Version: 1.0.0
- Secret handling: the platform stores provider/key/version references only; raw secret bytes remain inside the vault provider and are never returned by domain APIs.
- Rotation: authorization, tenant scope, expected revision, due-time policy, provider/key continuity and version advancement are required. The vault adapter must be idempotent by command key.
- Commit: the store performs compare-and-swap and records the rotation idempotency key atomically with the new reference.
- Access review: reviewer must be authorized and independent from both the grant subject and grantor; retain/revoke requires a reason code and rationale.
- Revocation: explicit revoke empties the grant permissions and advances its revision; store commit includes the immutable review record for audit.
- Invariants: tenant isolation, no secret material in results, stable errors, revision monotonicity, idempotent rotation and least-privilege scope validation.
- Side effects: vault rotation and atomic governance-store commits are explicit adapters. No implicit network calls or secret reads occur in the domain module.
- Recovery: vault rotation commands must replay safely with the same idempotency key if a database CAS conflict or transient failure occurs.
