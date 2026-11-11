# OaaS.Quest — Architecture Reference v1.5
## Unified Outcome-as-a-Service, Polychromatic and Syntropic Architecture

**Status:** Unified architecture draft  
**Version:** 1.5  
**Repository:** [suissa/OaaS.Quest](https://github.com/suissa/OaaS.Quest)  
**Purpose:** Consolidate the architecture, operating model, evidence, security, formal methods and syntropic evolution in one canonical reference.

> This document is the repository's canonical integrated architecture reference. It consolidates material already represented by repository ADRs, operating-model documents, outcome-measurement specifications and the Syntropic Antifragility foundation. It does not claim that every component described here is already implemented or formally verified.

---

## 1. Abstract

Outcome as a Service (OaaS) is an outcome-oriented operating and technology model in which an organization defines a measurable business result, establishes a baseline and an evidence contract, and receives an intervention whose delivery and value are continuously evaluated. The platform is not merely a subscription to software capabilities: its unit of value is a verified outcome, with explicit scope, attribution limits, acceptance criteria, operational constraints and commercial settlement.

OaaS.Quest combines outcome discovery, semantic specification, planning, execution, measurement, governance and learning in a controlled lifecycle. Its architecture is hybrid and organization-isolated: dedicated on-premises and private-cloud deployments can be composed according to data sensitivity, latency, sovereignty, resilience and operational requirements. Tenant isolation remains mandatory even when a tenant has dedicated infrastructure.

The system is **Polychromatic**: it deliberately assigns different responsibilities to different programming languages and execution models rather than forcing the entire platform into a single stack. Contracts, schemas, versioned protocols and evidence connect those components. The architecture is also **Syntropic**: validated disturbances and failures can become inputs to structural improvement, but only through evidence, diagnosis, controlled change, regression checks and measurable verification. Failure itself is not considered improvement.

This reference distinguishes architecture intent, implemented capabilities, formalized properties and future work. It treats outcomes as claims that must be supported by evidence—not as promises inferred from model output.

## 2. Vocabulary and design principles

### 2.1 Core vocabulary

- **Outcome:** A measurable change in a business or operational state, defined by metric, population, period, baseline, target and acceptance rule.
- **Outcome Contract:** A versioned agreement describing the outcome, scope, evidence, exclusions, responsibilities, risk, acceptance and settlement.
- **Trajectory:** The ordered, auditable sequence of decisions, actions, observations and state transitions that connect intent to outcome.
- **Evidence:** A source-attributed observation or artifact that supports or challenges a claim.
- **Baseline:** A documented pre-intervention reference, including its period, data quality and uncertainty.
- **Intervention:** A bounded set of actions intended to influence one or more outcome metrics.
- **Attribution:** The method and assumptions used to estimate whether an observed change was caused by the intervention.
- **Tenant:** An organization and its isolated data, identities, policies, resources and audit domain.
- **Behavior:** A typed, versioned unit of executable business semantics, with preconditions, effects, constraints and evidence requirements.
- **Syntropic Antifragility:** The controlled process through which verified failures, perturbations and unexpected outcomes produce validated structural improvements.
- **Polychromatic Architecture:** A multi-language architecture in which each language/runtime is selected for a defined responsibility and integrated through explicit contracts.

### 2.2 Principles

1. Outcome before feature: capabilities are justified by the results they enable and the evidence they produce.
2. Evidence before acceptance: no outcome is accepted solely because an agent or model asserts success.
3. Human authority is explicit: permissions, approvals, escalation and accountability are represented as policy—not inferred from conversational tone.
4. Least privilege and tenant isolation apply to data, compute, identities, logs, artifacts and model context.
5. Fail closed for critical boundaries: unknown policy, invalid signatures, incompatible contracts or unverifiable evidence block consequential operations.
6. Reproducibility: calculations, model versions, datasets, parameters and contract revisions are recorded sufficiently to reproduce or explain decisions.
7. Reversibility: changes are staged, versioned and recoverable where possible.
8. Uncertainty is disclosed: forecasts, causal estimates and evidence quality carry uncertainty and limitations.
9. Human-readable semantics and machine-enforceable contracts coexist.
10. Architecture claims are separated from implementation status and proof status.

## 3. Outcome lifecycle

The platform organizes work into a lifecycle with explicit gates:

1. **Discover:** capture organizational context, constraints, pain points and desired results.
2. **Specify:** convert intent into an Outcome Contract with measurable indicators and acceptance rules.
3. **Baseline:** collect and qualify historical/current observations before intervention.
4. **Diagnose:** identify plausible drivers, bottlenecks, risks and data limitations.
5. **Design:** propose interventions, alternatives, expected ranges, cost and dependencies.
6. **Approve:** obtain authority for scope, risk, budget, data access and autonomy.
7. **Execute:** run approved actions within capability and policy boundaries.
8. **Observe:** capture operational telemetry and business evidence continuously or at defined intervals.
9. **Evaluate:** compare outcomes with baseline, target and counterfactual/causal assumptions.
10. **Accept or remediate:** apply contract acceptance rules, dispute handling and corrective actions.
11. **Settle:** calculate commercial settlement from accepted evidence and contract terms.
12. **Learn:** preserve validated knowledge, update policies/behaviors and propose bounded evolution.

Every phase produces versioned artifacts. A transition is permitted only when its required inputs, authorization and evidence are satisfied. The lifecycle is not a linear waterfall: diagnosis, execution and evaluation may iterate, but the history remains append-only and the accepted contract revision is identifiable.

## 4. Outcome measurement and causal evidence

### 4.1 Metric definition

Every outcome metric should specify:

- canonical name and business meaning;
- unit, direction of improvement and aggregation;
- numerator/denominator where applicable;
- population, segment and exclusions;
- data source, ownership and refresh frequency;
- baseline window and target horizon;
- quality checks and missing-data policy;
- acceptance threshold and tolerance;
- known confounders and seasonality;
- uncertainty or confidence interval where estimable.

A metric without a stable definition cannot be compared reliably across periods or organizations.

### 4.2 Evidence hierarchy

Evidence is classified by provenance and reliability, not by rhetorical strength:

- **E0 — Assertion:** unverified statement or model-generated hypothesis.
- **E1 — Trace:** event/log with provenance but limited independent corroboration.
- **E2 — Reconciled observation:** validated source data, quality checks and traceable transformation.
- **E3 — Independent corroboration:** reconciled evidence supported by an independent system/source or audit.
- **E4 — Causal/contractual evidence:** evidence evaluated under an explicit attribution method and contract acceptance rule, with assumptions and uncertainty disclosed.

This is a practical classification, not a universal scientific scale. A contract may require different evidence levels for different outcomes. Higher levels do not automatically eliminate bias or measurement error.

### 4.3 Attribution and counterfactuals

Observed change is not synonymous with causal impact. Evaluation should document the attribution design used, such as randomized experiments where feasible, difference-in-differences, interrupted time series, matched controls, synthetic controls or carefully qualified observational analysis. The method must fit the data and context.

Reports should separate:
- observed change;
- estimated intervention effect;
- contribution of other known drivers;
- uncertainty and sensitivity;
- limitations of the design;
- whether the contract's acceptance condition is satisfied.

If causal attribution is not defensible, the platform must label the result as observed association or contribution estimate rather than proven causation.

### 4.4 Settlement

Settlement is derived from immutable contract terms and accepted evidence. The calculation records contract version, metric snapshots, evidence references, formulas, adjustments, approvals and result. Disputes trigger a documented review path; they must not silently overwrite the original calculation. Corrections create a new revision with an explicit reason and linkage.

## 5. Adaptive predictive intelligence

OaaS.Quest may use ensembles to estimate expected outcomes, risks, timing and resource requirements. Model choice is dynamic and evidence-based rather than fixed by brand or popularity.

### 5.1 Weighted ensemble

For forecasts from models (f_1,ldots,f_m), a weighted combination can be expressed as:

[
\hat y_{t+h}=\sum_{i=1}^{m}w_{i,t,h}\hat y_{i,t+h},\qquad
w_{i,t,h}\ge 0,\quad\sum_iw_{i,t,h}=1.
]

Weights should be estimated from **rolling-origin / time-aware backtesting**, using only information available before each forecast origin. Model performance may be evaluated by horizon, segment and operating regime. A model that is closer to realized outcomes on comparable historical windows should generally receive more influence, subject to calibration, robustness and diversity constraints.

Possible strategies include normalized inverse-error weights, constrained optimization, softmax over validated scores, or dynamic model averaging. No one weighting rule is universally optimal. The system should compare candidate methods against simple baselines and preserve a fallback.

### 5.2 Controls against misleading forecasts

- prevent temporal and target leakage;
- maintain rolling-origin evaluation and versioned datasets;
- track MAE/RMSE and appropriate probabilistic scores (e.g., CRPS or log score);
- inspect calibration and interval coverage;
- evaluate stability across regimes and segments;
- avoid over-weighting correlated models that share failure modes;
- disclose prediction intervals and model disagreement;
- monitor drift and degrade safely when evidence becomes insufficient;
- do not treat forecasts as guarantees or as outcome acceptance evidence.

The ensemble is an input to decisions and planning. Realized outcomes update its evaluation only after the observation window closes and data quality is validated.

## 6. Polychromatic Formal Architecture

### 6.1 Rationale

A single-language architecture would impose unnecessary compromises across web orchestration, numerical experimentation, secure connectors, deterministic execution, logic, pure transformations and high-integrity components. OaaS.Quest therefore uses a **Polychromatic Architecture**: languages are selected by responsibility, and the integration boundary is a contract rather than shared implementation assumptions.

### 6.2 Language responsibility map

| Language / system | Primary responsibility | Boundary and qualification |
|---|---|---|
| TypeScript | Web interface, API, orchestration, contract UX and application workflows | Typed API schemas; input validation; no implicit trust in client state |
| Python | Statistical analysis, ML experiments, forecasting pipelines and scientific evaluation | Reproducible environments, data lineage and model artifacts |
| Rust | Security-sensitive connectors, cryptographic integration and robust systems components | Explicit threat model, reviewed dependencies and protocol contracts |
| Zig | Deterministic execution/runtime components and constrained low-level operations | Allowlisted commands, bounded resources, explicit ABI/wire contract |
| Go | Network services, operational agents and distributed service integration | Versioned RPC/API, health and telemetry contracts |
| Prolog | Rule-based inference, policy reasoning and explainable logical relations | Rules are versioned; conclusions include provenance; execution is bounded |
| Haskell | Pure transformations, typed semantic processing and deterministic functional components | Referentially transparent core and explicit effects at boundaries |
| Ada / SPARK | Components requiring stronger safety/integrity constraints and analyzable behavior | Applicable proof obligations and toolchain evidence documented per component |
| Agda | Formalization of selected invariants, propositions and proofs | Proves only encoded propositions under stated assumptions; not automatic proof of the entire implementation |

This table expresses architectural allocation, not a claim that every language component is already deployed in production.

### 6.3 Contract-first integration

Components communicate through explicit, versioned interfaces. A contract should define:

- operation identifier and protocol version;
- request/response schema and canonical encoding;
- tenant and authority context;
- correlation and idempotency identifiers;
- preconditions and postconditions;
- resource/time bounds;
- error taxonomy and retry semantics;
- integrity/authentication requirements;
- evidence and audit fields;
- compatibility and deprecation policy.

A component may be replaced or implemented in another language if it preserves the contract and passes conformance tests. Cross-language calls must not depend on undocumented memory layouts, implicit serialization or ambient privileges.

### 6.4 Semantic Behavior-typed Algebra (SBTA)

**SBTA** is the proposed semantic foundation for expressing business behavior as typed, composable units with explicit constraints and effects. It connects intent and domain semantics to executable plans while keeping authorization, evidence and runtime safety separate from natural-language generation.

SBTA should be treated as an OaaS.Quest architectural proposal, not as a universally established standard or a synonym for one existing formalism. It can draw on typed DSLs, algebraic effects, refinement types, behavior trees, temporal logic and formal methods without claiming those concepts are identical.

A Behavior definition should minimally contain:
- stable identifier and semantic version;
- domain meaning and typed inputs/outputs;
- preconditions and invariants;
- allowed effects and required capabilities;
- execution plan or implementation binding;
- evidence obligations;
- failure/compensation semantics;
- tests and conformance criteria.

### 6.5 FormalAgent and BehaviorForge boundary

The intended flow is:

**Intent / Outcome Contract → Semantic Behavior Compiler (SBC) → BehaviorForgeAgent → validation artifacts → approved execution plan → Zig Runtime**

FormalAgent/Agda may formalize selected invariants and proof obligations. SBC translates approved semantic definitions into deterministic intermediate plans. BehaviorForgeAgent may propose implementation or tests, but generated artifacts are untrusted until validated.

Important distinctions:
- Agda proves encoded propositions, not arbitrary generated code.
- A proof must be linked to the implementation through refinement, conformance or a verified compilation argument; otherwise it is evidence about the specification only.
- LLM output is a proposal, never an authorization token.
- The runtime does not execute arbitrary LLM-generated code or unrestricted shell instructions.

## 7. Syntropic Antifragility

### 7.1 Definition

**Syntropic Antifragility** is OaaS.Quest's design principle and controlled learning mechanism through which validated disruptions, incidents, errors and unexpected results can increase system organization and robustness.

It combines three distinct ideas:
- **Resilience:** recover and restore acceptable operation.
- **Antifragility:** improve capability or robustness through exposure to bounded stressors.
- **Syntropy:** increase organization and constructive structure.

The combination is a proposed architecture concept. It does not mean all failures are beneficial. Uncontained failure may cause damage; improvement requires a verified learning loop.

### 7.2 Evolution pipeline

1. **Detect:** identify incident, deviation, invariant violation, unexpected outcome or bounded experiment result.
2. **Contain:** stop or isolate unsafe behavior; preserve service and evidence.
3. **Record:** append event, context, version, trace and relevant evidence to the tenant-scoped evidence ledger.
4. **Diagnose:** distinguish root cause, contributing conditions, uncertainty and impact.
5. **Propose:** formulate a structural change to policy, behavior, test, model, configuration or component.
6. **Formalize:** define expected properties, invariants, acceptance metrics and non-regression constraints.
7. **Isolate:** test in sandbox/staging with bounded resources and permissions.
8. **Validate:** run unit, integration, adversarial, regression and relevant formal/conformance tests.
9. **Approve:** obtain human approval according to risk and authority policy.
10. **Activate:** promote using an atomic/version-checked transition (compare-and-swap where applicable).
11. **Observe:** monitor the new version under defined guardrails.
12. **Verify:** compare results against baseline and acceptance criteria; record benefit, neutrality or regression.
13. **Retain or rollback:** keep the prior version recoverable; rollback when safety, quality or outcome guardrails fail.

The previous version remains addressable. A proposed evolution is not active merely because it passed a model's self-evaluation.

### 7.3 Proof of Evolution

A **Proof of Evolution** is an evidence package demonstrating that a change:
- addresses a diagnosed condition;
- passed defined validation;
- was approved by the correct authority;
- was activated with version integrity;
- improved one or more declared measures or reduced risk;
- did not violate protected invariants or guardrails;
- remains traceable and recoverable.

If improvement cannot be demonstrated, classify the change as unverified, neutral or regressive—not as syntropic success.

### 7.4 Bounded chaos and antifragility

Chaos experiments are allowed only within explicitly approved environments and blast-radius limits. Production experiments require a separate authorization and safety case; the default architecture forbids uncontrolled production chaos. Experiments must have:
- hypothesis and expected signal;
- approval and scope;
- isolated/staging target by default;
- time/resource limits;
- abort criteria;
- observed control condition;
- rollback plan and verified recovery;
- evidence collection and post-experiment review.

## 8. Security, trust and privacy

### 8.1 Deployment and isolation

The reference deployment is hybrid:
- dedicated on-premises environment for local control, sovereignty, sensitive systems or low-latency requirements;
- private cloud for controlled elastic capacity, managed infrastructure and regional resilience;
- explicitly approved connections between environments;
- no assumption that public multi-tenant SaaS is the default execution environment.

Tenant isolation applies to identities, storage, encryption keys, database access, queues, telemetry, model context, caches, backups and administrative operations. Dedicated hardware does not eliminate logical isolation or audit requirements.

### 8.2 Identity and authority

- Authentication, authorization and approval are separate decisions.
- Passwordless/passkey mechanisms may authenticate a human; they do not automatically authorize every business action.
- Messaging channels such as WhatsApp are interaction surfaces, not authoritative proof of identity or permission.
- High-impact actions require step-up authentication or an equivalent approved control, explicit transaction binding and auditable approval.
- Service/agent identities use least privilege, scoped credentials, rotation and revocation.
- Delegation is bounded by subject, action, resource, time and risk.

### 8.3 Zero Trust

Every consequential access is evaluated against identity, device/workload context, policy, resource, action, risk and current authorization. Internal network location is not trust. Service-to-service communication should use authenticated and encrypted channels, explicit identities and policy enforcement. Unknown or stale authorization must not silently grant access.

### 8.4 Data minimization and LGPD

OaaS needs business and financial evidence to measure outcomes, but does not necessarily need direct identities of end customers. Data collection should be limited to what the contract and analysis require.

Financial and behavioral data can still identify or re-identify people. Therefore:
- minimize direct identifiers;
- aggregate or pseudonymize analytical datasets when feasible;
- separate operational PII from minimized analytical zones;
- document purpose, legal basis, retention and access;
- control exports, prompts, logs and backups;
- assess re-identification risk and third-party processors;
- support data-subject rights and incident response;
- avoid placing sensitive personal data in model prompts unless necessary and authorized.

Privacy is a design constraint, not a post-processing step.

### 8.5 Audit and evidence ledger

The evidence ledger is tenant-scoped and append-only at the application contract level. Events should include stable IDs, canonical payloads, timestamps, actor/authority, source references, schema/version and cryptographic linkage. Hash chaining can detect modification, but does not alone guarantee authenticity, availability or tamper resistance against privileged infrastructure operators. Signatures, access controls, external checkpoints, backups and independent audit may be required for stronger assurance.

## 9. Autonomy and human governance

Autonomy is risk- and permission-bound, not a binary property. The R0–R5 scale in this architecture is a policy vocabulary; each organization must define permitted actions, controls and escalation at each level.

A useful interpretation:

- **R0 — Observe:** read and summarize; no external state mutation.
- **R1 — Recommend:** prepare proposals; human executes.
- **R2 — Prepare:** stage reversible actions; explicit approval before commit.
- **R3 — Execute bounded:** execute pre-approved low-risk actions with limits and audit.
- **R4 — Adaptive bounded:** adapt within a signed policy envelope, with monitoring and escalation.
- **R5 — Delegated operation:** broader autonomy only for a specific domain, risk case and governance approval; never unrestricted authority.

These levels do not replace capability-based authorization. A level is a ceiling; every action still requires policy evaluation, valid identity, scope and safeguards. Emergency stop, revocation, human override and incident escalation remain available.

## 10. Operational architecture and observability

The system should expose correlated telemetry across intent, behavior, execution, evidence and outcome. Canonical identifiers may include IntentID, BehaviorID, ExecutionID, TrajectoryID, OutcomeID, ProofID and EvidenceID. IDs must be tenant-safe and traceable without leaking sensitive information.

Observability includes:
- service health and SLOs;
- execution latency, errors and resource consumption;
- behavior-level success/failure and retries;
- data freshness and quality;
- model drift, calibration and forecast error;
- evidence completeness and integrity checks;
- approval latency and policy denials;
- outcome progress, acceptance and settlement;
- syntropic change metrics, regression and rollback rates.

Logs and metrics are not automatically evidence of business impact. Their provenance, sampling, retention and integrity must be understood. Traces should propagate correlation identifiers across language/runtime boundaries.

## 11. Reference data and versioning

The architecture separates:
- **Intent/contract records:** immutable versions and amendments;
- **Behavior registry:** semantic definitions, dependencies and implementations;
- **Execution records:** attempts, inputs, outputs, errors and resource bounds;
- **Evidence records:** observations, provenance, quality and linkage;
- **Outcome snapshots:** metric values, baseline, targets and evaluation;
- **Formal proof registry:** specification version, obligation, proof artifact and toolchain;
- **Evolution records:** proposal, test results, approvals, activation and verification;
- **Settlement records:** accepted evidence, calculation and approvals.

Corrections should append a new revision or compensating record rather than erase the history. Retention and deletion obligations must be reconciled with legal requirements; append-only does not mean retaining personal data indefinitely.

## 12. Failure model and recovery

Failure classes include:
- invalid or ambiguous intent;
- contract/schema mismatch;
- authorization failure;
- unavailable or degraded dependency;
- timeout/resource exhaustion;
- data quality or freshness failure;
- model uncertainty/drift;
- evidence integrity failure;
- partial execution;
- external side-effect ambiguity;
- regression after evolution.

Each behavior defines retryability, idempotency, compensation and terminal states. Retries must not duplicate irreversible effects. For external operations, use idempotency keys, reconciliation and explicit unknown-outcome states. If evidence or authorization is unavailable, consequential execution stops or enters a controlled manual path.

## 13. Implementation status and architecture truthfulness

This reference intentionally separates four states:

1. **Specified:** described by this architecture or an ADR.
2. **Implemented:** code exists in the repository.
3. **Validated:** tests or operational checks demonstrate defined behavior.
4. **Formally verified:** a stated property is proven under documented assumptions and connected to the relevant implementation.

A file, test or proof in isolation does not imply production readiness. In particular:
- the language responsibility map is architectural allocation, not a claim that every language runtime is integrated;
- formal proofs cover only their encoded propositions;
- a hash-chain ledger needs operational controls beyond hashing;
- chaos infrastructure is not production-safe merely because a bounded runner exists;
- forecast accuracy and causal attribution require empirical validation on the relevant domain;
- outcome-based pricing requires transparent contract and dispute rules.

Implementation status is tracked in the repository's ADRs, implementation matrix, tests and CI rather than inferred from this narrative.

## 14. Research and validation agenda

The architecture should evolve through measurable research and engineering work:

- SBTA syntax, typing, semantics and composition laws;
- semantic compiler correctness and behavior conformance;
- proof-to-implementation linkage;
- cross-language contract generation and compatibility;
- tenant isolation and adversarial security testing;
- causal measurement designs per outcome category;
- adaptive ensemble evaluation with leakage-resistant benchmarks;
- bounded autonomy and escalation effectiveness;
- evidence ledger integrity, availability and retention;
- syntropic evolution efficacy: improvement rate, regression rate, rollback time and recurrence of incidents;
- economic validation of outcome-based pricing and settlement.

Every empirical claim in a publication should include source, date, method, context and limitations. Architecture proposals should be labeled as proposals, not scientific findings.

## 16. Conclusion

OaaS.Quest treats software and AI as means to deliver measurable organizational outcomes. Its architecture unites contracts, execution, evidence, causal evaluation, governance and settlement in a traceable lifecycle. Polychromatic specialization allows each component to use an appropriate language and runtime while remaining interoperable through explicit contracts. Syntropic Antifragility makes learning from disturbances a controlled engineering process: failures are contained, diagnosed, transformed into proposals, validated, approved, measured and either retained or rolled back.

The central invariant is simple: **an outcome is not accepted because the system says it happened; it is accepted when the contract's evidence and governance requirements support that conclusion.** Likewise, an evolution is not considered an improvement because it was generated or deployed; it is an improvement only when its benefits are verified without violating protected constraints.

---

## 15. Coherence notes and decision-record integrity

The previous ADR-004 numbering collision has been resolved: [Syntropic Antifragility](./ADR-004-syntropic-antifragility.md) retains ADR-004, while the independent [Durable settlement action workflow](./ADR-008-durable-settlement-workflow.md) is now ADR-008. The ADR sequence is unique and all canonical documentation links use the corrected identifier.

The reference lifecycle is intentionally broader than any single implementation workflow. In particular, settlement's persisted queue/lease/CAS semantics are compatible with the outcome lifecycle: acceptance creates a durable action, provider execution is at-least-once, and exactly-once external effects are not claimed unless provider idempotency or reconciliation supports them.

The Syntropic ADR's human approval and controlled promotion are consistent with this reference's evolution pipeline. Formal proofs remain scoped to modeled propositions; a proof-to-runtime correspondence is a separate obligation.

## Repository sources consolidated

This reference consolidates and cross-links the repository's existing source documents:

- [Outcome Measurement and Evidence](./Outcome-Measurement-and-Evidence.md)
- [Security, Trust and Architecture](./Security-Trust-and-Architecture.md)
- [Delivery Operating Model](./Delivery-Operating-Model.md)
- [Commercial Model and Pricing](./Commercial-Model-and-Pricing.md)
- [Implementation Plan](./Implementation-PLAN.md)
- [Atomic Behavior Implementation Matrix](./Atomic-Behavior-Implementation-Matrix.md)
- [ADR-001 — Durable Storage and HTTP Boundary](./ADR-001-durable-storage-and-http-boundary.md)
- [ADR-002 — Tenant-scoped RBAC/ABAC](./ADR-002-tenant-scoped-rbac-abac.md)
- [ADR-003 — Immutable Calculation Snapshots](./ADR-003-immutable-calculation-snapshots.md)
- [ADR-004 — Syntropic Antifragility](./ADR-004-syntropic-antifragility.md)
- [ADR-008 — Durable settlement action workflow](./ADR-008-durable-settlement-workflow.md)
- [ADR-005 — Immutable Intent History](./ADR-005-immutable-intent-history.md)
- [ADR-006 — Customer Outcome Reports](./ADR-006-customer-outcome-reports.md)
- [ADR-007 — SLO, Health and Telemetry](./ADR-007-slo-health-and-telemetry.md)
- [Syntropic Antifragility manifest](./syntropic-antifragility/manifest.md)
- [Syntropic Antifragility behavior flow](./syntropic-antifragility/behavior.2flow)
- [Syntropic implementation boundaries](./syntropic-antifragility/implementation.md)
- [Zig runtime contract](./syntropic-antifragility/runtime-zig-contract.md)
- [Agda Syntropic Antifragility formalization](../formal/agda/OaaS/SyntropicAntifragility.agda)

## Version history

- **v1.5 (unified draft):** consolidates outcome lifecycle, measurement, adaptive prediction, Polychromatic Formal Architecture, SBTA, Syntropic Antifragility, security, privacy, autonomy, observability and implementation-status distinctions into one canonical reference.
- **Earlier working revisions (v1.3/v1.4):** their complete standalone artifacts were not present as separately versioned files in the repository. This v1.5 is a reconstruction and integration from the repository's actual architecture records and established project decisions; it must not be represented as a byte-for-byte merge of missing source documents.
