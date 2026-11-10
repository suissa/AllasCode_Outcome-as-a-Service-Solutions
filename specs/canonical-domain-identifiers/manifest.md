# Canonical domain identifiers and tenant scope

- Behavior: generate, parse and validate canonical namespaced entity identifiers and enforce runtime tenant execution scope.
- Issue: [#9](https://github.com/suissa/OaaS.Quest/issues/9)
- Version: 1.0.0
- Entity kinds: tenant, workspace, organization, actor, intent, outcome, initiative, capability, execution, evidence, contract, policy, task and metric.
- Canonical format: lowercase namespace plus underscore-separated lowercase alphanumeric suffix; suffix length 3–64.
- Generation: Unicode NFKD normalization, diacritic removal, lowercase and separator normalization. Long keys retain a stable SHA-256 suffix to prevent prefix-truncation collisions.
- Scope: tenant IDs are parsed at runtime; actor and correlation metadata must be non-empty, bounded and whitespace-free.
- Isolation: record tenant is parsed and compared before access; mismatch error omits tenant IDs to avoid disclosure.
- Side effects: none. Identifier generation and tenant-scope validation are pure.
