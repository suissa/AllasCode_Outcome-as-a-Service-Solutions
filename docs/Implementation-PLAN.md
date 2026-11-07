# Implementation Plan — Outcome as a Platform (OaaP)

> **Codex execution contract:** This is the product specification and backlog. Implement behavior, not a prescribed stack. Do not introduce a framework, database, provider or language unless a task requires a decision. Choose the best-fit tool category, record rationale/alternatives in an ADR, and keep domain contracts technology-neutral. Work test-first: write failing tests before implementation. Never weaken validation to make fixtures pass.

## Goal

Build a platform that turns a customer's desired business outcome into a measurable, governed, executable, observable and continuously improved solution. Capture intent; diagnose current state; define baseline and target; model scenarios; compose capabilities; execute through accountable actors; measure evidence; report attributable outcomes; and manage commercial agreements around agreed results.

## Scope and non-goals

- Organization, workspace, user, customer, partner, project, outcome, initiative, capability, execution, evidence and contract are first-class concepts.
- Vertical solutions are packages/extensions, not assumptions in the core.
- Never claim causality or guaranteed ROI without a declared method, baseline, evidence and uncertainty.
- Require human approval for high-impact, irreversible, regulated, financial or externally visible actions.

## Architecture and agent conventions

- **Specification first:** each domain object/behavior has manifest, schema, config and flow contract.
- **Atomicity:** one Atomic Behavior (AB) performs one observable responsibility, with explicit input/output, failure modes and tests.
- **Traceability:** Goal → Macro Task → Atomic Behavior → implementation artifact → test → evidence.
- **Idempotency:** retries do not duplicate business effects.
- **Versioning:** contracts, policies, plans, metrics and outcome definitions become immutable versions once used.
- **Explainability:** recommendations, decisions, transformations and outcome claims link to evidence and assumptions.
- **Tenant isolation:** no cross-tenant reads, writes, search, cache or event leakage.
- **Privacy by design:** minimize, classify, purpose-limit, retain only as required; support export/deletion subject to legal retention.
- **Resilience:** explicit timeout, retry, backoff, dead-letter, replay and recovery semantics.
- **Observability:** correlate request, intent, outcome, execution, actor, behavior, evidence and billing identifiers.
- **No silent healing:** normalize only unambiguous/lossless cases; record original, repaired value, rule and confidence. Ambiguous/consequential repair requires human review.

## Recommended capability/tool categories (not technology mandates)

| Capability | Best-fit tool category / selection guidance |
|---|---|
| Discovery | Structured interview/workshop, journey mapping, outcome tree, requirements repository |
| Domain modeling | Domain-driven design, event storming, bounded-context maps, ADRs |
| Contracts/validation | Schema and contract validator, property-based testing, mutation testing |
| Workflow | Durable workflow engine with retries, compensation, human tasks and audit history |
| Identity/access | OIDC-compatible identity, passkeys/WebAuthn, RBAC + ABAC, policy-as-code, secrets manager |
| Data/evidence | Transactional store, append-only evidence ledger, data catalog, lineage |
| Integration | API gateway, connector framework, webhooks, event broker, contract tests |
| AI assistance | Model gateway, structured-output validation, eval suite, prompt/model registry, human review |
| Measurement | Metrics catalog, baseline/target registry, experiment/causal evaluation toolkit |
| Reporting | Semantic metrics layer, BI/reporting, dashboards and export generator |
| Security/compliance | Threat modeling, SAST/DAST, dependency scanning, privacy impact assessment, control evidence |
| Operations | OpenTelemetry-compatible instrumentation, SLO/error budget, alerting, incident management |
| Commercial | Usage metering, invoicing/ledger, contract rules, reconciliation |
| Delivery/quality | CI, test pyramid, integration/e2e tests, release automation, feature flags |

## Required specification layout

Every feature/behavior package MUST contain or reference:

