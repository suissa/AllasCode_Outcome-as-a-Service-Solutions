# Implementation notes

Implemented by `src/ai/evaluation-governance.ts`.

- `createModelEvaluationSnapshot` validates metadata, categories, unique case IDs, normalized scores and timestamps, then creates a canonical SHA-256 digest.
- `compareModelEvaluationSnapshots` verifies both digests and requires same tenant, model and dataset version plus configurable sample coverage.
- It calculates overall and category score deltas and reports new failures, recovered cases and safety regressions independently.
- Critical safety failures block release even if aggregate quality scores remain stable.
- Raw prompts and generated model output are deliberately excluded; snapshots contain evaluation metadata and issue codes only.
- Model execution, evaluator adapters, dataset curation and release enforcement remain external integration responsibilities.
