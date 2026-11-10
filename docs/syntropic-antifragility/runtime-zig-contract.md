# Zig Runtime Contract — Syntropic Antifragility

## Boundary

Zig implements the trusted, constrained execution adapter for approved Atomic Behaviors. TypeScript defines the orchestration-facing contract. The Zig 0.16 module currently validates typed request/response envelopes; it is not yet a transport server or behavior executor.

## Protocol v1

Request: protocol_version="1"; tenant_id, execution_id, behavior_id; command (validate-contract | evaluate-policy | execute-approved-behavior | verify-invariant); input_digest, policy_digest; proof_refs[].

Response: protocol_version, execution_id; status (accepted | rejected | completed | failed); output_digest (required on completed); evidence_refs[]; error_code (required on failed).

## Implemented conformance

- Zig 0.16 typed request/response structures and fail-closed validators.
- Unknown commands and statuses are rejected.
- Execution correlation is enforced.
- Completed responses require an output digest; failed responses require a stable error code.
- Proof and evidence references cannot be empty.
- TypeScript validates the same envelope constraints and rejects pre-cancelled execution before dispatch.
- CI compiles and runs Zig contract tests independently of the TypeScript suite.

## Security invariants

1. Raw prompt text is never executable; semantic input must first compile to a typed, versioned Behavior contract.
2. Runtime cannot promote code, change policy or bypass approval.
3. Adapter cannot widen authority or tenant scope.
4. Missing/failed required proof blocks promotion.
5. Enforce deadlines, quotas, cancellation and isolation at the transport/executor boundary.
6. Completed outputs are content-addressed and evidence-linked.

## Lifecycle target

decode -> validate-envelope -> authenticate-workload -> verify-tenant -> verify-policy -> verify-proof-references -> dispatch-allowlisted-command -> enforce-budget -> execute -> hash-output -> append-evidence -> encode-response.

## Not yet implemented

- JSON wire decoder/encoder and Unix socket or mutually authenticated transport.
- Workload identity and policy/proof lookup integration.
- Actual allowlisted behavior executor.
- Deadline enforcement for a transport that ignores cancellation.
- End-to-end cross-language golden JSON vectors.
- WASI/native capability-limited execution; requires a separate threat-model review.
