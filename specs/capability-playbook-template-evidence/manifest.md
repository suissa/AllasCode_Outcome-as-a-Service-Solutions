# Evidence-backed capability catalog, playbooks and templates

- Behavior: publish versioned improvements to capabilities, playbooks and reusable templates only from independently verified, tenant-scoped evidence.
- Issue: [#95](https://github.com/suissa/OaaS.Quest/issues/95)
- Version: 1.0.0
- Evidence: references include tenant, SHA-256 content hash, verifier, verification time, classification and optional expiry; raw evidence content is never copied into catalog records.
- Capability updates: compare-and-swap against expected version, immutable version increments, validated benefit/cost ranges, causes, outcomes and dependencies.
- Playbook updates: behavior IDs are unique, input/output schemas are required, approval requirements are explicit and evidence basis is retained.
- Templates: behavior references and schemas are validated; a deterministic schema hash is published with evidence references.
- Governance: author and reviewer must be independent; both require action-specific authorization. Evidence verifier must differ from the author.
- Idempotency: store adapters bind publication keys to tenant and artifact identity; replay returns the prior publication, key reuse across artifacts is rejected.
- Side effects: persistence and evidence verification are explicit adapters; no raw evidence or secret material is stored by these workflows.
