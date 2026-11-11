# Atomic Behavior implementation traceability

This matrix ties each open atomic issue to the code entry point and automated tests. "Implemented" means a domain/API implementation exists; issue closure remains gated on end-to-end acceptance evidence, security review and test coverage for every listed boundary.

| Issue | Behavior | Implementation |
|---:|---|---|
| #9 | Canonical entities and identifiers | `src/domain/identifiers.ts`; `test/domain/identifiers.test.ts` |
| #10 | Tenant boundaries and isolation | `src/domain/tenant-scope.ts`; `test/domain/tenant-scope.test.ts` |
| #11 | Workspace membership/invitations | `src/platform/workspace.ts`, `src/platform/postgres-workspace-store.ts`; PostgreSQL integration tests |
| #12 | RBAC/ABAC authorization | `src/domain/access-control.ts`, `src/security/authorization.ts`; `migrations/0007_authorization_rbac_abac.sql`; unit and PostgreSQL integration tests |
| #13 | Lifecycle and legal transitions | `src/domain/lifecycle.ts`; `migrations/0008_lifecycle_transition_events.sql`; `test/domain/lifecycle.test.ts`; PostgreSQL migration integration |
| #14 | Audit and immutable decisions | `src/domain/audit.ts`; `migrations/0009_immutable_audit_decision_ledger.sql`; `test/domain/audit.test.ts`; PostgreSQL integration tests |
| #15 | Policy registry/version/approval | `src/domain/policy.ts`, `PostgresPolicyRegistry`; `migrations/0011_policy_registry_version_approvals.sql`; `test/domain/policy.test.ts`; PostgreSQL integration tests |
| #16 | Privacy classification/consent/retention | `src/domain/privacy.ts`, `src/domain/consent.ts`; core-controls tests |
| #17 | Capture intent channels | `src/intent/intent.ts` |
| #18 | Normalize intent envelope | `src/intent/intent.ts` |
| #19 | Extract outcome/scope/deadline | `src/intent/intent.ts` |
| #20 | Clarify ambiguity | `src/discovery/intake.ts` |
| #21 | Intent completeness/qualification | `src/intent/intent.ts`, `src/discovery/qualification.ts`; intent tests/core-controls |
| #22 | Version intent/provenance | `src/intent/versioning.ts`; core-controls tests |
| #23 | Route qualified/unqualified intent | `src/discovery/intake.ts` |
| #24 | Discovery tasks/workshop | `src/discovery/intake.ts` |
| #25 | Metric definitions/units | `src/measurement/metrics.ts` |
| #26 | Baseline/source provenance | `src/diagnosis/outcome-spec.ts`, `src/measurement/metrics.ts` |
| #27 | Data quality/freshness/confidence | `src/measurement/data-quality.ts`; metrics tests |
| #28 | Bottlenecks/risks/constraints | `src/diagnosis/outcome-spec.ts` |
| #49 | Target/timeframe/window | `src/diagnosis/outcome-spec.ts` |
| #50 | Attribution/assumptions/uncertainty | `src/outcomes/attribution.ts`; core-controls tests |
| #51 | Approve outcome/baseline | `src/diagnosis/outcome-spec.ts` |
| #52 | Detect baseline/target change | `src/measurement/target-change.ts` |
| #53 | Versioned capability catalog | `src/solutions/catalog.ts` |
| #54 | Causes → candidate capabilities | `src/solutions/catalog.ts` |
| #55 | Alternatives/dependencies | `src/solutions/catalog.ts` |
| #56 | Cost/benefit/risk/confidence | `src/solutions/catalog.ts` |
| #57 | Scenario/sensitivity | `src/solutions/catalog.ts` |
| #58 | Compare alternatives | `src/solutions/catalog.ts`; core-controls tests |
| #59 | Evidence-backed recommendations | `src/solutions/recommendation.ts` |
| #60 | Record human decisions | `src/solutions/recommendation.ts` |
| #61 | Proposal/scope generation | `src/commercial/agreement.ts` |
| #62 | Deliverables/exclusions/responsibility | `src/commercial/agreement.ts` |
| #63 | Fee components | `src/commercial/agreement.ts` |
| #64 | Outcome fees/caps/floors/disputes | `src/commercial/outcome-fee.ts` |
| #65 | Contract policy/approval | `src/commercial/agreement.ts`, `src/domain/policy.ts` |
| #66 | Acceptance/signature/version | `src/commercial/agreement.ts` |
| #67 | Meter/reconcile usage | `src/commercial/metering.ts` |
| #68 | Invoice/settlement/refund/dispute | `src/commercial/invoice.ts` |
| #69 | Task decomposition/dependencies | `src/execution/orchestrator.ts` |
| #70 | Human/AI/service actors | `src/execution/workflow.ts` |
| #71 | Authority/policy/approval gates | `src/execution/approval.ts`, `src/domain/access-control.ts` |
| #72 | Durable steps/retry/compensation | `src/execution/workflow.ts`, `src/operations/recovery.ts` |
| #73 | Connector dispatch/contracts | `src/integrations/connector.ts` |
| #74 | Task state/output/telemetry | `src/execution/workflow.ts`, `src/operations/telemetry.ts` |
| #75 | Human escalation | `src/execution/approval.ts` |
| #76 | Pause/resume/cancel/replay | `src/execution/orchestrator.ts` |
| #77 | Deliverable acceptance | `src/execution/acceptance.ts` |
| #78 | Post-intervention observations | `src/measurement/metrics.ts` |
| #79 | Evidence integrity/provenance/permissions | `src/evidence/evidence.ts` |
| #80 | Baseline/target/observed comparison | `src/outcomes/settlement.ts` |
| #81 | Attribution and uncertainty | `src/outcomes/attribution.ts` |
| #82 | Outcome/confidence calculation | `src/outcomes/settlement.ts` |
| #83 | Customer-facing outcome reports with tenant-scoped, preflight-authorized, short-lived HTTPS evidence links and safe Markdown rendering | `src/reporting/report.ts`; `test/reporting/customer-outcome-report.test.ts`; `specs/customer-outcome-report/`
| #84 | Acceptance/payment/bonus/refund/dispute flow | `src/commercial/settlement-workflow.ts`, `src/commercial/durable-settlement.ts`; `migrations/0012_durable_settlement_workflow.sql`; unit and PostgreSQL integration tests |
| #85 | Reproducible snapshots/audit | `src/reporting/snapshot.ts` |
| #86 | Tenant-scoped SLO evaluation, stale/critical health aggregation, validated trace context and privacy-redacted telemetry events | `src/operations/observability.ts`; `test/operations/observability.test.ts`; `specs/slo-health-telemetry/` |
| #87 | Trace/log/metric correlation | `src/operations/telemetry.ts` |
| #88 | Anomaly/failure/SLO breach | `src/operations/health.ts` |
| #89 | Secrets/rotation/access review | `src/security/secret-reference.ts`, `src/security/access-review.ts` |
| #90 | Security/privacy/compliance evidence | `src/security/compliance.ts`, privacy controls |
| #91 | Backup/restore/DR/export | `src/operations/backup.ts` |
| #92 | Release/migration/flags/rollback | `src/operations/recovery.ts` |
| #93 | Feedback/incidents/lessons | `src/operations/feedback.ts` |
| #94 | AI evaluation/drift/safety | `src/ai/evaluation.ts`, `src/security/ai-guard.ts` |
| #95 | Improve catalog/playbooks from evidence | `src/solutions/catalog.ts`, `src/solutions/playbook.ts` |

