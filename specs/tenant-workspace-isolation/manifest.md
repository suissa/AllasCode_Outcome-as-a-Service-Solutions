# Tenant/workspace boundaries and isolation rules

- Behavior: validate execution scope, enforce tenant and workspace ownership on records and collections, and authorize actions against active workspace membership.
- Issue: [#10](https://github.com/suissa/OaaS.Quest/issues/10)
- Version: 1.0.0
- Scope: canonical tenant ID, canonical workspace ID, actor ID and correlation ID are mandatory.
- Query boundary: query filters always include both tenant and workspace IDs; callers must not fall back to tenant-global or unscoped queries.
- Record boundary: each record is validated against both scope dimensions before access or mutation.
- Collection boundary: mixed-scope collections are rejected atomically; no partial processing is allowed.
- Membership: tenant, workspace and actor must match; membership must be active and unexpired.
- Authorization: role capabilities bound explicit permissions; a membership cannot grant permissions outside its role.
- Privacy: isolation errors disclose neither expected nor actual tenant/workspace identifiers.
- Side effects: none. Scope validation and authorization decisions are deterministic; storage adapters must apply the returned query filter.
