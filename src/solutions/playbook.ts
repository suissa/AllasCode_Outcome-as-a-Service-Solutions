export interface Playbook{id:string;version:number;name:string;steps:{behaviorId:string;inputSchema:string;outputSchema:string;approvalRequired:boolean}[];evidenceBasis:string[];verifiedAt?:string;verifiedBy?:string}export function verifyPlaybook(p:Playbook,actor:string,at=new Date()):Playbook{if(!p.steps.length||!p.evidenceBasis.length)throw new Error("PLAYBOOK_EVIDENCE_REQUIRED");if(!actor)throw new Error("PLAYBOOK_VERIFIER_REQUIRED");return Object.freeze({...p,verifiedAt:at.toISOString(),verifiedBy:actor})}
export function validatePlaybook(p:Playbook):string[]{
 const errors:string[]=[];if(!p.id||!p.name.trim())errors.push("PLAYBOOK_IDENTITY_REQUIRED");if(!Number.isInteger(p.version)||p.version<1)errors.push("PLAYBOOK_VERSION_INVALID");if(!p.steps.length)errors.push("PLAYBOOK_STEPS_REQUIRED");if(!p.evidenceBasis.length)errors.push("PLAYBOOK_EVIDENCE_REQUIRED");
 const ids=new Set<string>();for(const step of p.steps){if(!step.behaviorId||ids.has(step.behaviorId))errors.push("PLAYBOOK_BEHAVIOR_INVALID");ids.add(step.behaviorId);if(!step.inputSchema||!step.outputSchema)errors.push("PLAYBOOK_SCHEMA_REQUIRED");}
 return [...new Set(errors)];
}
export type EvidenceVerifier=(evidenceId:string)=>boolean|Promise<boolean>;
export async function improvePlaybookFromEvidence(current:Playbook,steps:Playbook["steps"],evidenceIds:readonly string[],actor:string,verify:EvidenceVerifier,at=new Date()):Promise<Playbook>{
 if(!actor||!steps.length||!evidenceIds.length)throw new Error("PLAYBOOK_IMPROVEMENT_INVALID");
 for(const id of evidenceIds)if(!(await verify(id)))throw new Error("PLAYBOOK_EVIDENCE_UNVERIFIED:"+id);
 const next:Playbook={id:current.id,version:current.version+1,name:current.name,steps:[...steps],evidenceBasis:[...new Set([...current.evidenceBasis,...evidenceIds])]};
 const errors=validatePlaybook(next);if(errors.length)throw new Error("PLAYBOOK_INVALID:"+errors.join(","));
 return Object.freeze({...next,verifiedAt:at.toISOString(),verifiedBy:actor});
}
export class PlaybookRegistry{
 private readonly versions=new Map<string,Playbook[]>();
 register(p:Playbook):Playbook{
  if(this.versions.has(p.id))throw new Error("PLAYBOOK_ALREADY_REGISTERED");
  if(!p.verifiedBy||!p.verifiedAt||validatePlaybook(p).length)throw new Error("PLAYBOOK_NOT_VERIFIED");
  const saved=Object.freeze({...p,steps:[...p.steps],evidenceBasis:[...p.evidenceBasis]});this.versions.set(p.id,[saved]);return saved;
 }
 publish(p:Playbook):Playbook{
  const history=this.versions.get(p.id);if(!history)throw new Error("PLAYBOOK_NOT_FOUND");
  if(p.version!==history[history.length-1]!.version+1)throw new Error("PLAYBOOK_VERSION_CONFLICT");
  if(!p.verifiedBy||!p.verifiedAt||validatePlaybook(p).length)throw new Error("PLAYBOOK_NOT_VERIFIED");
  const saved=Object.freeze({...p,steps:[...p.steps],evidenceBasis:[...p.evidenceBasis]});this.versions.set(p.id,[...history,saved]);return saved;
 }
 current(id:string):Playbook{const history=this.versions.get(id);if(!history)throw new Error("PLAYBOOK_NOT_FOUND");return history[history.length-1]!}
 history(id:string):readonly Playbook[]{return Object.freeze([...(this.versions.get(id)??[])])}
}
