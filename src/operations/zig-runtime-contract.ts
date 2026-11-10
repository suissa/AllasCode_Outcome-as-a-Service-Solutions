/** Language-neutral ABI envelope for the Zig runtime adapter. No arbitrary code or shell execution. */
export type RuntimeCommand = "validate-contract"|"evaluate-policy"|"execute-approved-behavior"|"verify-invariant";
export interface ZigRuntimeRequest { readonly protocolVersion:"1"; readonly tenantId:string; readonly executionId:string; readonly behaviorId:string; readonly command:RuntimeCommand; readonly inputDigest:string; readonly policyDigest:string; readonly proofRefs:readonly string[]; }
export interface ZigRuntimeResponse { readonly protocolVersion:"1"; readonly executionId:string; readonly status:"accepted"|"rejected"|"completed"|"failed"; readonly outputDigest?:string; readonly evidenceRefs:readonly string[]; readonly errorCode?:string; }
export interface ZigRuntimeTransport { invoke(request:ZigRuntimeRequest, signal:AbortSignal):Promise<ZigRuntimeResponse>; }

const COMMANDS: ReadonlySet<string> = new Set(["validate-contract","evaluate-policy","execute-approved-behavior","verify-invariant"]);
const STATUSES: ReadonlySet<string> = new Set(["accepted","rejected","completed","failed"]);

export async function invokeZigRuntime(transport:ZigRuntimeTransport,request:ZigRuntimeRequest,signal:AbortSignal):Promise<ZigRuntimeResponse>{
  if(request.protocolVersion!=="1") throw new Error("ZIG-CONTRACT-VERSION");
  for(const [key,value] of Object.entries(request)) {
    if(typeof value==="string"&&!value.trim()) throw new Error("ZIG-CONTRACT-EMPTY-"+key.toUpperCase());
  }
  if(!COMMANDS.has(request.command)) throw new Error("ZIG-CONTRACT-UNKNOWN-COMMAND");
  if(!Array.isArray(request.proofRefs)||request.proofRefs.some(ref=>typeof ref!=="string"||!ref.trim())) throw new Error("ZIG-CONTRACT-INVALID-PROOF-REFS");
  if(signal.aborted) throw new Error("ZIG-CONTRACT-CANCELLED");
  const response=await transport.invoke(Object.freeze({...request,proofRefs:Object.freeze([...request.proofRefs])}),signal);
  if(response.protocolVersion!==request.protocolVersion||response.executionId!==request.executionId) throw new Error("ZIG-CONTRACT-CORRELATION-MISMATCH");
  if(!STATUSES.has(response.status)) throw new Error("ZIG-CONTRACT-UNKNOWN-STATUS");
  if(!Array.isArray(response.evidenceRefs)||response.evidenceRefs.some(ref=>typeof ref!=="string"||!ref.trim())) throw new Error("ZIG-CONTRACT-INVALID-EVIDENCE-REFS");
  if(response.status==="completed"&&(!response.outputDigest||!response.outputDigest.trim())) throw new Error("ZIG-CONTRACT-OUTPUT-DIGEST-REQUIRED");
  if(response.status==="failed"&&(!response.errorCode||!response.errorCode.trim())) throw new Error("ZIG-CONTRACT-ERROR-CODE-REQUIRED");
  return Object.freeze({...response,evidenceRefs:Object.freeze([...response.evidenceRefs])});
}
