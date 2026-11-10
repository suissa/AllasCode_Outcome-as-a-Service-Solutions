# Implementation notes

qualifyAgainst validates the rule itself and the evaluation clock before inspecting intent data. Required string values containing only whitespace are missing. Scope must be an array of non-empty strings and satisfy the configured minimum. A non-empty domain allowlist requires an exact allowed domain. When maxDeadlineDays is configured, a provided deadline must parse and fall within [now, now + maxDeadlineDays].

The function returns immutable diagnostics with stable reason codes. It does not mutate the intent, persist the rule or dispatch discovery tasks. The caller stores the rule version and decision evidence and blocks downstream work when qualified=false.
