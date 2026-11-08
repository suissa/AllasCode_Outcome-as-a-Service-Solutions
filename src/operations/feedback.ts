export interface Incident{id:string;tenantId:string;severity:"sev1"|"sev2"|"sev3"|"sev4";summary:string;occurredAt:string;status:"open"|"investigating"|"mitigated"|"resolved";lessons:string[];lessonEvidence?:readonly string[]}export interface Feedback{id:string;tenantId:string;subjectId:string;rating:number;comment?:string;submittedAt:string}export function validateFeedback(f:Feedback):void{if(f.rating<1||f.rating>5||!Number.isInteger(f.rating))throw new Error("FEEDBACK_RATING_INVALID")}export function resolveIncident(i:Incident,lesson:string):Incident{if(!lesson.trim())throw new Error("INCIDENT_LESSON_REQUIRED");const transitioned=transitionIncident(i,"resolved");return Object.freeze({...transitioned,lessons:[...i.lessons,lesson]})}
export function transitionIncident(i: Incident, to: Incident["status"]): Incident {
  const allowed: Record<Incident["status"], Incident["status"][]> = {
    open:["investigating","mitigated"], investigating:["mitigated","resolved"], mitigated:["investigating","resolved"], resolved:[],
  };
  if (!allowed[i.status].includes(to)) throw new Error("INCIDENT_TRANSITION_INVALID");
  return Object.freeze({ ...i, status:to });
}
export function submitFeedback(f: Feedback): Feedback {
  validateFeedback(f);
  if (!f.id || !f.tenantId || !f.subjectId || Number.isNaN(Date.parse(f.submittedAt))) throw new Error("FEEDBACK_ENVELOPE_INVALID");
  return Object.freeze({ ...f });
}

export async function recordIncidentLesson(i:Incident,summary:string,evidenceIds:readonly string[],verify:(id:string)=>boolean|Promise<boolean>):Promise<Incident>{
 if(i.status!=="resolved")throw new Error("INCIDENT_NOT_RESOLVED");
 if(!summary.trim()||!evidenceIds.length)throw new Error("INCIDENT_LESSON_EVIDENCE_REQUIRED");
 for(const id of evidenceIds)if(!(await verify(id)))throw new Error("INCIDENT_LESSON_EVIDENCE_UNVERIFIED:"+id);
 return Object.freeze({...i,lessons:[...i.lessons,summary],lessonEvidence:Object.freeze([...new Set([...(i.lessonEvidence??[]),...evidenceIds])])});
}
export function validateIncident(i:Incident):string[]{
 const errors:string[]=[];if(!i.id||!i.tenantId||!i.summary.trim())errors.push("INCIDENT_ENVELOPE_INVALID");if(Number.isNaN(Date.parse(i.occurredAt)))errors.push("INCIDENT_TIMESTAMP_INVALID");if(!["sev1","sev2","sev3","sev4"].includes(i.severity))errors.push("INCIDENT_SEVERITY_INVALID");return errors;
}
