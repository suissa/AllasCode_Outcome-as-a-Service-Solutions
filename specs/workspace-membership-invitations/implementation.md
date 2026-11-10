# Implementation notes

Implemented by `src/domain/workspace-membership.ts`.

- Invitation creation normalizes recipient email, stores SHA-256 recipient/token hashes, snapshots role permissions and uses an idempotency key.
- The raw email and token are passed only to the delivery adapter and are not part of the stored invitation or returned metadata.
- Duplicate pending invitations are rejected. Delivery failure commits a revocation rather than leaving an unusable pending invitation.
- Acceptance verifies the invitation token, tenant/workspace, expiry, pending state and recipient identity before atomically creating an active membership and accepting the invitation.
- Owner role cannot be assigned by invitation. Membership revocation records actor, time and reason and preserves at least one active owner.
- Persistence transactions, mail delivery and recipient identity verification remain explicit host adapters.
