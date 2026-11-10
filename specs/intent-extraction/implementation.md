# Implementation notes

The IntentExtractor is a provider-neutral async port. The adapter is responsible for provider authentication, model selection, timeout and provider-side data handling. The domain function validates the returned structure before using it.

Confidence must be finite and in [0,1]. Optional text is trimmed; list values are validated, trimmed and deduplicated; blank list items reject. A supplied deadline must be parseable. Invalid shape or confidence fails closed. Low confidence, missing desired outcome/scope/deadline or ambiguity produces explicit clarification questions and does not create an intent.

The returned extraction and its arrays are frozen. No inferred value is treated as a guaranteed fact; the caller must retain provider/model/prompt metadata separately when auditability is required.
