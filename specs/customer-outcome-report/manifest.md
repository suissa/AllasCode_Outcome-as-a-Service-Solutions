# Customer outcome report

- Behavior: Generate customer-facing report with evidence links.
- Issue: [#83](https://github.com/suissa/OaaS.Quest/issues/83)
- Version: 1.0.0
- Owner: Reporting domain
- Dependencies: outcome settlement, evidence access control, signed-link provider.
- Maturity: reference implementation; provider and persistence adapters remain host responsibilities.
- Risk: customer-visible, confidential/personal evidence exposure, misleading attribution.
- Permissions: caller must provide an authenticated tenant/actor/purpose context and allowed evidence classifications.
- Invariants: report tenant equals access tenant; every cited evidence record is in that tenant, integrity metadata is present and access is permitted; links are HTTPS, credential-free and short-lived; report never embeds evidence payloads.
- Side effects: signed-link creation only, after complete input/evidence preflight. No payment or outcome acceptance is triggered.
- Idempotency: report generation is deterministic for identical input/time; signed URLs may differ by provider.
- Observability: stable error code/path; host should correlate report ID, tenant ID and request correlation ID without logging signed URLs.
- Privacy: report contains evidence identifiers and links only; redact signed URLs from logs and traces.
