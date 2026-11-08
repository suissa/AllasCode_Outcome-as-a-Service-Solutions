export type ActorKind = "human" | "ai" | "service";
export type TaskRisk = "low" | "medium" | "high";
export interface TaskDefinition {
  id: string; tenantId: string; title: string; dependencies: readonly string[];
  actorKind: ActorKind; actorId?: string; risk: TaskRisk; approvalRequired: boolean;
  inputSchema: string; outputSchema: string; idempotencyKey: string;
}
export interface TaskGraphIssue { code: string; taskId?: string; dependencyId?: string }
export function validateTaskGraph(tasks: readonly TaskDefinition[], tenantId: string): TaskGraphIssue[] {
  const issues: TaskGraphIssue[] = []; const byId = new Map<string, TaskDefinition>();
  for (const task of tasks) {
    if (byId.has(task.id)) issues.push({ code: "TASK_ID_DUPLICATE", taskId: task.id });
    byId.set(task.id, task);
    if (task.tenantId !== tenantId) issues.push({ code: "TASK_TENANT_MISMATCH", taskId: task.id });
    if (!task.title.trim() || !task.inputSchema || !task.outputSchema || !task.idempotencyKey) issues.push({ code: "TASK_CONTRACT_INCOMPLETE", taskId: task.id });
    if (task.dependencies.includes(task.id)) issues.push({ code: "TASK_SELF_DEPENDENCY", taskId: task.id });
    if (task.actorKind !== "service" && !task.actorId) issues.push({ code: "TASK_ACTOR_REQUIRED", taskId: task.id });
    if (task.risk === "high" && !task.approvalRequired) issues.push({ code: "HIGH_RISK_APPROVAL_REQUIRED", taskId: task.id });
  }
  for (const task of tasks) for (const dependencyId of task.dependencies) {
    const dependency = byId.get(dependencyId);
    if (!dependency) issues.push({ code: "TASK_DEPENDENCY_UNKNOWN", taskId: task.id, dependencyId });
    else if (dependency.tenantId !== task.tenantId) issues.push({ code: "TASK_DEPENDENCY_TENANT_MISMATCH", taskId: task.id, dependencyId });
  }
  if (issues.length) return issues;
  try { executionWaves(tasks); } catch { issues.push({ code: "TASK_GRAPH_CYCLE" }); }
  return issues;
}
export function executionWaves(tasks: readonly TaskDefinition[]): readonly (readonly string[])[] {
  const remaining = new Map(tasks.map((task) => [task.id, new Set(task.dependencies)]));
  const waves: string[][] = []; const completed = new Set<string>();
  while (remaining.size) {
    const wave = [...remaining.entries()].filter(([, deps]) => [...deps].every((id) => completed.has(id))).map(([id]) => id).sort();
    if (!wave.length) throw new Error("TASK_GRAPH_CYCLE");
    waves.push(wave);
    for (const id of wave) { completed.add(id); remaining.delete(id); }
  }
  return Object.freeze(waves.map((wave) => Object.freeze(wave)));
}
export interface TaskRuntimeState { status: "draft"|"approved"|"running"|"paused"|"completed"|"failed"|"cancelled"; version: number; replayCount: number }
export function transitionExecution(state: TaskRuntimeState, action: "approve"|"start"|"pause"|"resume"|"complete"|"fail"|"cancel"|"replay"): TaskRuntimeState {
  const allowed: Record<typeof action, TaskRuntimeState["status"][]> = {
    approve: ["draft"], start: ["approved"], pause: ["running"], resume: ["paused"],
    complete: ["running"], fail: ["running"], cancel: ["draft","approved","running","paused","failed"],
    replay: ["failed","cancelled"],
  };
  if (!allowed[action].includes(state.status)) throw new Error("EXECUTION_TRANSITION_INVALID");
  const status: TaskRuntimeState["status"] = action === "approve" ? "approved" : action === "start" || action === "resume" || action === "replay" ? "running" : action === "pause" ? "paused" : action === "complete" ? "completed" : action === "fail" ? "failed" : "cancelled";
  return Object.freeze({ status, version: state.version + 1, replayCount: state.replayCount + (action === "replay" ? 1 : 0) });
}
export function canDispatchTask(task: TaskDefinition, completedTaskIds: ReadonlySet<string>, approvalGranted: boolean): boolean {
  return task.dependencies.every((id) => completedTaskIds.has(id)) && (!task.approvalRequired || approvalGranted);
}
