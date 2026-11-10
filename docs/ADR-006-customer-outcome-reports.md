# ADR-006: Customer-facing outcome reports and evidence links

## Status
Accepted

## Context
A customer report must expose the outcome calculation and its limitations without disclosing raw evidence or granting broader access than the evidence policy permits. A list of evidence IDs is insufficient when customers need verifiable access; permanent public URLs are unsafe.

## Decision
Build a tenant-scoped report DTO from an approved outcome result, metric and period, methodology, attribution statement, guardrails, limitations and evidence identifiers. Preflight every field and every evidence record before invoking the link signer. Require source provenance, a SHA-256 content hash, a valid capture timestamp, tenant equality, purpose and classification authorization, and independent verification for confidential/personal evidence. Generate HTTPS-only, credential-free, fragment-free links with a 15-minute expiry. Render customer-safe Markdown with escaped untrusted text and an explicit attribution caveat.

The reporting library accepts a signer port and authenticated access context from its host. It does not own authentication, evidence storage, report persistence, payment acceptance or settlement.

## Consequences
- Invalid or cross-tenant evidence is rejected before any signing call.
- Customers receive expiring links and a readable report without embedded evidence payloads.
- Signed URLs must be redacted from logs and traces.
- Link issuance can still partially succeed if the external signer fails midway; the host must use idempotent signing or tolerate orphaned short-lived links.
- The report presents declared confidence and attribution; it does not independently prove causality or statistical validity.
