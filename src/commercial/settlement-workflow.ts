export type SettlementActionKind="issue_fee_invoice"|"credit_bonus"|"refund"|"open_dispute"|"hold";
export interface SettlementTrigger {
 tenantId:string; outcomeId:string; agreementId:string; accepted:boolean; achieved:boolean; disputed:boolean;
 currency:string; feeAmount:number; bonusAmount:number; refundableAmount:number; reason?:string;
}
export interface SettlementAction { id:string; tenantId:string; outcomeId:string; agreementId:string; kind:SettlementActionKind; amount?:number; currency:string; reason:string; idempotencyKey:string }
export function planSettlementActions(input:SettlementTrigger):readonly SettlementAction[]{
 if(!input.tenantId||!input.outcomeId||!input.agreementId||!/^[A-Z]{3}$/.test(input.currency))throw new Error("SETTLEMENT_CONTEXT_INVALID");
 for(const amount of [input.feeAmount,input.bonusAmount,input.refundableAmount])if(!Number.isFinite(amount)||amount<0)throw new Error("SETTLEMENT_AMOUNT_INVALID");
 const make=(kind:SettlementActionKind,amount:number|undefined,reason:string):SettlementAction=>({id:"settlement_"+input.outcomeId+"_"+kind,tenantId:input.tenantId,outcomeId:input.outcomeId,agreementId:input.agreementId,kind,...(amount===undefined?{}:{amount}),currency:input.currency,reason,idempotencyKey:input.tenantId+":"+input.outcomeId+":"+kind});
 if(input.disputed)return Object.freeze([make("open_dispute",undefined,input.reason?.trim()||"Outcome settlement disputed"),make("hold",undefined,"Settlement held until dispute resolution")]);
 if(!input.accepted)return Object.freeze([make("hold",undefined,"Settlement pending deliverable acceptance")]);
 if(input.achieved){
  const actions:SettlementAction[]=[];
  if(input.feeAmount>0)actions.push(make("issue_fee_invoice",input.feeAmount,"Verified outcome fee"));
  if(input.bonusAmount>0)actions.push(make("credit_bonus",input.bonusAmount,"Contractual outcome bonus"));
  return Object.freeze(actions);
 }
 return Object.freeze(input.refundableAmount>0?[make("refund",input.refundableAmount,"Outcome target not achieved")]:[make("hold",undefined,"No fee due; refund not applicable")]);
}
export interface SettlementActionPort { execute(action:SettlementAction):Promise<{externalReference:string}> }
export interface SettlementExecution { completed:readonly {action:SettlementAction;externalReference:string}[];failed?:{action:SettlementAction;errorCode:string} }
export async function executeSettlementPlan(actions:readonly SettlementAction[],port:SettlementActionPort):Promise<SettlementExecution>{
 const completed:{action:SettlementAction;externalReference:string}[]=[];
 for(const action of actions){
  try{const result=await port.execute(action);if(!result.externalReference)throw new Error("SETTLEMENT_REFERENCE_REQUIRED");completed.push({action,externalReference:result.externalReference});}
  catch(error){return Object.freeze({completed:Object.freeze(completed),failed:{action,errorCode:error instanceof Error?error.message:"SETTLEMENT_ACTION_FAILED"}});}
 }
 return Object.freeze({completed:Object.freeze(completed)});
}
