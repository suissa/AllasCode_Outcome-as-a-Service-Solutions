# Implementation

The reference implementation lives in `src/reporting/report.ts`.

1. Validate report metadata, metric, period, outcome result, attribution, limitations, guardrails and unique evidence IDs.
2. Verify tenant equality and resolve every requested evidence record.
3. Validate source provenance, capture timestamp and SHA-256 content hash.
4. Evaluate purpose- and classification-scoped access for every record. Confidential/personal evidence requires prior verification.
5. Only after all preflight checks pass, ask the host signer for 15-minute links.
6. Reject non-HTTPS URLs, embedded credentials and fragments.
7. Freeze report metadata and link collection; render customer-safe Markdown separately.

The renderer escapes untrusted text and includes metric, period, baseline, target, observed value, progress, declared confidence, methodology, attribution caveat, guardrails, limitations and expiring evidence references.

The library does not implement an identity provider, storage for reports, evidence source connectors, signer, link revocation, or legal/statistical certification. The host supplies authenticated access context and signer. Signed URLs must never be logged. Report generation does not trigger acceptance or settlement.