- **manifest.md** — purpose, owner, version, dependencies, maturity, risk, permissions, invariants, observability and macro issue.
- **schema.yml** — technology-neutral input/output/domain schema; every property includes semantic type, meaning, requiredness, bounds, normalization, validation, privacy classification and error code.
- **config.toml** — typed operational defaults and policy references only; no secrets; environment overrides explicit.
- **behavior.2flow** — flow in the form `atomic_behavior -(action)-> next_atomic_behavior`; include success, rejection, retry, escalation and terminal paths.
- **implementation.md** — agent instructions, decisions, pseudocode, side effects, idempotency and boundaries.
- **tests/** — unit, property, contract, integration and acceptance fixtures; valid/invalid payloads, expected errors and evidence.

## Universal Atomic Behavior Type (ABT) contract

ABTs are semantic, language-independent primitives. Native implementations must preserve these contracts.

| ABT | Primitive semantics | Validation | Safe self-healing | Synthetic tests |
|---|---|---|---|---|
| Identifier | String/token | non-empty, canonical format, namespace and uniqueness where required | trim surrounding whitespace only if lossless | canonical; empty, malformed, wrong namespace, duplicate |
| Text | Unicode string | length, encoding, forbidden controls, optional pattern | trim outer whitespace; never rewrite meaning | min/max, empty, controls, over-limit |
| Email | String | parse address, normalize domain, policy checks | lowercase domain; preserve local-part semantics | valid, malformed, missing domain, invalid chars |
| Phone | String | parse with country context, canonical international form | normalize separators only if unambiguous | local/international, ambiguous country, invalid |
| URL | String | scheme, host, allowlist, unsafe credentials | add scheme only under explicit policy | HTTPS, unsupported scheme, malformed, disallowed host |
| Enum | String/token | exact membership in versioned set | aliases only via explicit mapping | allowed values, unknown, wrong case if strict |
| Boolean | Boolean | strict boolean; no truthy coercion | none | true/false, null, string/number impostors |
| Integer | Integer | bounds, integrality, overflow | numeric-string conversion only if policy allows | boundary, below/above, fraction, NaN/string |
| Decimal/Money | Decimal + currency | precision, scale, currency and domain bounds | rounding only with declared mode/approval | zero, bounds, excess precision, invalid currency |
| Percentage/Ratio | Decimal | declared range and denominator semantics | none | boundaries, negative, >max, zero denominator |
| Date | Calendar date | valid ISO semantic date/calendar | unambiguous format conversion only | leap day, invalid day/month, boundary |
| Timestamp | Instant | timezone-aware, precision and allowed window | attach timezone only when source zone is known | UTC/offset, naive, invalid, out-of-window |
| Duration | Quantity + unit | nonnegative/range, canonical unit | exact unit conversion | zero, bounds, negative, unsupported |
| Quantity | Decimal + unit | unit compatibility, precision and bounds | exact unit conversion | valid, incompatible, invalid scale |
| Object | Structured object | required/nested schemas, unknown-field policy | fill only contract-defined defaults | complete, missing, extra, nested invalid |
| Array | Ordered collection | item schema, min/max, uniqueness/order policy | deduplicate only if explicitly idempotent | empty/bounds, duplicate, invalid item |
| Map | Key/value collection | key/value schemas, collision policy | none unless deterministic | valid, invalid key/value, collision |
| Reference | Typed ID | existence, tenant scope, lifecycle and permission | never invent/replace target | existing, missing, cross-tenant, inaccessible |
| Secret | Secret reference/value | never log; format, scope, rotation/expiry | never auto-repair or expose | missing, expired, malformed, leakage assertion |
| Evidence | Evidence reference | provenance, integrity, timestamp, source, access and retention | trusted-source metadata enrichment only | trusted, missing provenance, tampered, expired |
| Metric | Metric ID + value + unit + period | catalog definition, unit, aggregation, freshness, completeness | exact unit conversion only | valid, wrong unit, stale, incomplete |
| Expression | Restricted AST | allowlisted operators, typed operands, complexity, no arbitrary execution | none | valid, type mismatch, injection, complexity |
| Payload | Typed object | version, schema, size, tenant and signature as applicable | envelope normalization only | valid, wrong version, oversized, invalid signature |

**ABT test rule:** each property gets isolated tests calling its ABT validator directly. Generate valid/invalid synthetic values from the definition (boundary, equivalence partition, mutation/property-based). Assert acceptance/rejection and stable error codes. Then test aggregate schema. Any property failing atomic validation rejects the payload unless explicitly optional with omission semantics.

## Test-first acceptance protocol (mandatory)

1. Write contract and failing tests before implementation.
2. Define canonical valid payload and expected output.
3. Mutate exactly one property/constraint per invalid fixture; include missing fields, wrong ABT, boundaries, tenant mismatch, forbidden transitions and malicious input.
4. Assert invalid cases fail at the responsible validator with stable error code/path; no downstream side effect.
5. Assert valid payload follows declared 2flow and yields deterministic, schema-valid output.
6. Check invariants/constraints before and after each state transition.
7. Test idempotency, retry, timeout, concurrency, authorization, audit and privacy where relevant.
8. Test self-healing separately: approved repair succeeds and is recorded; ambiguous repair rejects/escalates.
9. Run unit → contract → integration → end-to-end → security/privacy tests; no skipped/flaky acceptance tests.
10. Attach test output, behavior coverage, evidence and unresolved risks to issue/PR.

## Canonical platform payload (illustrative fixture)

```json
{
  "payload_version": "1.0",
  "tenant_id": "tenant_demo_001",
  "actor_id": "actor_owner_001",
  "request_id": "req_20261107_0001",
  "intent": {
    "statement": "Reduce the time between customer request and confirmed appointment",
    "domain": "operations",
    "desired_outcome": "shorter_confirmation_time",
    "baseline": {"metric": "appointment_confirmation_minutes", "value": 120, "unit": "minute", "period": "2026-10"},
    "target": {"metric": "appointment_confirmation_minutes", "value": 30, "unit": "minute", "period": "2026-12"},
    "deadline": "2026-12-31",
    "constraints": ["preserve_human_approval_for_cancellations"]
  },
  "context": {"industry": "services", "organization_size": "micro", "country": "BR"},
  "consent": {"purpose": "outcome_assessment", "granted": true, "record_id": "consent_001"},
  "idempotency_key": "idem_req_0001"
}
```

Fixture only: each use case defines requiredness and semantics. Include expected normalized payload, diagnostic/outcome response and audit evidence.

## Macro tasks and Atomic Behaviors

Each macro becomes one GitHub issue labeled **goal**. Each AB becomes a separate issue labeled **atomic-behaviors**, linked exactly as:
`# [<macro issue title>](<macro issue URL>) - <atomic behavior name>`

### M1 — Outcome domain, workspace and governance foundation
**Goal:** tenant-safe domain, lifecycle, ownership and governance primitives.
- AB: Define canonical domain entities and identifiers.
- AB: Define tenant/workspace boundaries and isolation rules.
- AB: Implement organization/workspace membership and invitations.
- AB: Implement role, attribute and resource authorization decisions.
- AB: Define lifecycle/state machines and legal transitions.
- AB: Implement audit events and immutable decision history.
- AB: Implement policy registry, versioning and approvals.
- AB: Implement privacy classification, consent and retention metadata.

### M2 — Intent intake, qualification and discovery
**Goal:** transform customer language/context into validated, traceable outcome request.
- AB: Capture intent through web/API/conversation channels.
- AB: Normalize intent envelope and request metadata.
- AB: Extract desired outcome, scope, deadline and constraints.
- AB: Resolve ambiguity with explicit clarification questions.
- AB: Validate completeness and qualification rules.
- AB: Persist intent versions and provenance.
- AB: Route qualified/unqualified requests and explain rejection.
- AB: Convert accepted intent into discovery/workshop tasks.

### M3 — Diagnosis, baseline and outcome specification
**Goal:** evidence-backed diagnosis and measurable outcome contract.
- AB: Register metric definitions and semantic units.
- AB: Collect baseline observations and source provenance.
- AB: Assess data quality, freshness and confidence.
- AB: Identify process bottlenecks, risks and constraints.
- AB: Define target, timeframe and measurement window.
- AB: Define attribution method, assumptions and uncertainty.
- AB: Approve outcome specification and baseline snapshot.
- AB: Detect baseline/target changes and require re-approval.

### M4 — Solution design, scenarios and capability catalog
**Goal:** compose solution options and compare against outcome criteria.
- AB: Maintain capability/solution catalog and versioned descriptions.
- AB: Map diagnosed causes to candidate capabilities.
- AB: Generate solution alternatives and dependencies.
- AB: Estimate costs, benefits, risks and confidence ranges.
- AB: Simulate scenario assumptions and sensitivity.
- AB: Compare alternatives against constraints and targets.
- AB: Produce recommendation with rationale and evidence.
- AB: Record human selection, rejection and decision rationale.

### M5 — Commercial agreement, value model and billing
**Goal:** scope, responsibilities, pricing and outcome-based commercial rules.
- AB: Generate proposal/scope from approved solution.
- AB: Define deliverables, exclusions, responsibilities and acceptance.
- AB: Define fixed, usage, milestone and outcome-linked fee components.
- AB: Define outcome calculation, caps/floors, attribution and dispute rules.
- AB: Validate contract/policy compliance and approvals.
- AB: Capture acceptance, signatures and contract version.
- AB: Meter usage and reconcile commercial events.
- AB: Calculate invoice/settlement and handle dispute/refund adjustments.

### M6 — Execution orchestration and human-in-the-loop
**Goal:** execute approved work through reliable workflows, actors and integrations.
- AB: Decompose solution into tasks, dependencies and milestones.
- AB: Assign tasks to human, AI or external service actors.
- AB: Enforce authority, policy and approval gates before actions.
- AB: Execute durable workflow steps with timeout/retry/compensation.
- AB: Dispatch integrations/connectors and validate contracts.
- AB: Capture task state, outputs and execution telemetry.
- AB: Escalate blocked, ambiguous or high-risk actions to humans.
- AB: Support pause, resume, cancel and controlled replay.
- AB: Verify deliverables against acceptance contracts.

### M7 — Measurement, evidence, reporting and outcome settlement
**Goal:** evaluate execution/outcomes with trustworthy evidence and transparent reports.
- AB: Collect post-intervention metric observations.
- AB: Validate evidence integrity, provenance and permissions.
- AB: Compare baseline, target and observed results.
- AB: Apply declared attribution and uncertainty methodology.
- AB: Calculate achieved outcome and confidence interval.
- AB: Generate customer-facing report with evidence links.
- AB: Trigger acceptance, payment, bonus, refund or dispute workflow.
- AB: Preserve reproducible calculation snapshots and audit trail.

### M8 — Platform operations, security, quality and continuous improvement
**Goal:** secure/reliable operation and evidence-driven improvement.
- AB: Define SLOs, health checks and service telemetry.
- AB: Correlate traces/logs/metrics across outcome execution.
- AB: Detect anomalies, failures and SLA/SLO breaches.
- AB: Manage secrets, credentials, rotation and access reviews.
- AB: Run security/privacy controls and collect compliance evidence.
- AB: Manage backup, restore, disaster recovery and data export.
- AB: Manage release, migration, feature flags and rollback.
- AB: Capture feedback, incidents and lessons learned.
- AB: Evaluate AI/model behavior, quality drift and safety regressions.
- AB: Improve capability catalog, playbooks and templates from verified evidence.

## Shared rules

### Invariants
- Tenant ownership is explicit/immutable for tenant-scoped records.
- Execution references immutable intent, outcome contract, policy and solution versions.
- Outcome claims require baseline, observation, method and evidence.
- No side effect before authorization and required approval.
- State transitions are valid, attributable and auditable.
- Evidence/financial records are append-only; corrections create new versions/events.
- Same idempotency key never duplicates effects.
- Secrets/sensitive data never appear in logs, traces, reports or fixtures.
- Rejected atomic property prevents aggregate acceptance and downstream execution.

### Constraints
- Explicit size, rate, time, cost, concurrency and retention limits at public boundaries.
- Integrations declare timeout, retry budget, idempotency and failure mapping.
- Metrics declare unit, aggregation, source, period, freshness and completeness.
- AI output is schema-validated and policy-checked before use.
- Human review for uncertain, high-impact or irreversible actions.
- Least-privilege, purpose-bound and tenant-scoped data access.
- Configuration overrides are typed, validated and traceable.

### Compliance
- Map controls to applicable jurisdictions/contracts; implementation alone is not certification.
- Evidence consent/purpose, access, retention/deletion, processing, incident response and vendor/model use.
- Support data-subject request workflows and legal-retention exceptions.
- Record AI use, model/version, prompt/config version, evaluation and human override by risk tier.
- Compliance mappings are configurable and reviewed by qualified personnel.

### Guard rails
- Fail closed on authorization, signature, tenant, policy or integrity failures.
- Never infer consent, authority, baseline, target or financial approval.
- Never silently change contract semantics or measurement methodology.
- AI output remains advisory until validated/approved at its risk tier.
- Bound tool permissions, execution budget, recursion, payload size and external destinations.
- Prompt injection cannot alter policy/access boundaries.
- Quarantine malformed/untrusted integrations and evidence.
- Escalate low confidence, conflicting evidence and unsafe repairs.
- Provide kill switch, pause and rollback for active executions.

### Success examples
- Complete authorized intent accepted, versioned and linked to discovery.
- Outcome contract records baseline, target, timeframe, metric and evidence source.
- Selected solution executes with approvals, retries and traceable task outputs.
- Report reproduces achieved result from evidence and declared calculation.
- Repeated request is idempotent and does not duplicate work/billing.
- Customer inspects scope, progress, evidence, uncertainty and settlement.

### Error examples
- Missing/malformed required property → atomic validation error with property path.
- Cross-tenant reference → authorization/integrity rejection without data disclosure.
- Invalid transition → conflict error and unchanged state.
- Missing baseline/invalid metric unit → outcome contract rejected.
- Unapproved high-impact action → approval-required state, no side effect.
- Invalid AI output → quarantined, bounded retry or human escalation.
- Timeout after external side effect → reconcile by idempotency key before retry.
- Tampered/stale evidence → invalid evidence and blocked calculation.
- Ambiguous self-healing → no repair; clarification/escalation.

## Definition of Done

Macro completes only when all linked AB issues meet acceptance criteria, contracts/flows are documented, tests pass, security/privacy and observability are covered, failure/recovery verified, and Goal → AB → test → evidence is traceable. Update this plan as scope changes; code existence alone is not completion.
