import type { AppendOnlyLedger } from "./evidence-ledger.js";
export type ProofVerdict = "passed" | "failed";
export interface FormalProofArtifact {
  readonly proofId: string; readonly tenantId: string; readonly specificationId: string;
  readonly specificationVersion: string; readonly checker: string; readonly checkerVersion: string;
  readonly verdict: ProofVerdict; readonly artifactDigest: string; readonly checkedAt: string;
  readonly obligations: readonly string[]; readonly logReference?: string;
}
export interface ProofRequirement { readonly specificationId: string; readonly version: string; readonly obligations: readonly string[]; }
export interface ProofVerification { readonly satisfied: boolean; readonly missing: readonly string[]; readonly failed: readonly string[]; readonly artifactIds: readonly string[]; }
export class FormalProofRegistry {
  constructor(private readonly ledger: AppendOnlyLedger<FormalProofArtifact>) {}
  async register(artifact: FormalProofArtifact): Promise<void> {
    if (!artifact.proofId.trim() || !artifact.tenantId.trim() || !artifact.artifactDigest.trim()) throw new Error("PROOF-REQUIRED-FIELD");
    if (!Number.isFinite(Date.parse(artifact.checkedAt))) throw new Error("PROOF-INVALID-TIMESTAMP");
    if (!artifact.obligations.length) throw new Error("PROOF-OBLIGATIONS-REQUIRED");
    await this.ledger.append({tenantId:artifact.tenantId,eventId:artifact.proofId,eventType:"formal-proof.checked",occurredAt:artifact.checkedAt,payload:artifact});
  }
  async verify(tenantId: string, requirements: readonly ProofRequirement[]): Promise<ProofVerification> {
    const events=await this.ledger.readTenant(tenantId);
    const artifacts=events.filter(e=>e.eventType==="formal-proof.checked").map(e=>e.payload);
    const missing:string[]=[],failed:string[]=[],ids:string[]=[];
    for(const req of requirements) for(const obligation of req.obligations) {
      const candidates=artifacts.filter(a=>a.tenantId===tenantId&&a.specificationId===req.specificationId&&a.specificationVersion===req.version&&a.obligations.includes(obligation));
      const passed=candidates.find(a=>a.verdict==="passed");
      if(passed) ids.push(passed.proofId);
      else if(candidates.some(a=>a.verdict==="failed")) failed.push(req.specificationId+":"+obligation);
      else missing.push(req.specificationId+":"+obligation);
    }
    return {satisfied:missing.length===0&&failed.length===0,missing,failed,artifactIds:[...new Set(ids)]};
  }
}