## Cross-cutting execution

- Public exports: `src/index.ts`.
- Atomic Behavior execution: `src/core/atomic-behavior.ts` (schema validation → tenant context → authorization → handler → audit).
- Integrated outcome case: `src/application/outcome-case.ts` (approved spec → evidence/observations → settlement/report → dispute).
- CI: `.github/workflows/typescript.yml` runs strict typecheck and tests on pushes and pull requests.

## Validation status

Issue implementations are tracked separately from issue closure. Do not close an issue merely because a module exists: required acceptance tests, adversarial tenant/authorization tests, and any external integration evidence must be attached first.

## Additional implementation and verification added

| Issue | Verified capability added | Evidence |
|---:|---|---|
| #17–18 | Capture and normalize web/API/conversation intent with source provenance | `src/intent/intent.ts`; `test/discovery/intake.test.ts` |
| #24 | Generate discovery interview, data-request, process-map and workshop tasks from qualified intent | `src/discovery/intake.ts`; `test/discovery/intake.test.ts` |
| #68 | Append payment/refund/dispute events with tenant, currency, amount and status guards | `src/commercial/invoice.ts`; `test/atomic-behaviors/functional-coverage.test.ts` |
| #69 | Validate task dependency graphs, cycles, tenant boundaries and deterministic execution waves | `src/execution/task-graph.ts`; `test/execution/task-graph.test.ts` |
| #71–72 | Durable PostgreSQL task state, compare-and-set claims, approval gate, timeout, retry, cancellation and compensation hook | `src/execution/durable-runtime.ts`; `migrations/0002_workflow_tasks.sql`; `test/execution/durable-runtime.test.ts` |
| #76 | Explicit legal execution-control transitions and replay counter | `src/execution/task-graph.ts`; `test/execution/task-graph.test.ts` |
| #82 | Normal-approximation confidence interval with minimum sample-size guard | `src/outcomes/settlement.ts`; `test/atomic-behaviors/functional-coverage.test.ts` |
| Cross-cutting | PostgreSQL case/audit/idempotency store and authenticated HTTP adapter | `src/persistence/`, `src/http/server.ts`, `test/persistence/postgres.integration.test.ts` |
| Cross-cutting | Strict ABT validation for identifiers, text, email, phone, URL, money, dates, timestamps, references, evidence, metrics, secrets and payload envelopes | `src/core/abt.ts`; `test/core/abt.test.ts` |

