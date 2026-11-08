import type{OutcomeResult}from "../outcomes/settlement.ts";
import type { EvidenceRecord, EvidenceAccessContext } from "../evidence/evidence.ts";
import { verifyEvidenceAccess } from "../evidence/evidence.ts";export interface OutcomeReport{id:string;tenantId:string;outcomeId:string;generatedAt:string;result:OutcomeResult;evidenceIds:string[];methodology:string;limitations:string[];evidenceLinks?:readonly {evidenceId:string;url:string;expiresAt:string}[]}export function buildOutcomeReport(input:Omit<OutcomeReport,"generatedAt">,now=new Date()):OutcomeReport{if(!input.evidenceIds.length)throw new Error("REPORT_EVIDENCE_REQUIRED");if(!input.methodology.trim())throw new Error("REPORT_METHOD_REQUIRED");return Object.freeze({...input,generatedAt:now.toISOString(),evidenceIds:[...input.evidenceIds]})}
export type EvidenceLinkSigner=(evidence:EvidenceRecord,expiresAt:string)=>Promise<string>;
export async function buildOutcomeReportWithLinks(input:Omit<OutcomeReport,"generatedAt"|"evidenceLinks">,evidence:readonly EvidenceRecord[],access:EvidenceAccessContext,sign:EvidenceLinkSigner,now=new Date()):Promise<OutcomeReport>{
 if(input.tenantId!==access.tenantId)throw new Error("REPORT_TENANT_MISMATCH");
 const byId=new Map(evidence.map(item=>[item.id,item]));
 const links:{evidenceId:string;url:string;expiresAt:string}[]=[];
 for(const id of input.evidenceIds){
  const item=byId.get(id);if(!item||item.tenantId!==input.tenantId)throw new Error("REPORT_EVIDENCE_NOT_FOUND");
  const accessErrors=verifyEvidenceAccess(item,access,now);if(accessErrors.length)throw new Error("REPORT_EVIDENCE_ACCESS_DENIED:"+accessErrors.join(","));
  const expiresAt=new Date(now.getTime()+15*60*1000).toISOString();const rawUrl=await sign(item,expiresAt);
  let parsed:URL;try{parsed=new URL(rawUrl)}catch{throw new Error("REPORT_EVIDENCE_LINK_INVALID")}
  if(parsed.protocol!=="https:"||parsed.username||parsed.password)throw new Error("REPORT_EVIDENCE_LINK_INVALID");
  links.push({evidenceId:id,url:parsed.toString(),expiresAt});
 }
 return Object.freeze({...buildOutcomeReport(input,now),evidenceLinks:Object.freeze(links)});
}
