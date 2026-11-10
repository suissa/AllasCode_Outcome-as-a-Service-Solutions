# Organization/workspace membership and invitations

- Behavior: issue workspace invitations, accept them into role-bounded memberships, revoke invitations and revoke memberships without removing the last active owner.
- Issue: [#11](https://github.com/suissa/OaaS.Quest/issues/11)
- Version: 1.0.0
- Invitation identity: tenant, workspace, inviter, recipient hash, token hash, role, permission snapshot, expiry, status, revision and idempotency key.
- Privacy: recipient email and invitation token are delivered to the mail adapter but never persisted; only SHA-256 hashes are stored.
- Roles: owner cannot be granted by invitation; admin/member/viewer receive a bounded permission set.
- Creation: requires workspace membership-management authorization, unique pending recipient and a bounded expiry window.
- Acceptance: token hash lookup, tenant/workspace match, unexpired pending state and host-verified recipient identity are required. Invitation acceptance and membership creation commit atomically.
- Revocation: pending invitations can be revoked by authorized managers; memberships can be revoked with reason/audit metadata. At least one active owner must remain.
- Idempotency: invitation creation is scoped by tenant and idempotency key; retries return the prior invitation without sending duplicate mail.
- Side effects: mail delivery and persistent membership/invitation transactions are explicit adapters. Delivery failure revokes the invitation.
