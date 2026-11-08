import { createHash } from "node:crypto";
import type{OutcomeResult}from "../outcomes/settlement.ts";
export interface CalculationSnapshot{id:string;outcomeId:string;specVersion:number;methodVersion:string;inputEvidenceHashes:string[];result:OutcomeResult;calculatedAt:string}
export function createCalculationSnapshot(s:Omit<CalculationSnapshot,"calculatedAt">,at=new Date()):CalculationSnapshot{
 if(!s.id||!s.outcomeId||!Number.isInteger(s.specVersion)||s.specVersion<1||!s.methodVersion.trim())throw new Error("SNAPSHOT_METADATA_INVALID");
 if(!s.inputEvidenceHashes.length||s.inputEvidenceHashes.some(h=>!/^([a-f0-9]{64}|sha256:[a-f0-9]{64})$/i.test(h))||new Set(s.inputEvidenceHashes).size!==s.inputEvidenceHashes.length)throw new Error("SNAPSHOT_EVIDENCE_REQUIRED");
 if(![s.result.baseline,s.result.target,s.result.observed,s.result.absoluteChange,s.result.targetProgress,s.result.confidence].every(Number.isFinite)||s.result.confidence<0||s.result.confidence>1)throw new Error("SNAPSHOT_RESULT_INVALID");
 return Object.freeze({...s,inputEvidenceHashes:[...s.inputEvidenceHashes],calculatedAt:at.toISOString()});
}
function canonical(value:unknown):unknown{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>[key,canonical(item)]));
 return value;
}
export function snapshotFingerprint(s:CalculationSnapshot):string{
 const payload={id:s.id,outcomeId:s.outcomeId,specVersion:s.specVersion,methodVersion:s.methodVersion,inputEvidenceHashes:[...s.inputEvidenceHashes].sort(),result:s.result};
 return createHash("sha256").update(JSON.stringify(canonical(payload)),"utf8").digest("hex");
}
