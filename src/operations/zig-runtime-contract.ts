/** Language-neutral ABI envelope for the Zig runtime adapter. No arbitrary code or shell execution. */
export type RuntimeCommand = "validate-contract"|"evaluate-policy"|"execute-approved-behavior"|"verify-invariant";
export interface ZigRuntimeRequest { readonly protocolVersion:"1"; readonly tenantId:string; readonly executionId:string; readonly behaviorId:string; readonly command:RuntimeCommand; readonly inputDigest:string; readonly policyDigest:string; readonly proofRefs:readonly string[]; }
export interface ZigRuntimeResponse { readonly protocolVersion:"1"; readonly executionId:string; readonly status:"accepted"|"rejected"|"completed"|"failed"; readonly outputDigest?:string; readonly evidenceRefs:readonly string[]; readonly errorCode?:string; }
export interface ZigRuntimeTransport { invoke(request:ZigRuntimeRequest, signal:AbortSignal):Promise<ZigRuntimeResponse>; }
export async function invokeZigRuntime(transport:ZigRuntimeTransport,request:ZigRuntimeRequest,signal:AbortSignal):Promise<ZigRuntimeResponse>{
  for(const [key,value] of Object.entries(request)) if(typeof value==="string"&&!value.trim()) throw new Error("ZIG-CONTRACT-EMPTY-"+key.toUpperCase());
  if(request.protocolVersion!=="1") throw new Error("ZIG-CONTRACT-VERSION");
  const response=await transport.invoke(Object.freeze({...request,proofRefs:Object.freeze([...request.proofRefs])}),signal);
  if(response.protocolVersion!==request.protocolVersion||response.executionId!==request.executionId) throw new Error("ZIG-CONTRACT-CORRELATION-MISMATCH");
  if(response.status==="completed"&&!response.outputDigest) throw new Error("ZIG-CONTRACT-OUTPUT-DIGEST-REQUIRED");
  if(response.status==="failed"&&!response.errorCode) throw new Error("ZIG-CONTRACT-ERROR-CODE-REQUIRED");
  return Object.freeze(response);
}
