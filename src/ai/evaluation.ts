export interface EvaluationCase{id:string;input:unknown;expected:unknown;tags:string[]}
export interface EvaluationResult{caseId:string;tags:readonly string[];passed:boolean;score:number;issues:string[];modelVersion:string;promptVersion:string;evaluatedAt:string}
export interface EvaluationRun{id:string;modelVersion:string;promptVersion:string;results:readonly EvaluationResult[];passRate:number;safetyPassRate:number;evaluatedAt:string}
export interface EvaluationDrift{regressed:boolean;passRateDelta:number;safetyRegressions:readonly string[];newFailures:readonly string[];recoveredCases:readonly string[]}
function canonical(value:unknown):unknown{if(Array.isArray(value))return value.map(canonical);if(value&&typeof value==="object")return Object.fromEntries(Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,canonical(v)]));return value}
export function evaluateExact(c:EvaluationCase,actual:unknown,modelVersion:string,promptVersion:string,at=new Date()):EvaluationResult{
 if(!c.id||!modelVersion||!promptVersion)throw new Error("EVALUATION_METADATA_REQUIRED");
 const passed=JSON.stringify(canonical(c.expected))===JSON.stringify(canonical(actual));
 return Object.freeze({caseId:c.id,tags:Object.freeze([...c.tags]),passed,score:passed?1:0,issues:passed?[]:["OUTPUT_MISMATCH"],modelVersion,promptVersion,evaluatedAt:at.toISOString()});
}
export function evaluateSuite(id:string,cases:readonly EvaluationCase[],actuals:ReadonlyMap<string,unknown>,modelVersion:string,promptVersion:string,at=new Date()):EvaluationRun{
 if(!id||!cases.length||new Set(cases.map(c=>c.id)).size!==cases.length)throw new Error("EVALUATION_SUITE_INVALID");
 const results=cases.map(c=>evaluateExact(c,actuals.get(c.id),modelVersion,promptVersion,at));
 const passed=results.filter(r=>r.passed).length;const safety=results.filter(r=>r.tags.includes("safety"));
 const safetyPassRate=safety.length?safety.filter(r=>r.passed).length/safety.length:1;
 return Object.freeze({id,modelVersion,promptVersion,results:Object.freeze(results),passRate:passed/results.length,safetyPassRate,evaluatedAt:at.toISOString()});
}
export function compareEvaluationRuns(baseline:EvaluationRun,current:EvaluationRun,maxPassRateRegression=.02):EvaluationDrift{
 if(!Number.isFinite(maxPassRateRegression)||maxPassRateRegression<0||maxPassRateRegression>1)throw new Error("EVALUATION_REGRESSION_THRESHOLD_INVALID");
 const old=new Map(baseline.results.map(r=>[r.caseId,r.passed]));const next=new Map(current.results.map(r=>[r.caseId,r.passed]));
 const safetyRegressions=current.results.filter(r=>r.tags.includes("safety")&&old.get(r.caseId)===true&&!r.passed).map(r=>r.caseId);
 const newFailures=[...next].filter(([id,passed])=>!passed&&!old.has(id)).map(([id])=>id);
 const recoveredCases=[...next].filter(([id,passed])=>passed&&old.get(id)===false).map(([id])=>id);
 const passRateDelta=current.passRate-baseline.passRate;
 const safetyDrop=current.safetyPassRate<baseline.safetyPassRate;
 return Object.freeze({regressed:passRateDelta< -maxPassRateRegression||safetyDrop||safetyRegressions.length>0,passRateDelta,safetyRegressions:Object.freeze(safetyRegressions),newFailures:Object.freeze(newFailures),recoveredCases:Object.freeze(recoveredCases)});
}
