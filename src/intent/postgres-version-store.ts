import type { SqlDatabase } from "../persistence/sql.ts";
import type { IntentVersion } from "./versioning.ts";
import { freezeIntentVersion, validateIntentVersion } from "./versioning.ts";

export interface IntentVersionStore {
  append(version: IntentVersion): Promise<void>;
  history(tenantId: string, intentId: string): Promise<readonly IntentVersion[]>;
}

interface IntentVersionRow extends Record<string, unknown> {
  payload: IntentVersion | string;
}

function decode(value: IntentVersion | string): IntentVersion {
  let parsed: unknown = value;
  try {
    if (typeof value === "string") parsed = JSON.parse(value);
  } catch {
    throw new Error("INTENT_VERSION_CORRUPT");
  }
  const errors = validateIntentVersion(parsed as IntentVersion);
  if (errors.length) throw new Error("INTENT_VERSION_CORRUPT:" + errors.join(","));
  return freezeIntentVersion(parsed as IntentVersion);
}

export class PostgresIntentVersionStore implements IntentVersionStore {
  constructor(private readonly db: SqlDatabase) {}

  async append(version: IntentVersion): Promise<void> {
    const tenantId = version?.snapshot?.tenantId;
    if (!tenantId || version.intentId !== version.snapshot.id || version.version !== version.snapshot.version) {
      throw new Error("INTENT_VERSION_SCOPE_INVALID");
    }
    const errors = validateIntentVersion(version);
    if (errors.length) throw new Error("INTENT_VERSION_INVALID:" + errors.join(","));

    await this.db.transaction(async (tx) => {
      await tx.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [tenantId + ":" + version.intentId]);
      const result = await tx.query<{ version: number }>(
        "select version from intent_versions where tenant_id=$1 and intent_id=$2 order by version desc limit 1 for update",
        [tenantId, version.intentId],
      );
      const latest = result.rows[0]?.version ?? 0;
      if (version.version !== latest + 1) throw new Error("INTENT_VERSION_CONFLICT");
      await tx.query(
        "insert into intent_versions (tenant_id,intent_id,version,payload) values ($1,$2,$3,$4::jsonb)",
        [tenantId, version.intentId, version.version, JSON.stringify(freezeIntentVersion(version))],
      );
    });
  }

  async history(tenantId: string, intentId: string): Promise<readonly IntentVersion[]> {
    if (!tenantId?.trim() || !intentId?.trim()) throw new Error("INTENT_VERSION_SCOPE_INVALID");
    const result = await this.db.query<IntentVersionRow>(
      "select payload from intent_versions where tenant_id=$1 and intent_id=$2 order by version",
      [tenantId, intentId],
    );
    return Object.freeze(result.rows.map((row) => decode(row.payload)));
  }
}
