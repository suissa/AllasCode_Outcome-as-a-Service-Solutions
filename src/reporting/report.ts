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

export interface CustomerOutcomeReportInput extends Omit<OutcomeReport,"generatedAt"|"evidenceLinks"> {
  metric: { id: string; name: string; unit: string };
  period: { start: string; end: string };
  attribution: string;
  guardrails: readonly { name: string; status: "within_limit" | "breached" | "not_measured"; observed: string; limit: string }[];
}
export interface CustomerOutcomeReport extends OutcomeReport {
  metric: Readonly<{ id: string; name: string; unit: string }>;
  period: Readonly<{ start: string; end: string }>;
  attribution: string;
  guardrails: readonly Readonly<{ name: string; status: "within_limit" | "breached" | "not_measured"; observed: string; limit: string }>[];
  evidenceLinks: readonly { evidenceId: string; url: string; expiresAt: string }[];
}
export class CustomerReportError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message); this.name = "CustomerReportError";
  }
}
const reportRequired = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const reportHash = /^[a-f0-9]{64}$/i;
function validateCustomerReportInput(input: CustomerOutcomeReportInput, evidence: readonly EvidenceRecord[], access: EvidenceAccessContext, now: Date): EvidenceRecord[] {
  if (![input.id, input.tenantId, input.outcomeId].every(reportRequired)) throw new CustomerReportError("REPORT_METADATA_INVALID", "metadata");
  if (input.tenantId !== access.tenantId) throw new CustomerReportError("REPORT_TENANT_MISMATCH", "tenantId");
  if (!reportRequired(access.actorId) || !reportRequired(access.purpose)) throw new CustomerReportError("REPORT_ACCESS_CONTEXT_INVALID", "access");
  if (!input.metric || ![input.metric.id, input.metric.name, input.metric.unit].every(reportRequired)) throw new CustomerReportError("REPORT_METRIC_INVALID", "metric");
  if (!input.period || !/^\\d{4}-\\d{2}-\\d{2}$/.test(input.period.start) || !/^\\d{4}-\\d{2}-\\d{2}$/.test(input.period.end) || !Number.isFinite(Date.parse(input.period.start + "T00:00:00Z")) || !Number.isFinite(Date.parse(input.period.end + "T00:00:00Z")) || input.period.end <= input.period.start) throw new CustomerReportError("REPORT_PERIOD_INVALID", "period");
  if (!reportRequired(input.methodology)) throw new CustomerReportError("REPORT_METHOD_REQUIRED", "methodology");
  if (!reportRequired(input.attribution)) throw new CustomerReportError("REPORT_ATTRIBUTION_REQUIRED", "attribution");
  if (!Array.isArray(input.limitations) || input.limitations.some(value => !reportRequired(value))) throw new CustomerReportError("REPORT_LIMITATIONS_INVALID", "limitations");
  if (!Array.isArray(input.guardrails) || input.guardrails.some(item => !item || !reportRequired(item.name) || !reportRequired(item.observed) || !reportRequired(item.limit) || !["within_limit", "breached", "not_measured"].includes(item.status))) throw new CustomerReportError("REPORT_GUARDRAILS_INVALID", "guardrails");
  const result = input.result;
  if (!result || ![result.baseline, result.target, result.observed, result.absoluteChange, result.targetProgress, result.confidence].every(Number.isFinite) || result.confidence < 0 || result.confidence > 1 || result.targetProgress < 0 || result.targetProgress > 1 || typeof result.achieved !== "boolean") throw new CustomerReportError("REPORT_RESULT_INVALID", "result");
  if (!Array.isArray(input.evidenceIds) || input.evidenceIds.length === 0) throw new CustomerReportError("REPORT_EVIDENCE_REQUIRED", "evidenceIds");
  if (input.evidenceIds.some(id => !reportRequired(id))) throw new CustomerReportError("REPORT_EVIDENCE_ID_INVALID", "evidenceIds");
  if (new Set(input.evidenceIds).size !== input.evidenceIds.length) throw new CustomerReportError("REPORT_EVIDENCE_DUPLICATE", "evidenceIds");
  const byId = new Map(evidence.map(item => [item.id, item]));
  const selected: EvidenceRecord[] = [];
  for (const id of input.evidenceIds) {
    const item = byId.get(id);
    if (!item || item.tenantId !== input.tenantId) throw new CustomerReportError("REPORT_EVIDENCE_NOT_FOUND", "evidenceIds");
    if (!reportRequired(item.sourceId) || !reportHash.test(item.contentHash) || !Number.isFinite(Date.parse(item.capturedAt))) throw new CustomerReportError("REPORT_EVIDENCE_INTEGRITY_INVALID", "evidenceIds");
    const accessErrors = verifyEvidenceAccess(item, access, now);
    if (accessErrors.length) throw new CustomerReportError("REPORT_EVIDENCE_ACCESS_DENIED", "evidenceIds", accessErrors.join(","));
    selected.push(item);
  }
  return selected;
}
function validateSignedEvidenceUrl(rawUrl: string): string {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { throw new CustomerReportError("REPORT_EVIDENCE_LINK_INVALID", "evidenceLinks"); }
  if (parsed.protocol !== "https:" || !parsed.hostname || parsed.username || parsed.password || parsed.hash) throw new CustomerReportError("REPORT_EVIDENCE_LINK_INVALID", "evidenceLinks");
  return parsed.toString();
}
/** Preflights every report field and evidence permission before requesting any signed link. */
export async function buildCustomerOutcomeReport(
  input: CustomerOutcomeReportInput,
  evidence: readonly EvidenceRecord[],
  access: EvidenceAccessContext,
  sign: EvidenceLinkSigner,
  now = new Date(),
): Promise<CustomerOutcomeReport> {
  if (!Number.isFinite(now.getTime())) throw new CustomerReportError("REPORT_TIMESTAMP_INVALID", "generatedAt");
  const selected = validateCustomerReportInput(input, evidence, access, now);
  const expiresAt = new Date(now.getTime() + 15 * 60_000).toISOString();
  const evidenceLinks: { evidenceId: string; url: string; expiresAt: string }[] = [];
  for (const item of selected) {
    let signed: string;
    try { signed = await sign(item, expiresAt); }
    catch { throw new CustomerReportError("REPORT_EVIDENCE_SIGNING_FAILED", "evidenceLinks"); }
    evidenceLinks.push(Object.freeze({ evidenceId: item.id, url: validateSignedEvidenceUrl(signed), expiresAt }));
  }
  const base = buildOutcomeReport({
    id: input.id, tenantId: input.tenantId, outcomeId: input.outcomeId, result: input.result,
    evidenceIds: [...input.evidenceIds], methodology: input.methodology, limitations: [...input.limitations],
  }, now);
  return Object.freeze({
    ...base,
    metric: Object.freeze({ ...input.metric }),
    period: Object.freeze({ ...input.period }),
    attribution: input.attribution,
    guardrails: Object.freeze(input.guardrails.map(item => Object.freeze({ ...item }))),
    evidenceLinks: Object.freeze(evidenceLinks),
  });
}
function markdownText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\\|/g, "\\\\|").replace(/\r?\n/g, " ");
}
/** Render a customer-safe Markdown artifact; never embeds evidence payloads or credentials. */
export function renderCustomerOutcomeReport(report: CustomerOutcomeReport): string {
  if (!report || !reportRequired(report.id) || !reportRequired(report.tenantId) || !reportRequired(report.outcomeId) ||
      !Number.isFinite(Date.parse(report.generatedAt)) || !report.metric || !reportRequired(report.metric.name) ||
      !report.period || !reportRequired(report.period.start) || !reportRequired(report.period.end) ||
      !reportRequired(report.methodology) || !reportRequired(report.attribution) ||
      !Array.isArray(report.evidenceLinks) || !Array.isArray(report.evidenceIds) || report.evidenceLinks.length !== report.evidenceIds.length) {
    throw new CustomerReportError("REPORT_DOCUMENT_INVALID", "report");
  }
  const result = report.result;
  if (!result || ![result.baseline, result.target, result.observed, result.absoluteChange, result.targetProgress, result.confidence].every(Number.isFinite) || result.confidence < 0 || result.confidence > 1) {
    throw new CustomerReportError("REPORT_DOCUMENT_INVALID", "result");
  }
  const lines = [
    "# Relatório de resultado",
    "",
    `- **Relatório:** ${markdownText(report.id)}`,
    `- **Resultado:** ${result.achieved ? "Resultado alcançado" : "Meta não alcançada"}`,
    `- **Métrica:** ${markdownText(report.metric.name)} (${markdownText(report.metric.unit)})`,
    `- **Período:** ${markdownText(report.period.start)} a ${markdownText(report.period.end)}`,
    `- **Gerado em:** ${markdownText(report.generatedAt)}`,
    "",
    "## Resultado medido",
    "",
    "| Baseline | Meta | Observado | Variação | Progresso | Confiança declarada |",
    "|---:|---:|---:|---:|---:|---:|",
    `| ${result.baseline} | ${result.target} | ${result.observed} | ${result.absoluteChange} | ${(result.targetProgress * 100).toFixed(1)}% | ${(result.confidence * 100).toFixed(1)}% |`,
    "",
    "## Método e atribuição",
    "",
    markdownText(report.methodology),
    "",
    markdownText(report.attribution),
    "",
    "**Nota:** atribuição por contribuição não constitui prova causal.",
    "",
    "## Guardrails",
    "",
    ...(report.guardrails.length ? report.guardrails.map(item => `- ${markdownText(item.name)}: ${item.status} (observado: ${markdownText(item.observed)}; limite: ${markdownText(item.limit)})`) : ["- Nenhum guardrail informado."]),
    "",
    "## Limitações",
    "",
    ...(report.limitations.length ? report.limitations.map(item => `- ${markdownText(item)}`) : ["- Nenhuma limitação informada."]),
    "",
    "## Evidências",
    "",
    ...report.evidenceLinks.map(link => {
      if (!report.evidenceIds.includes(link.evidenceId) || !Number.isFinite(Date.parse(link.expiresAt))) throw new CustomerReportError("REPORT_DOCUMENT_INVALID", "evidenceLinks");
      const url = validateSignedEvidenceUrl(link.url);
      return `- [${markdownText(link.evidenceId)}](${url}) — link expira em ${markdownText(link.expiresAt)}`;
    }),
    "",
    "Os valores e links refletem as evidências autorizadas no momento da geração. Links temporários expiram; o relatório não substitui o contrato nem uma auditoria independente.",
  ];
  return lines.join("\\n");
}
