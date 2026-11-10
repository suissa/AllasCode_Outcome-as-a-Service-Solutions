# Implementation notes

normalizeIntentEnvelope trims text and list values without changing list order or silently removing blank entries. Unsupported channels and malformed lists fail with stable codes.

captureIntent validates required identity, statement, desired outcome, version and provenance. Source capture time must be parseable and cannot be later than ingestion/creation time. The returned intent, provenance and lists are frozen snapshots.

The primitive does not authenticate the actor, prove tenant membership, persist the intent, deduplicate requests or append audit events. The calling application must perform those steps using authenticated context and tenant-scoped idempotency.
