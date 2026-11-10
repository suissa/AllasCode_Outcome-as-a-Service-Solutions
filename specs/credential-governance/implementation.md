# Implementation notes

Implemented by `src/security/credential-governance.ts`.

- `rotateCredential` requires explicit authorization, tenant-scoped lookup, optimistic revision, due-time policy and a stable idempotency key.
- The vault adapter receives only the existing secret reference and idempotency key. It returns metadata; secret bytes are never part of the platform API.
- The vault adapter must replay the same rotation for the same key. The governance store must atomically compare-and-swap the credential revision and persist the idempotency record.
- `reviewCredentialAccess` requires an authorized reviewer independent from both the grant subject and grantor. It validates least-privilege permission syntax, requires a reason and rationale, and advances the grant revision.
- Revocation clears all permissions and sets a revocation timestamp. The store's commit operation must persist the updated grant and review/audit record atomically.
- Both workflows use stable error codes and explicit adapter boundaries. Database, vault, alerting and audit transport implementations remain deployment adapters.
