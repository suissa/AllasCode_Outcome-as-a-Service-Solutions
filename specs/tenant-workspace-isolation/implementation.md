# Implementation notes

Implemented by `src/domain/workspace-isolation.ts`.

- `requireWorkspaceScope` validates canonical tenant/workspace IDs and bounded actor/correlation metadata.
- `buildWorkspaceQueryFilter` returns an immutable tenant+workspace filter for storage adapters.
- `assertWorkspaceRecordScope` validates both ownership dimensions before record access.
- `assertWorkspaceRecordsScope` rejects an entire mixed-scope collection rather than partially processing it.
- `authorizeWorkspaceAction` checks membership identity, scope, status, expiry and role-bounded permissions.
- Errors contain stable codes and paths but intentionally omit tenant/workspace IDs.
- Persistence adapters must apply both query-filter dimensions and use transactional writes; the domain layer does not issue storage queries.
