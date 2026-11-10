# Implementation notes

Implemented by `src/domain/privacy-governance.ts`.

- `classifyData` applies conservative precedence and defaults ambiguous data to internal.
- `recordPrivacyConsent` stores a versioned consent decision with tenant, subject, purpose, categories, source and evidence hash. Idempotency prevents duplicate consent records.
- `withdrawPrivacyConsent` requires authorization and expected revision, and records who withdrew consent, when and why.
- `validateDataProcessingBasis` enforces legal basis and matches consent tenant, subject, purpose, category, status, expiry and grant time.
- `assessRetention` derives due dates from policy or explicit metadata and marks legal-hold records as on_hold.
- Consent evidence storage, legal-basis verification, retention deletion and legal-hold source checks remain host adapters.
