# Implementation — Syntropic Antifragility

## Boundary
This package provides deterministic domain decisions. It does not deploy software, execute arbitrary agent-generated code, mutate policy, or write directly to production release systems. It returns a promotion decision for existing release governance.

## Responsibilities
- Formalization Agent: turns reviewed requirements into explicit invariants and proof obligations; cannot approve its own proposal.
- Agda Formal Proof Checker: checks proof terms against the formal specification. A successful check proves only the encoded proposition, not that arbitrary Zig/TypeScript binaries refine the model.
- Semantic Behavior Compiler (SBC): validates typed semantic representation and emits a deterministic, versioned execution plan.
- BehaviorForgeAgent: proposes implementation artifacts and tests from approved contracts; generated output remains untrusted until independently checked.
- Polyglot runtime: every language implementation conforms to the same language-neutral contracts. The current OaaS.Quest reference implementation is TypeScript; Zig integration is a later adapter.

## Atomic Behavior contracts
### AB-SYN-001 CaptureDisruption
Input: Disruption.
Preconditions: authenticated tenant context, timestamp and at least one evidence reference.
Postconditions: immutable disruption accepted with same-tenant evidence only.
Errors: SYN-DISRUPTION-REQUIRED-FIELD, SYN-DISRUPTION-INVALID-TIMESTAMP, SYN-DISRUPTION-EVIDENCE-REQUIRED, SYN-EVIDENCE-CROSS-TENANT.

### AB-SYN-007 AssessPromotion
Input: versioned EvolutionProposal and PromotionAssessment.
Postconditions: pure decision with every blocker enumerated; no side effects.
Invariant: required proof missing/failed blocks promotion; tests, policy, bounded blast radius and rollback must pass; human approval applies when declared.

### AB-SYN-009 MeasurePostChangeEffect
Input: before/after metrics with direction and tolerance.
Postconditions: reports improved, regressed and unchanged metrics.
Invariant: syntropic improvement requires at least one improvement and zero guardrail regressions. Equal metrics are not improvement.

## Syntropic evolution cycle
1. Detect disruption.
2. Preserve tenant-scoped evidence references and digests.
3. Review root cause and contributing conditions.
4. Propose a structural change and regression tests.
5. Formalize invariants and proof obligations.
6. Check proofs where applicable.
7. Run unit, property, integration, security and bounded chaos tests.
8. Require policy, rollback, blast-radius and human gates.
9. Hand off to release governance.
10. Measure post-change effect against an immutable baseline.
11. Roll back on guardrail regression.
12. Publish reusable learning only after verified improvement.

## Polyglot implementation map
- TypeScript: current deterministic reference implementation.
- Agda: formal properties and proof artifacts.
- Zig: future constrained runtime implementation of approved Atomic Behaviors.
- Python: optional offline analysis of incident/forecast datasets; never the authority for promotion.
- Rust, Go, Ada/SPARK, Prolog and Haskell: specialized adapters only when a bounded responsibility justifies them and contract-conformance tests exist.

## Non-goals
- No automatic production mutation from an incident.
- No cross-tenant training or sharing by default.
- No raw customer payloads in the learning ledger.
- No claim that recovery alone is antifragility.
- No claim that Agda proves compiler correctness or target binary equivalence.
