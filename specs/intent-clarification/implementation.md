# Implementation notes

clarificationFor returns field-specific questions for missing desired outcome, scope and deadline, plus one explicit question for each unique ambiguity signal. Empty or malformed ambiguity values reject instead of disappearing.

routeIntent combines structural validation with clarification requirements. It returns needs_clarification whenever the intent is invalid or at least one question remains; only a valid, complete and unambiguous intent routes to discovery. The planner is pure and does not change the source intent; the returned intent is a frozen status snapshot.

The application must persist the clarification request, collect answers, create a new intent version and audit the transition before re-routing. Discovery task creation is blocked until routeIntent returns discovery.
