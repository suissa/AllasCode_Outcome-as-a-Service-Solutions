import type { OutcomeIntent } from "./intent.ts";
import { validateIntent } from "./intent.ts";

export interface IntentVersion {
  intentId: string;
  version: number;
  snapshot: Readonly<OutcomeIntent>;
  changedBy: string;
  changedAt: string;
  changeReason: string;
}

function parsedTimestamp(value: unknown): number | undefined {
  if (typeof value !== "string" || !value.trim()) return undefined;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function validateIntentVersion(version: IntentVersion): string[] {
  const errors: string[] = [];
  if (!version || typeof version !== "object") return ["version:REQUIRED"];
  if (!version.snapshot || typeof version.snapshot !== "object") return ["snapshot:REQUIRED"];
  if (!version.intentId || version.intentId !== version.snapshot.id) errors.push("intentId:SCOPE_MISMATCH");
  if (!Number.isInteger(version.version) || version.version < 1) errors.push("version:INVALID");
  if (version.version !== version.snapshot.version) errors.push("version:SNAPSHOT_MISMATCH");
  if (!version.snapshot.tenantId?.trim()) errors.push("snapshot.tenantId:REQUIRED");
  if (!version.changedBy?.trim()) errors.push("changedBy:REQUIRED");
  if (!version.changeReason?.trim()) errors.push("changeReason:REQUIRED");

  const changedAt = parsedTimestamp(version.changedAt);
  const createdAt = parsedTimestamp(version.snapshot.createdAt);
  const capturedAt = parsedTimestamp(version.snapshot.provenance?.capturedAt);
  if (changedAt === undefined) errors.push("changedAt:INVALID");
  if (createdAt === undefined) errors.push("snapshot.createdAt:INVALID");
  if (capturedAt === undefined) errors.push("snapshot.provenance.capturedAt:INVALID");
  if (changedAt !== undefined && createdAt !== undefined && changedAt < createdAt) {
    errors.push("changedAt:BEFORE_INTENT_CREATION");
  }
  if (capturedAt !== undefined && createdAt !== undefined && capturedAt > createdAt) {
    errors.push("snapshot.provenance.capturedAt:AFTER_CREATION");
  }
  errors.push(...validateIntent(version.snapshot).map((error) => "snapshot." + error));
  return [...new Set(errors)];
}

export function freezeIntentVersion(version: IntentVersion): IntentVersion {
  const snapshot = Object.freeze({
    ...version.snapshot,
    scope: Object.freeze([...version.snapshot.scope]),
    constraints: Object.freeze([...version.snapshot.constraints]),
    provenance: Object.freeze({ ...version.snapshot.provenance }),
  });
  return Object.freeze({ ...version, snapshot });
}

export function snapshotIntent(
  intent: OutcomeIntent,
  changedBy: string,
  reason: string,
  at = new Date(),
): IntentVersion {
  if (!changedBy?.trim() || !reason?.trim() || !Number.isFinite(at.getTime())) {
    throw new Error("INTENT_VERSION_METADATA_REQUIRED");
  }
  const version: IntentVersion = {
    intentId: intent.id,
    version: intent.version,
    snapshot: Object.freeze({
      ...intent,
      scope: Object.freeze([...intent.scope]),
      constraints: Object.freeze([...intent.constraints]),
      provenance: Object.freeze({ ...intent.provenance }),
    }),
    changedBy: changedBy.trim(),
    changedAt: at.toISOString(),
    changeReason: reason.trim(),
  };
  const errors = validateIntentVersion(version);
  if (errors.length) throw new Error("INTENT_VERSION_INVALID:" + errors.join(","));
  return freezeIntentVersion(version);
}
