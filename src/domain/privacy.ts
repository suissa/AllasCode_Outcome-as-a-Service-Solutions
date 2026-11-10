export type DataClass = "public" | "internal" | "confidential" | "personal" | "sensitive";

export interface DataHandling {
  classification: DataClass;
  purpose: string;
  retentionUntil?: string;
  consentId?: string;
  legalBasis?: string;
}

const DATA_CLASSES = new Set<DataClass>([
  "public",
  "internal",
  "confidential",
  "personal",
  "sensitive",
]);

function timestamp(value: string): number | undefined {
  if (typeof value !== "string" || value.trim().length === 0) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function validateDataHandling(d: DataHandling, now = new Date()): void {
  if (!d || !DATA_CLASSES.has(d.classification)) {
    throw new Error("DATA_CLASSIFICATION_INVALID");
  }
  if (typeof d.purpose !== "string" || !d.purpose.trim()) {
    throw new Error("DATA_PURPOSE_REQUIRED");
  }
  if (!Number.isFinite(now.getTime())) {
    throw new Error("VALIDATION_CLOCK_INVALID");
  }

  const hasConsent = typeof d.consentId === "string" && d.consentId.trim().length > 0;
  const hasLegalBasis = typeof d.legalBasis === "string" && d.legalBasis.trim().length > 0;
  if ((d.classification === "personal" || d.classification === "sensitive") && !hasConsent && !hasLegalBasis) {
    throw new Error("PRIVACY_BASIS_REQUIRED");
  }

  if (d.retentionUntil !== undefined) {
    const retention = timestamp(d.retentionUntil);
    if (retention === undefined) throw new Error("RETENTION_DATE_INVALID");
    if (retention <= now.getTime()) throw new Error("RETENTION_EXPIRED");
  }
}
