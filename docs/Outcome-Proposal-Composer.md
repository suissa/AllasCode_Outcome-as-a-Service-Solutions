# Outcome Proposal Composer

## Purpose

The proposal composer turns a structured business diagnosis into an inspectable commercial proposal draft. It does not infer missing facts, certify evidence, approve a baseline, sign an agreement, or guarantee an outcome.

## Flow

1. Capture the customer context, problem and desired outcome.
2. Attach evidence references with source and verification state.
3. Describe the primary metric, baseline, target, population, period, source of truth, attribution, exclusions and guardrails.
4. Select a solution scenario with explicit assumptions, confidence, estimated benefit/cost ranges and risks.
5. Define scope, deliverables, exclusions, dependencies, responsibilities and acceptance criteria.
6. Add pricing lines using the existing pricing engine.
7. Review readiness blockers and warnings before sending the draft for human review.

## API

- `assessProposalReadiness(input)` returns blocking conditions and non-blocking warnings.
- `composeOutcomeProposal(input, generatedAt?)` returns an immutable draft and an indicative pricing summary when the supplied pricing lines are valid.

A proposal is `ready_for_review` only when the required metric and commercial details are present. This is not customer acceptance, contract activation or authorization to execute.

## Evidence and outcome rules

A proposal must not treat an estimate as measured value. Evidence references explicitly distinguish verified from pending. A baseline is required, as are a target, measurement population, measurement period, source of truth, attribution method and guardrails. Attribution marked as pending blocks review readiness. The composer does not independently verify evidence or calculate causal impact.

Scenario benefit and cost ranges remain estimates, with assumptions and risks retained in the proposal. They must not be presented as guaranteed savings or revenue.

## Commercial rules

Pricing lines are validated by the existing pricing engine. The composer does not invent rates, quantities, eligible values, taxes or currency conversions. Mixed currencies and malformed price lines block readiness. Fixed, usage, milestone, outcome, gain-share, revenue-share, bonus and SLA-credit models remain supported by the underlying pricing module.

## 90-day cycle

A delivery window up to 90 days can be stated when supported by the project plan. A longer window is allowed but produces a warning that the first delivery cycle exceeds 90 days. The platform should frame this as a target for a first measurable improvement when feasible, not a guarantee that every transformation completes in 90 days.

## Boundaries

The output is a draft for review. Human approval remains necessary for scope, baseline, target, attribution, pricing, data access, regulated-sector constraints and contractual language. The existing agreement and contract composers remain responsible for subsequent agreement and contract-draft creation.
