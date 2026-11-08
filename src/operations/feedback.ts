export interface Incident{id:string;tenantId:string;severity:"sev1"|"sev2"|"sev3"|"sev4";summary:string;occurredAt:string;status:"open"|"investigating"|"mitigated"|"resolved";lessons:string[]}export interface Feedback{id:string;tenantId:string;subjectId:string;rating:number;comment?:string;submittedAt:string}export function validateFeedback(f:Feedback):void{if(f.rating<1||f.rating>5||!Number.isInteger(f.rating))throw new Error("FEEDBACK_RATING_INVALID")}export function resolveIncident(i:Incident,lesson:string):Incident{if(i.status==="resolved")throw new Error("INCIDENT_ALREADY_RESOLVED");if(!lesson.trim())throw new Error("INCIDENT_LESSON_REQUIRED");return Object.freeze({...i,status:"resolved",lessons:[...i.lessons,lesson]})}
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
