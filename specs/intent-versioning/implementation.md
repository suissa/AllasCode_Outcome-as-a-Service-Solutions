# Implementation notes

PostgresIntentVersionStore serializes append operations for a tenant/intent pair with a transaction-scoped advisory lock, verifies the next contiguous version and inserts the full snapshot/provenance payload. The query always scopes history by both tenant and intent.

Every version is validated before write and again after decode. Returned history is deeply frozen at the snapshot, provenance and collection levels. Database triggers reject update/delete/truncate; integration cleanup uses an explicit transaction-local maintenance setting and is not part of normal application operations.

The caller remains responsible for authentication, authorization, request idempotency, audit event correlation, retention policy and consent/legal basis checks before persistence.
