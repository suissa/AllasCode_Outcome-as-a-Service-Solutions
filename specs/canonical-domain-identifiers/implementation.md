# Implementation notes

Implemented by `src/domain/identifiers.ts` and `src/domain/tenant-scope.ts`.

- Entity kinds are checked at runtime, not only through TypeScript generics.
- Canonical IDs enforce namespace/kind match and suffix bounds.
- Long external keys use a deterministic SHA-256 suffix rather than silent prefix truncation.
- Runtime tenant scope validates tenant ID and requires bounded actor/correlation metadata.
- Tenant record IDs are parsed before comparison; cross-tenant errors do not disclose either tenant identifier.
- No persistence or external dependency is introduced beyond Node's standard crypto implementation.
