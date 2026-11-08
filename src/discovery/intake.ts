import type{OutcomeIntent}from "../intent/intent.ts";import{qualifyIntent}from "../intent/intent.ts";export interface Clarification{path:string;question:string;reason:string}export function clarificationFor(i:OutcomeIntent):Clarification[]{const q:Clarification[]=[];if(!i.desiredOutcome.trim())q.push({path:"desiredOutcome",question:"What measurable result should change?",reason:"Outcome is unspecified"});if(!i.scope.length)q.push({path:"scope",question:"Which process, team or customer segment is in scope?",reason:"Scope is missing"});if(!i.deadline)q.push({path:"deadline",question:"By when should this result be achieved?",reason:"Time horizon is missing"});return q}export function routeIntent(i:OutcomeIntent){const qualified=qualifyIntent(i);return{intent:qualified,route:qualified.status==="qualified"?"discovery":"clarification",reasons:qualified.status==="qualified"?[]:["INTENT_INCOMPLETE"] as string[]}}export interface DiscoveryTask{id:string;intentId:string;kind:"interview"|"data_request"|"process_map"|"workshop";ownerId?:string;status:"pending"|"done"|"blocked"}
export function createDiscoveryTasks(intentId: string, tenantId: string, ownerId?: string): DiscoveryTask[] {
  if (!intentId || !tenantId) throw new Error("DISCOVERY_CONTEXT_REQUIRED");
  const kinds: DiscoveryTask["kind"][] = ["interview", "data_request", "process_map", "workshop"];
  return kinds.map((kind) => ({
    id: "task_discovery_" + intentId.replace(/[^a-z0-9]+/gi, "_").toLowerCase() + "_" + kind,
    intentId, kind, ...(ownerId ? { ownerId } : {}), status: "pending",
  }));
}
export function createDiscoveryForQualifiedIntent(i: OutcomeIntent, ownerId?: string): DiscoveryTask[] {
  const routed = routeIntent(i);
  if (routed.route !== "discovery") throw new Error("INTENT_NOT_QUALIFIED");
  return createDiscoveryTasks(i.id, i.tenantId, ownerId);
}
