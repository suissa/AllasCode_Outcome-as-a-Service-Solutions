/**
 * Declarative lifecycle state machines with fail-closed guards and optimistic revisions.
 * Pure transitions are deterministic; persistence/audit adapters consume LifecycleEvent.
 */
export type Transition<S extends string> = {
  from: S; to: S; action: string; requiresApproval?: boolean;
  guard?: (context: Readonly<Record<string, unknown>>) => boolean;
};
export interface LifecycleDefinition<S extends string> {
  name: string; initial: S; states: readonly S[]; transitions: readonly Transition<S>[];
  terminal?: readonly S[];
}
export interface LifecycleEvent<S extends string> {
  machine: string; entityId: string; tenantId: string; actorId: string;
  action: string; from: S; to: S; revision: number; occurredAt: string;
  correlationId: string; metadata?: Readonly<Record<string, unknown>>;
}
export interface TransitionCommand {
  action: string; approved?: boolean; expectedRevision?: number;
  context?: Readonly<Record<string, unknown>>;
}
export interface TransitionResult<S extends string> { state: S; revision: number; event: LifecycleEvent<S>; }
export class InvalidTransitionError extends Error {
  readonly code = "INVALID_STATE_TRANSITION";
  constructor(readonly from: string, readonly action: string) {
    super(`Transition action "${action}" is not allowed from "${from}".`); this.name = "InvalidTransitionError";
  }
}
export class LifecycleApprovalRequiredError extends Error {
  readonly code = "LIFECYCLE_APPROVAL_REQUIRED";
  constructor(readonly from: string, readonly action: string) {
    super(`Action "${action}" requires explicit approval.`); this.name = "LifecycleApprovalRequiredError";
  }
}
export class LifecycleGuardRejectedError extends Error {
  readonly code = "LIFECYCLE_GUARD_REJECTED";
  constructor(readonly from: string, readonly action: string) {
    super(`Lifecycle guard rejected action "${action}" from "${from}".`); this.name = "LifecycleGuardRejectedError";
  }
}
export class LifecycleRevisionConflictError extends Error {
  readonly code = "LIFECYCLE_REVISION_CONFLICT";
  constructor(readonly expected: number, readonly actual: number) {
    super(`Lifecycle revision conflict: expected ${expected}, actual ${actual}.`); this.name = "LifecycleRevisionConflictError";
  }
}
export function assertLifecycleDefinition<S extends string>(definition: LifecycleDefinition<S>): void {
  if (!definition.name.trim() || definition.states.length === 0 || !definition.states.includes(definition.initial) ||
      new Set(definition.states).size !== definition.states.length) throw new Error("LIFECYCLE_DEFINITION_INVALID");
  const states = new Set(definition.states), keys = new Set<string>();
  for (const edge of definition.transitions) {
    if (!states.has(edge.from) || !states.has(edge.to) || !edge.action.trim() || edge.from === edge.to)
      throw new Error("LIFECYCLE_TRANSITION_DEFINITION_INVALID");
    const key = edge.from + "\0" + edge.action;
    if (keys.has(key)) throw new Error("LIFECYCLE_TRANSITION_AMBIGUOUS");
    keys.add(key);
  }
  for (const state of definition.terminal ?? []) if (!states.has(state) || definition.transitions.some(edge => edge.from === state))
    throw new Error("LIFECYCLE_TERMINAL_STATE_INVALID");
}
/** Backwards-compatible helper: returns only the target state. */
export function transition<S extends string>(current: S, action: string, table: readonly Transition<S>[], approved = false): S {
  const edge = table.find(item => item.from === current && item.action === action);
  if (!edge) throw new InvalidTransitionError(current, action);
  if (edge.requiresApproval && !approved) throw new LifecycleApprovalRequiredError(current, action);
  if (edge.guard && !edge.guard(Object.freeze({}))) throw new LifecycleGuardRejectedError(current, action);
  return edge.to;
}
/** Checked transition: legal edge, approval, contextual guard and optimistic revision. */
export function transitionLifecycle<S extends string>(
  definition: LifecycleDefinition<S>, current: S, revision: number, command: TransitionCommand,
  identity: { entityId: string; tenantId: string; actorId: string; correlationId: string }, now = new Date(),
): TransitionResult<S> {
  assertLifecycleDefinition(definition);
  if (!Number.isSafeInteger(revision) || revision < 0) throw new Error("LIFECYCLE_REVISION_INVALID");
  if (command.expectedRevision !== undefined && command.expectedRevision !== revision)
    throw new LifecycleRevisionConflictError(command.expectedRevision, revision);
  if (!definition.states.includes(current)) throw new Error("LIFECYCLE_STATE_UNKNOWN");
  const edge = definition.transitions.find(item => item.from === current && item.action === command.action);
  if (!edge) throw new InvalidTransitionError(current, command.action);
  if (edge.requiresApproval && command.approved !== true) throw new LifecycleApprovalRequiredError(current, command.action);
  if (edge.guard && !edge.guard(Object.freeze({ ...(command.context ?? {}) })))
    throw new LifecycleGuardRejectedError(current, command.action);
  for (const [key, value] of Object.entries(identity)) if (!value.trim()) throw new Error("LIFECYCLE_IDENTITY_REQUIRED:" + key);
  const nextRevision = revision + 1;
  const event: LifecycleEvent<S> = Object.freeze({ machine: definition.name, ...identity, action: command.action,
    from: current, to: edge.to, revision: nextRevision, occurredAt: now.toISOString() });
  return Object.freeze({ state: edge.to, revision: nextRevision, event });
}
