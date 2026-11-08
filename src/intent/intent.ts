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
  return Object.freeze({ ...intent, scope: [...intent.scope], constraints: [...intent.constraints] });
}

export interface IntentExtractionResult { desiredOutcome?:string; scope?:readonly string[]; constraints?:readonly string[]; deadline?:string; domain?:string; confidence:number; ambiguities:readonly string[] }
export type IntentExtractor=(statement:string,signal?:AbortSignal)=>Promise<IntentExtractionResult>;
export type IntentExtractionOutcome={status:"captured";intent:OutcomeIntent;extraction:IntentExtractionResult}|{status:"needs_clarification";questions:readonly string[];extraction:IntentExtractionResult};
export async function extractIntentFields(input:IntentCaptureInput,extractor:IntentExtractor,minConfidence=0.75,signal?:AbortSignal):Promise<IntentExtractionOutcome>{
 if(!Number.isFinite(minConfidence)||minConfidence<0||minConfidence>1)throw new Error("INTENT_CONFIDENCE_THRESHOLD_INVALID");
 const extracted=await extractor(input.statement,signal);
 if(!Number.isFinite(extracted.confidence)||extracted.confidence<0||extracted.confidence>1)throw new Error("INTENT_EXTRACTION_CONFIDENCE_INVALID");
 const desiredOutcome=input.desiredOutcome.trim()||extracted.desiredOutcome?.trim()||"";
 const scope=input.scope?.length?input.scope:extracted.scope??[];
 const questions:string[]=[];
 if(extracted.confidence<minConfidence)questions.push("Please confirm the interpretation of the requested outcome.");
 if(!desiredOutcome)questions.push("What measurable result should change?");
 if(!scope.length)questions.push("Which process, team or customer segment is in scope?");
 if(!input.deadline&&!extracted.deadline)questions.push("By when should this result be achieved?");
 for(const ambiguity of extracted.ambiguities)questions.push("Clarify: "+ambiguity);
 if(questions.length)return Object.freeze({status:"needs_clarification",questions:Object.freeze([...new Set(questions)]),extraction:extracted});
 const intent=captureIntent({...input,desiredOutcome,scope,constraints:[...(input.constraints??[]),...(extracted.constraints??[])],deadline:input.deadline??extracted.deadline});
 return Object.freeze({status:"captured",intent,extraction:extracted});
}
