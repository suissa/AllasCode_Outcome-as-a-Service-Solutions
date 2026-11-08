export type IntentStatus="draft"|"needs_clarification"|"qualified"|"rejected"|"discovery";export interface OutcomeIntent {id:string;tenantId:string;actorId:string;statement:string;desiredOutcome:string;scope:string[];constraints:string[];deadline?:string;status:IntentStatus;version:number;provenance:IntentProvenance;createdAt:string}export interface IntentProvenance{channel:"web"|"api"|"conversation"|"import";sourceId:string;capturedAt:string;rawHash?:string}export function validateIntent(i:OutcomeIntent):string[]{const e:string[]=[];if(!i.statement.trim())e.push("statement:REQUIRED");if(!i.desiredOutcome.trim())e.push("desiredOutcome:REQUIRED");if(!i.tenantId)e.push("tenantId:REQUIRED");if(!i.actorId)e.push("actorId:REQUIRED");if(i.version<1||!Number.isInteger(i.version))e.push("version:INVALID");if(i.deadline&&Number.isNaN(Date.parse(i.deadline)))e.push("deadline:INVALID");return e}export function qualifyIntent(i:OutcomeIntent):OutcomeIntent{const errors=validateIntent(i);return Object.freeze({...i,status:errors.length?"needs_clarification":"qualified"})}
export interface IntentCaptureInput {
  id: string; tenantId: string; actorId: string; statement: string; desiredOutcome: string;
  scope?: readonly string[]; constraints?: readonly string[]; deadline?: string;
  channel: IntentProvenance["channel"]; sourceId: string; capturedAt: string; createdAt: string;
}
export function normalizeIntentEnvelope(input: IntentCaptureInput): IntentCaptureInput {
  const clean = (values: readonly string[] | undefined) => [...new Set((values ?? []).map((v) => v.trim()).filter(Boolean))];
  return Object.freeze({ ...input, statement: input.statement.trim(), desiredOutcome: input.desiredOutcome.trim(),
    scope: Object.freeze(clean(input.scope)), constraints: Object.freeze(clean(input.constraints)),
    sourceId: input.sourceId.trim() });
}
export function captureIntent(input: IntentCaptureInput): OutcomeIntent {
  const normalized = normalizeIntentEnvelope(input);
  const intent: OutcomeIntent = {
    id: normalized.id, tenantId: normalized.tenantId, actorId: normalized.actorId,
    statement: normalized.statement, desiredOutcome: normalized.desiredOutcome,
    scope: [...(normalized.scope ?? [])], constraints: [...(normalized.constraints ?? [])],
    ...(normalized.deadline ? { deadline: normalized.deadline } : {}),
    status: "draft", version: 1,
    provenance: { channel: normalized.channel, sourceId: normalized.sourceId, capturedAt: normalized.capturedAt },
    createdAt: normalized.createdAt,
  };
  const errors = validateIntent(intent);
  if (errors.length) throw new Error("INTENT_INVALID:" + errors.join(","));
  if (!intent.provenance.sourceId || Number.isNaN(Date.parse(intent.provenance.capturedAt)) || Number.isNaN(Date.parse(intent.createdAt)))
    throw new Error("INTENT_PROVENANCE_INVALID");
  return Object.freeze({ ...intent, scope: Object.freeze([...intent.scope]), constraints: Object.freeze([...intent.constraints]) });
}
