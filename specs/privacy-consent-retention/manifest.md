# Privacy classification, consent and retention governance

- Behavior: classify data, record explicit consent, validate processing legal basis and assess retention/deletion eligibility with legal-hold protection.
- Issue: [#16](https://github.com/suissa/OaaS.Quest/issues/16)
- Version: 1.0.0
- Classification precedence: sensitive → personal → confidential → public → internal.
- Consent: tenant/data-subject/purpose/category scoped, source and SHA-256 evidence hash, versioned status and idempotent record.
- Withdrawal: authorized, revision-checked and audited; withdrawn consent cannot authorize new processing.
- Processing basis: personal/sensitive records require a valid legal basis. Consent-based processing requires an active, unexpired consent matching tenant, data subject, purpose and category, granted before processing.
- Retention: explicit retention deadline or policy-derived deadline; deletion-due records are distinguished from records protected by a documented legal hold.
- Privacy: consent evidence payloads and raw documents are not stored by the domain record; only references and hashes are retained.
- Side effects: consent storage, identity verification, deletion execution and legal-hold verification are explicit adapters.