These additions increase implementation depth and CI coverage, but do not close the backlog. In particular, identity-provider integration, policy administration, queue/outbox relay, deployed connector implementations, payment-provider reconciliation, full dashboard, production deployment and operational security review still require dedicated acceptance work.

| #85 | Persist immutable tenant-scoped calculation snapshots with canonical fingerprints and atomic audit-ledger records | `src/reporting/snapshot.ts`; `migrations/0010_calculation_snapshots.sql`; `test/reporting/calculation-snapshot.test.ts`; PostgreSQL integration test |

| #25 | Versioned metric definitions with semantic unit, aggregation, direction, freshness and source constraints | `src/measurement/metrics.ts`; `test/measurement/metrics.test.ts`; `specs/metric-definitions/` |
| #26–27 | Strict observation provenance/source validation, freshness and confidence boundaries; completeness and data-quality assessment | `src/measurement/metrics.ts`, `src/measurement/data-quality.ts`; `test/measurement/metrics.test.ts`, `test/measurement/data-quality.test.ts`; `specs/metric-observation-quality/` |

| #17–18 | Strict channel capture, normalized request envelope, immutable snapshots and provenance chronology | `src/intent/intent.ts`; `test/intent/intent.test.ts`; `specs/intent-capture/` |

| #19 | Structured outcome/scope/deadline/constraint extraction with confidence and ambiguity gates | `src/intent/intent.ts`; `test/discovery/intake.test.ts`; `specs/intent-extraction/` |

| #20 | Explicit field/ambiguity questions and fail-closed routing before discovery | `src/discovery/intake.ts`; `test/discovery/intake.test.ts`; `specs/intent-clarification/` |

| #21 | Strict completeness/rule validation, scope/domain/deadline constraints and immutable diagnostics | `src/discovery/qualification.ts`; `test/discovery/intake.test.ts`; `specs/intent-qualification/` |

| #22 | Validated contiguous tenant-scoped intent history, immutable snapshots and DB append-only protection | `src/intent/versioning.ts`; `src/intent/postgres-version-store.ts`; `migrations/0013_immutable_intent_versions.sql`; `test/intent/postgres-version-store.test.ts`; `test/persistence/postgres.integration.test.ts`; `specs/intent-versioning/`; `docs/ADR-005-immutable-intent-history.md` |

| #23 | Three-way routing (discovery/clarification/rejected) with stable reasons and safe explanations | `src/discovery/intake.ts`; `src/discovery/qualification.ts`; `test/discovery/intake.test.ts`; `specs/intent-routing/` |
