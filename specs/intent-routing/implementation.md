# Implementation notes

routeIntent combines intent validation, explicit clarification requirements and an optional QualificationRule. It returns one of three outcomes: discovery only when all gates pass; clarification when required information or ambiguity remains; rejected for malformed identity/structure or disallowed qualification constraints.

Reasons are stable machine-readable codes. Explanations are deterministic and avoid echoing arbitrary user payloads. The route decision is pure; callers persist it with the rule version and correlation ID, then audit before triggering any downstream workflow.

createDiscoveryForQualifiedIntent re-evaluates the intent and refuses task creation unless the route is discovery.
