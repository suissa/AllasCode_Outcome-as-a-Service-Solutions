export type PricingKind = "fixed" | "usage" | "milestone" | "outcome" | "gain_share" | "revenue_share" | "bonus" | "sla_credit";
export interface PricingLine {
  id: string;
  label: string;
  kind: PricingKind;
  currency: string;
  amount?: number;
  rate?: number;
  quantity?: number;
  includedQuantity?: number;
  eligibleValue?: number;
  progress?: number;
  floor?: number;
  cap?: number;
  unit?: string;
}
export interface PricedLine {
  id: string;
  kind: PricingKind;
  currency: string;
  quantity: number;
  gross: number;
  adjustment: number;
  total: number;
}
export interface PricingSummary {
  currency: string;
  lines: readonly PricedLine[];
  subtotal: number;
  credits: number;
  total: number;
}
const finite = (n: number | undefined): n is number => n !== undefined && Number.isFinite(n);
const nonNegative = (n: number | undefined): boolean => n === undefined || (finite(n) && n >= 0);
function validateLine(line: PricingLine): void {
  if (!line.id.trim() || !line.label.trim() || !/^[A-Z]{3}$/.test(line.currency)) throw new Error("PRICING_LINE_METADATA_INVALID");
  if (![line.amount, line.rate, line.quantity, line.includedQuantity, line.eligibleValue, line.floor, line.cap].every(nonNegative)) throw new Error("PRICING_VALUE_INVALID");
  if (line.progress !== undefined && (!finite(line.progress) || line.progress < 0 || line.progress > 1)) throw new Error("PRICING_PROGRESS_INVALID");
  if (line.floor !== undefined && line.cap !== undefined && line.floor > line.cap) throw new Error("PRICING_FLOOR_EXCEEDS_CAP");
  if (line.kind === "fixed" || line.kind === "milestone" || line.kind === "bonus") {
    if (!finite(line.amount)) throw new Error("PRICING_AMOUNT_REQUIRED");
  } else if (line.kind === "usage") {
    if (!finite(line.rate) || !finite(line.quantity)) throw new Error("PRICING_USAGE_INPUT_REQUIRED");
  } else {
    if (!finite(line.rate) || !finite(line.eligibleValue) || !finite(line.progress)) throw new Error("PRICING_OUTCOME_INPUT_REQUIRED");
  }
}
export function priceLine(line: PricingLine): PricedLine {
  validateLine(line);
  let quantity = line.quantity ?? 1;
  let gross = 0;
  let adjustment = 0;
  switch (line.kind) {
    case "fixed":
    case "milestone":
    case "bonus":
      gross = line.amount!;
      break;
    case "usage":
      quantity = Math.max(0, line.quantity! - (line.includedQuantity ?? 0));
      gross = quantity * line.rate!;
      break;
    case "outcome":
    case "gain_share":
    case "revenue_share":
      gross = line.eligibleValue! * line.rate! * line.progress!;
      break;
    case "sla_credit":
      gross = line.eligibleValue! * line.rate! * line.progress!;
      adjustment = -gross;
      break;
  }
  if (line.floor !== undefined && gross > 0) gross = Math.max(gross, line.floor);
  if (line.cap !== undefined) gross = Math.min(gross, line.cap);
  const total = line.kind === "sla_credit" ? -gross : gross;
  return Object.freeze({ id: line.id, kind: line.kind, currency: line.currency, quantity, gross, adjustment, total });
}
export function calculatePricing(lines: readonly PricingLine[]): PricingSummary {
  if (!lines.length) throw new Error("PRICING_LINES_REQUIRED");
  const currencies = new Set(lines.map(line => line.currency));
  if (currencies.size !== 1) throw new Error("PRICING_CURRENCY_MISMATCH");
  if (new Set(lines.map(line => line.id)).size !== lines.length) throw new Error("PRICING_LINE_ID_DUPLICATE");
  const priced = lines.map(priceLine);
  const subtotal = priced.reduce((sum, line) => sum + Math.max(0, line.total), 0);
  const credits = priced.reduce((sum, line) => sum + Math.abs(Math.min(0, line.total)), 0);
  return Object.freeze({ currency: priced[0]!.currency, lines: Object.freeze(priced), subtotal, credits, total: subtotal - credits });
}
