export interface Capability{id:string;version:number;name:string;description:string;causes:string[];outcomes:string[];dependencies:string[];risk:"low"|"medium"|"high";cost:{currency:string;min:number;max:number};evidenceIds:string[]}export interface Scenario{id:string;assumptions:Record<string,number>;estimatedBenefit:{min:number;max:number};estimatedCost:{min:number;max:number};risks:string[];confidence:number}export function compareScenarios(a:Scenario,b:Scenario):number{const score=(s:Scenario)=>s.confidence*(s.estimatedBenefit.min-s.estimatedCost.max);return score(b)-score(a)}export function validateCapability(c:Capability):string[]{const e:string[]=[];if(!c.id||!c.name)e.push("identity:REQUIRED");if(c.version<1)e.push("version:INVALID");if(c.cost.min<0||c.cost.max<c.cost.min)e.push("cost:INVALID_RANGE");return e}
export interface ScenarioAssumption { name:string; value:number; minimum:number; maximum:number; benefitPerUnit:number; costPerUnit:number }
export interface ScenarioSensitivity { assumption:string; netBenefitAtMinimum:number; netBenefitAtMaximum:number; impact:number }
export interface ScenarioSimulationInput {
 id:string; assumptions:readonly ScenarioAssumption[]; baseBenefit:number; baseCost:number;
 confidence:number; risks:readonly string[];
}
export interface SimulatedScenario extends Scenario { sensitivity:readonly ScenarioSensitivity[]; expectedNetBenefit:number }
export function simulateScenario(input:ScenarioSimulationInput):SimulatedScenario {
 if(!input.id||!Number.isFinite(input.baseBenefit)||!Number.isFinite(input.baseCost)||input.baseBenefit<0||input.baseCost<0||input.confidence<0||input.confidence>1)throw new Error("SCENARIO_INPUT_INVALID");
 const names=new Set<string>();for(const a of input.assumptions){if(!a.name||names.has(a.name)||![a.value,a.minimum,a.maximum,a.benefitPerUnit,a.costPerUnit].every(Number.isFinite)||a.minimum>a.value||a.value>a.maximum)throw new Error("SCENARIO_ASSUMPTION_INVALID");names.add(a.name);}
 const range=(field:"benefitPerUnit"|"costPerUnit",base:number)=>input.assumptions.reduce((r,a)=>{
  const low=(a.minimum-a.value)*a[field],high=(a.maximum-a.value)*a[field];
  return{min:r.min+Math.min(low,high),max:r.max+Math.max(low,high)};
 },{min:base,max:base});
 const benefit=range("benefitPerUnit",input.baseBenefit),cost=range("costPerUnit",input.baseCost);
 const netAt=(a:ScenarioAssumption,value:number)=>input.baseBenefit+(value-a.value)*a.benefitPerUnit-input.baseCost-(value-a.value)*a.costPerUnit;
 const sensitivity=input.assumptions.map(a=>({assumption:a.name,netBenefitAtMinimum:netAt(a,a.minimum),netBenefitAtMaximum:netAt(a,a.maximum),impact:Math.abs(netAt(a,a.maximum)-netAt(a,a.minimum))})).sort((a,b)=>b.impact-a.impact);
 const expectedNetBenefit=(benefit.min+benefit.max)/2-(cost.min+cost.max)/2;
 return Object.freeze({id:input.id,assumptions:Object.freeze(Object.fromEntries(input.assumptions.map(a=>[a.name,a.value]))),estimatedBenefit:benefit,estimatedCost:cost,risks:Object.freeze([...input.risks]),confidence:input.confidence,sensitivity:Object.freeze(sensitivity),expectedNetBenefit});
}
export class CapabilityCatalog {
 private readonly versions=new Map<string,Capability[]>();
 register(capability:Capability):Capability {
  const errors=validateCapability(capability);if(errors.length)throw new Error("CAPABILITY_INVALID:"+errors.join(","));
  if(capability.version!==1||this.versions.has(capability.id))throw new Error("CAPABILITY_ALREADY_REGISTERED");
  const saved=Object.freeze({...capability,causes:[...capability.causes],outcomes:[...capability.outcomes],dependencies:[...capability.dependencies],evidenceIds:[...capability.evidenceIds]});
  this.versions.set(capability.id,[saved]);return saved;
 }
 publish(next:Capability):Capability {
  const history=this.versions.get(next.id);if(!history)throw new Error("CAPABILITY_NOT_FOUND");
  if(next.version!==history[history.length-1]!.version+1)throw new Error("CAPABILITY_VERSION_CONFLICT");
  const errors=validateCapability(next);if(errors.length)throw new Error("CAPABILITY_INVALID:"+errors.join(","));
  const saved=Object.freeze({...next,causes:[...next.causes],outcomes:[...next.outcomes],dependencies:[...next.dependencies],evidenceIds:[...next.evidenceIds]});
  this.versions.set(next.id,[...history,saved]);return saved;
 }
 current(id:string):Capability{const history=this.versions.get(id);if(!history)throw new Error("CAPABILITY_NOT_FOUND");return history[history.length-1]!}
 history(id:string):readonly Capability[]{return Object.freeze([...(this.versions.get(id)??[])])}
}
export function generateScenarios(idPrefix:string,capabilities:readonly Capability[]):Scenario[]{
 if(!idPrefix||!capabilities.length)throw new Error("SCENARIO_CAPABILITIES_REQUIRED");
 const invalid=capabilities.flatMap(validateCapability);if(invalid.length)throw new Error("CAPABILITY_INVALID:"+invalid.join(","));
 const totalCost=capabilities.reduce((sum,c)=>({min:sum.min+c.cost.min,max:sum.max+c.cost.max}),{min:0,max:0});
 const risks=capabilities.map(c=>c.risk).filter((risk,index,all)=>all.indexOf(risk)===index);
 return [{id:idPrefix+"_combined",assumptions:{capabilityCount:capabilities.length},estimatedBenefit:{min:0,max:0},estimatedCost:totalCost,risks,confidence:capabilities.reduce((sum,c)=>sum+(c.risk==="low"?.9:c.risk==="medium"?.7:.4),0)/capabilities.length}];
}
