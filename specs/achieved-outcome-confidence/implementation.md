# Implementation

Implemented by `src/measurement/achieved-outcome.ts`, exported from `src/index.ts`.

- Arithmetic mean and unbiased sample variance (n−1 denominator).
- Student-t critical values for 90% and 95% confidence, normal approximation for other confidence levels.
- Two-sided confidence interval; n=1 returns [mean, mean].
- Target progress is directional: (observed−baseline)/(target−baseline), supporting increasing and decreasing goals. Equal baseline/target yields 1 only when observed equals target, otherwise 0.
- Pure calculation, frozen result, no mutation or side effects; stable error code and field path.
- Tests cover valid, boundary, malformed, empty, over-limit, overflow, directionality and determinism.
