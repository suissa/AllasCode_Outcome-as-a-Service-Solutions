export interface ConsentRecord {
  id: string;
  tenantId: string;
  subjectId: string;
  purpose: string;
  granted: boolean;
  capturedAt: string;
  source: string;
  expiresAt?: string;
  withdrawnAt?: string;
}

function timestamp(value: string | undefined): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function hasRequiredMetadata(c: ConsentRecord): boolean {
  return Boolean(
    c &&
    typeof c.id === "string" && c.id.trim() &&
    typeof c.tenantId === "string" && c.tenantId.trim() &&
    typeof c.subjectId === "string" && c.subjectId.trim() &&
    typeof c.purpose === "string" && c.purpose.trim() &&
    typeof c.source === "string" && c.source.trim() &&
    typeof c.granted === "boolean"
  );
}

export function consentIsValid(c: ConsentRecord, purpose: string, now = new Date()): boolean {
  if (!hasRequiredMetadata(c) || typeof purpose !== "string" || !purpose.trim()) return false;
  if (!Number.isFinite(now.getTime()) || !c.granted || c.withdrawnAt !== undefined) return false;
  if (c.purpose !== purpose) return false;

  const capturedAt = timestamp(c.capturedAt);
  if (capturedAt === undefined || capturedAt > now.getTime()) return false;

  if (c.expiresAt !== undefined) {
    const expiresAt = timestamp(c.expiresAt);
    if (expiresAt === undefined || expiresAt <= capturedAt || expiresAt <= now.getTime()) return false;
  }
  return true;
}

export function withdrawConsent(c: ConsentRecord, at = new Date()): ConsentRecord {
  if (c.withdrawnAt !== undefined || !c.granted) throw new Error("CONSENT_ALREADY_WITHDRAWN");
  if (!hasRequiredMetadata(c)) throw new Error("CONSENT_RECORD_INVALID");

  const capturedAt = timestamp(c.capturedAt);
  const withdrawnAt = at.getTime();
  if (capturedAt === undefined || !Number.isFinite(withdrawnAt)) {
    throw new Error("CONSENT_WITHDRAWAL_DATE_INVALID");
  }
  if (withdrawnAt < capturedAt) throw new Error("CONSENT_WITHDRAWAL_BEFORE_CAPTURE");

  return Object.freeze({ ...c, granted: false, withdrawnAt: at.toISOString() });
}
