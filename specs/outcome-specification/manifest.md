# Outcome specification

Defines an immutable, versioned baseline snapshot and a measurable target for an outcome case.

## Behaviors
- Validate metric identity, semantic unit, aggregation and source provenance.
- Capture baseline observations and calculate the declared aggregate deterministically.
- Validate target values, constraints and a bounded measurement window.
- Require an independent approval for the baseline and target.
- Detect material baseline changes and require a new approval.

## Safety
Invalid, stale, incomplete, cross-metric or unauthorized input must fail closed without mutating approved snapshots.
