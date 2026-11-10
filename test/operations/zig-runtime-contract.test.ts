import assert from "node:assert/strict";
import {describe,it} from "node:test";
import {
  decodeZigRuntimeRequest,
  decodeZigRuntimeResponse,
  encodeZigRuntimeRequest,
  encodeZigRuntimeResponse,
  invokeZigRuntime,
  ZIG_RUNTIME_MAX_FRAME_BYTES
} from "../../src/operations/zig-runtime-contract.js";

const request={protocolVersion:"1" as const,tenantId:"tenant-a",executionId:"exec-1",behaviorId:"behavior-1",command:"execute-approved-behavior" as const,inputDigest:"sha256:input",policyDigest:"sha256:policy",proofRefs:["proof-1"]};

describe("Zig runtime protocol v1",()=>{
  it("accepts a correlated completed response",async()=>{
    const transport={invoke:async()=>({protocolVersion:"1" as const,executionId:"exec-1",status:"completed" as const,outputDigest:"sha256:output",evidenceRefs:["evidence-1"]})};
    assert.equal((await invokeZigRuntime(transport,request,new AbortController().signal)).status,"completed");
  });
  it("rejects runtime-injected unknown commands",async()=>{
    const unsafe={...request,command:"run-shell"} as unknown as typeof request;
    await assert.rejects(invokeZigRuntime({invoke:async()=>{throw new Error("must not dispatch");}},unsafe,new AbortController().signal),/ZIG-CONTRACT-UNKNOWN-COMMAND/);
  });
  it("rejects invalid proof references before dispatch",async()=>{
    const unsafe={...request,proofRefs:[""]};
    await assert.rejects(invokeZigRuntime({invoke:async()=>{throw new Error("must not dispatch");}},unsafe,new AbortController().signal),/ZIG-CONTRACT-INVALID-PROOF-REFS/);
  });
  it("rejects malformed evidence references",async()=>{
    const transport={invoke:async()=>({protocolVersion:"1" as const,executionId:"exec-1",status:"accepted" as const,evidenceRefs:[""]})};
    await assert.rejects(invokeZigRuntime(transport,request,new AbortController().signal),/ZIG-CONTRACT-INVALID-EVIDENCE-REFS/);
  });
  it("does not dispatch an already-cancelled execution",async()=>{
    const controller=new AbortController();controller.abort();
    await assert.rejects(invokeZigRuntime({invoke:async()=>{throw new Error("must not dispatch");}},request,controller.signal),/ZIG-CONTRACT-CANCELLED/);
  });
  it("round-trips a request through the bounded JSON wire codec",()=>{
    const frame=encodeZigRuntimeRequest(request);
    assert.deepEqual(decodeZigRuntimeRequest(frame),request);
  });
  it("round-trips a completed response and binds it to its request",()=>{
    const response={protocolVersion:"1" as const,executionId:"exec-1",status:"completed" as const,outputDigest:"sha256:output",evidenceRefs:["evidence-1"]};
    assert.deepEqual(decodeZigRuntimeResponse(encodeZigRuntimeResponse(response,request),request),response);
  });
  it("rejects malformed JSON and unknown fields",()=>{
    assert.throws(()=>decodeZigRuntimeRequest("{"),/ZIG-CONTRACT-INVALID-JSON/);
    assert.throws(()=>decodeZigRuntimeRequest(JSON.stringify({...request,extra:"ignored"})),/ZIG-CONTRACT-REQUEST-FIELDS/);
  });
  it("rejects oversized frames before parsing",()=>{
    assert.throws(()=>decodeZigRuntimeRequest(" ".repeat(ZIG_RUNTIME_MAX_FRAME_BYTES+1)),/ZIG-CONTRACT-FRAME-TOO-LARGE/);
  });
  it("rejects excessive reference arrays",()=>{
    assert.throws(()=>decodeZigRuntimeRequest(JSON.stringify({...request,proofRefs:Array.from({length:129},(_,i)=>"p-"+i)})),/ZIG-CONTRACT-INVALID-PROOF-REFS/);
  });
  it("rejects response correlation mismatch during decode",()=>{
    const response={protocolVersion:"1",executionId:"other-execution",status:"accepted",evidenceRefs:[]};
    assert.throws(()=>decodeZigRuntimeResponse(JSON.stringify(response),request),/ZIG-CONTRACT-CORRELATION-MISMATCH/);
  });
});
