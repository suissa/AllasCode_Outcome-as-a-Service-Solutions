# ADR-004 — Syntropic Antifragility

- **Status:** Accepted for the experimental reference implementation
- **Date:** 2026-11-10
- **Context:** Incident recovery is insufficient to establish antifragility. The platform must distinguish recovery, resilience and verified structural improvement.
- **Decision:** Treat Syntropic Antifragility as a governed learning loop. Disruptions create evidence and proposals, never direct production authority. Promotion requires verified evidence, reviewed cause, tests, applicable formal proofs, policy approval, bounded blast radius, verified rollback and risk-based human approval. Post-change metrics must show at least one improvement and no guardrail regression before learning is labelled syntropic.
- **Consequences:** Introduces a deterministic TypeScript reference gate and Agda proof obligations. Agda proves only modeled propositions; equivalence to generated/compiled runtime artifacts remains a separate verification obligation. Production release remains delegated to release governance.
- **Alternatives rejected:** automatic self-modification after any incident; recovery-only definition; global cross-tenant learning by default.
- **Follow-up:** durable append-only event persistence, proof artifact registry, chaos experiment runner and Zig conformance adapter.
