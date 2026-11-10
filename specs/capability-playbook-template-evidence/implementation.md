# Implementation notes

Implemented by `src/solutions/capability-knowledge-governance.ts`.

- `publishCapabilityImprovement` updates cost/benefit ranges, causes, outcomes, dependencies and descriptions only after independent authorization and evidence verification.
- `improveGovernedPlaybook` validates unique behavior IDs and explicit input/output schemas before publishing a new version.
- `publishCapabilityTemplate` validates reusable behavior/schema references and emits a SHA-256 schema hash.
- All publications retain evidence IDs, increment versions/revisions and commit through compare-and-swap store adapters with idempotency keys.
- Evidence verification is tenant-scoped, checks digest, verifier, timestamp and expiry, and requires the verifier to differ from the author.
- Persistent catalog storage and evidence-provider integration remain host adapters; the domain module does not copy raw evidence payloads.
