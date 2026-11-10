# Implementation — Syntropic Antifragility

## Boundary
This package provides deterministic domain decisions. It does not deploy software, execute arbitrary agent-generated code, mutate policy, or write directly to production release systems. It returns a promotion decision for existing release governance.

## Responsibilities
- Formalization Agent: turns reviewed requirements into explicit invariants and proof obligations; cannot approve its own proposal.
- Agda Formal Proof Checker: checks proof terms against formal specification. Success proves only the encoded proposition, not arbitrary Zig/TypeScript binary refinement.
- Semantic Behavior Compiler (SBC): validates typed semantic representation and emits deterministic, versioned execution plans.
- BehaviorForgeAgent: proposes implementation artifacts/tests from approved contracts; generated output remains untrusted until independently checked.
- Polyglot runtime: language implementations conform to language-neutral contracts. Current reference is TypeScript; Zig adapter is future work.

## Atomic Behavior contracts
### AB-SYN-001 CaptureDisruption
Input: Disruption. Preconditions: authenticated tenant context, timestamp, evidence reference. Postcondition: immutable disruption with same-tenant evidence. Errors: SYN-DISRUPTION-REQUIRED-FIELD, SYN-DISRUPTION-INVALID-TIMESTAMP, SYN-DISRUPTION-EVIDENCE-REQUIRED, SYN-EVIDENCE-CROSS-TENANT.

### AB-SYN-007 AssessPromotion
Input: versioned EvolutionProposal and PromotionAssessment. Postcondition: pure decision listing every blocker. Required proof missing/failed blocks promotion; tests, policy, bounded blast radius and rollback must pass; risk-based human approval applies.

### AB-SYN-009 MeasurePostChangeEffect
Input: before/after metrics with direction and tolerance. Postcondition: improved/regressed/unchanged sets. Syntropic improvement requires >=1 improvement and zero guardrail regressions; equal metrics are not improvement.

## Syntropic evolution cycle
1. Detect disruption; 2. preserve tenant evidence references/digests; 3. review root cause; 4. propose structural change and regression tests; 5. formalize invariants; 6. check proofs; 7. run unit/property/integration/security/bounded chaos tests; 8. require policy, rollback, blast-radius and human gates; 9. hand off to release governance; 10. measure against immutable baseline; 11. rollback on regression; 12. publish learning only after verified improvement.

## Polyglot implementation map
- TypeScript: current deterministic reference.
- Agda: formal properties/proof artifacts.
- Zig: future constrained runtime implementation.
- Python: optional offline incident/forecast analysis; never promotion authority.
- Rust, Go, Ada/SPARK, Prolog, Haskell: specialized adapters only where bounded responsibility and contract-conformance tests justify them.

## Non-goals
No automatic production mutation; no cross-tenant learning by default; no raw customer payload in learning ledger; recovery alone is not antifragility; Agda does not prove compiler correctness or binary equivalence.

## Implemented in this PR follow-up
- Hash-chained in-memory append-only reference ledger with tenant isolation and integrity verification.
- Versioned formal proof registry linked to ledger events.
- Bounded chaos runner with approval/environment/request/time/control/rollback gates.
- Typed Zig runtime request/response envelope and correlation validation.
- PostgreSQL append-only reference migration and adapter boundary.
- Automated tests. Durable production adapter remains a deployment task.
