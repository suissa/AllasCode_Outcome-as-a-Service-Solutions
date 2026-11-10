# Discovery → Outcome Proposal Bridge

## Purpose

`mapDiscoveryToOutcomeProposal(snapshot, options)` converts the browser Discovery answer envelope into an `OutcomeProposal` draft using the existing proposal composer. It preserves the Discovery source and mission ID for traceability.

## Mapping rules

- Company name and sector are copied only when answered.
- The declared goal, operational priority, team size, sales context and systems context are summarized without generating financial conclusions.
- Baseline and target are accepted only as finite numbers or unformatted numeric strings. Values such as `12%`, `R$ 12.000` or other formatted text remain unresolved until a reviewer supplies an unambiguous numeric value and unit.
- A selected measurement-source category (for example, "system") is not treated as a concrete source of truth. The exact system, report, query or owner must be supplied separately.
- Metric direction must be explicit and consistent with the target: an increase target must exceed baseline; a decrease target must be lower.
- Unknown answers are treated as absent even if an old value remains in the browser record.
- No answer is converted into evidence, causal attribution, an approved metric, a committed scope, a delivery obligation or a price.

## Explicit enrichment

The caller supplies tenant and proposal identity. A reviewer or later workflow must supply measurement unit, period, source of truth, population, attribution and guardrails; evidence references; scenario; scope; deliverables; dependencies; responsibilities; acceptance criteria; and pricing lines.

Missing enrichment is represented in the proposal readiness blockers and the bridge's `unmapped` list. A draft may become `ready_for_review` only when the existing proposal readiness rules are satisfied. This status is not acceptance or authorization to execute.

## Current integration boundary

This is a domain-level adapter and is exported from the package entry point. It does not yet read browser localStorage, persist proposals, expose an authenticated proposal API, or transmit customer Discovery data. The browser flow continues to store its answers locally until a separately reviewed server-side intake and persistence path is implemented.
