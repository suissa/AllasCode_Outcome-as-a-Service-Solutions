import type{LedgerEntry}from "./metering.ts";export interface Invoice{id:string;tenantId:string;agreementId:string;currency:string;entries:LedgerEntry[];subtotal:number;adjustments:number;total:number;status:"draft"|"issued"|"paid"|"void"|"disputed";issuedAt?:string}export function buildInvoice(i:Omit<Invoice,"subtotal"|"total"|"status">):Invoice{if(i.entries.some(e=>e.currency!==i.currency))throw new Error("INVOICE_CURRENCY_MISMATCH");const subtotal=i.entries.reduce((s,e)=>s+(e.kind==="credit"||e.kind==="refund"?-e.amount:e.amount),0);return Object.freeze({...i,subtotal,total:subtotal+i.adjustments,status:"draft"})}export function issueInvoice(i:Invoice,at=new Date()):Invoice{if(i.status!=="draft"||i.total<0)throw new Error("INVOICE_CANNOT_ISSUE");return Object.freeze({...i,status:"issued",issuedAt:at.toISOString()})}
export interface InvoiceEvent { id: string; invoiceId: string; tenantId: string; kind: "payment"|"refund"|"dispute_opened"|"dispute_resolved"; amount?: number; currency: string; reason?: string; occurredAt: string; externalReference?: string }
export interface InvoiceLedgerState { invoice: Invoice; paidAmount: number; refundedAmount: number; events: readonly InvoiceEvent[] }
export function recordInvoicePayment(state: InvoiceLedgerState, event: InvoiceEvent): InvoiceLedgerState {
  if (event.kind !== "payment" || event.invoiceId !== state.invoice.id || event.tenantId !== state.invoice.tenantId || event.currency !== state.invoice.currency) throw new Error("PAYMENT_SCOPE_INVALID");
  if (state.invoice.status !== "issued" || !Number.isFinite(event.amount) || (event.amount ?? 0) <= 0) throw new Error("PAYMENT_NOT_ALLOWED");
  const paidAmount = state.paidAmount + event.amount!;
  if (paidAmount > state.invoice.total) throw new Error("PAYMENT_OVER_AMOUNT");
  const invoice = Object.freeze({ ...state.invoice, status: paidAmount === state.invoice.total ? "paid" as const : "issued" as const });
  return Object.freeze({ invoice, paidAmount, refundedAmount: state.refundedAmount, events: Object.freeze([...state.events, Object.freeze(event)]) });
}
export function refundInvoice(state: InvoiceLedgerState, event: InvoiceEvent): InvoiceLedgerState {
  if (event.kind !== "refund" || event.invoiceId !== state.invoice.id || event.tenantId !== state.invoice.tenantId || event.currency !== state.invoice.currency) throw new Error("REFUND_SCOPE_INVALID");
  if (state.invoice.status !== "paid" || !Number.isFinite(event.amount) || (event.amount ?? 0) <= 0 || !event.reason?.trim()) throw new Error("REFUND_NOT_ALLOWED");
  const refundedAmount = state.refundedAmount + event.amount!;
  if (refundedAmount > state.paidAmount) throw new Error("REFUND_OVER_PAID_AMOUNT");
  const invoice = Object.freeze({ ...state.invoice, status: refundedAmount === state.paidAmount ? "void" as const : "paid" as const });
  return Object.freeze({ invoice, paidAmount: state.paidAmount, refundedAmount, events: Object.freeze([...state.events, Object.freeze(event)]) });
}
export function disputeInvoice(state: InvoiceLedgerState, event: InvoiceEvent): InvoiceLedgerState {
  if (event.kind !== "dispute_opened" || event.invoiceId !== state.invoice.id || event.tenantId !== state.invoice.tenantId || !event.reason?.trim()) throw new Error("DISPUTE_SCOPE_INVALID");
  if (state.invoice.status !== "issued" && state.invoice.status !== "paid") throw new Error("DISPUTE_NOT_ALLOWED");
  return Object.freeze({ ...state, invoice: Object.freeze({ ...state.invoice, status: "disputed" as const }), events: Object.freeze([...state.events, Object.freeze(event)]) });
}
export function resolveInvoiceDispute(state: InvoiceLedgerState, event: InvoiceEvent, resolution: "uphold"|"reverse"): InvoiceLedgerState {
  if (state.invoice.status !== "disputed" || event.kind !== "dispute_resolved" || !event.reason?.trim()) throw new Error("DISPUTE_RESOLUTION_INVALID");
  const status = resolution === "reverse" ? "void" : state.paidAmount >= state.invoice.total ? "paid" : "issued";
  return Object.freeze({ ...state, invoice: Object.freeze({ ...state.invoice, status }), events: Object.freeze([...state.events, Object.freeze(event)]) });
}
