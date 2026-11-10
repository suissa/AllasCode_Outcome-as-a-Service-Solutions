# Zig Runtime Contract — Syntropic Antifragility

## Boundary
Zig implements the trusted, constrained execution adapter for approved Atomic Behaviors. TypeScript defines the reference contract. This document is the language-neutral boundary, not a claim that Zig has already been integrated.

## Protocol v1
Request: protocol_version="1"; tenant_id, execution_id, behavior_id; command (validate-contract | evaluate-policy | execute-approved-behavior | verify-invariant); input_digest, policy_digest; proof_refs[].
Response: protocol_version, execution_id; status (accepted | rejected | completed | failed); output_digest (required on completed); evidence_refs[]; error_code (required on failed).

## Invariants
1. Reject unknown protocol versions and commands.
2. Bind execution to tenant, ExecutionID, BehaviorID and policy digest.
3. Verify capability, permission and proof references before dispatch.
4. Raw prompt text is never executable; semantic input must first compile to a typed, versioned Behavior contract.
5. Runtime cannot promote code, change policy or bypass approval.
6. Return deterministic error codes and evidence references.
7. Enforce deadlines, quotas, cancellation and isolation.
8. Adapter cannot widen authority or tenant scope.
9. Completed outputs are content-addressed and evidence-linked.
10. TypeScript and Zig share conformance tests.

## Lifecycle
decode -> validate-envelope -> authenticate-workload -> verify-tenant -> verify-policy -> verify-proof-references -> dispatch-allowlisted-command -> enforce-budget -> execute -> hash-output -> append-evidence -> encode-response.

## Failure behavior
Malformed or unauthenticated request: reject before dispatch. Missing required proof: fail closed. Policy mismatch: reject. Deadline/cancellation: terminate bounded execution and emit evidence. Unexpected errors: stable error code; never leak secrets/customer payloads.

## Implementation sequence
1. Add Zig 0.16 request/response structs and bounded decoder.
2. Add transport adapter (Unix socket or mutually authenticated channel selected by ADR).
3. Implement contract/policy validation before execution.
4. Add golden JSON vectors shared with TypeScript tests.
5. Run conformance tests and fault injection.
6. Add capability-limited WASI/native execution only after threat-model review.
