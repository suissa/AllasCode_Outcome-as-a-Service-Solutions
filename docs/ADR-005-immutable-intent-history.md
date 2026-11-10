# ADR-005: Immutable tenant-scoped intent history

- **Status:** Accepted
- **Context:** Outcome decisions and later attribution must be traceable to the exact intent and provenance that initiated the work. Mutable rows would make historical decisions non-reproducible.
- **Decision:** Persist each intent version as an immutable JSON snapshot keyed by tenant, intent and contiguous version. Serialize appends with a transaction-scoped advisory lock, validate the complete snapshot and change metadata, and enforce append-only behavior in PostgreSQL with mutation-rejecting triggers.
- **Consequences:** History reads are tenant-filtered and return frozen snapshots. Duplicate/gapped versions fail. Corrections create a new version rather than rewriting history. A narrowly scoped transaction-local maintenance setting is reserved for controlled integration cleanup/retention operations.
- **Alternatives considered:** Mutable current-state row only (rejected: loses provenance); application-only immutability (rejected: bypassable by direct SQL); event broker as sole source (deferred: requires outbox and operational infrastructure).
