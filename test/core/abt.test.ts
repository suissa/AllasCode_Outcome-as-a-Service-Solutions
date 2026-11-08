import test from "node:test";
import assert from "node:assert/strict";
import { validateAbt } from "../../src/core/abt.ts";
test("ABTs reject coercion and malformed boundary values", () => {
  assert.equal(validateAbt("boolean", "true").issues[0]?.code, "BOOLEAN_STRICT");
  assert.equal(validateAbt("integer", 1.5).issues[0]?.code, "INTEGER_INVALID");
  assert.equal(validateAbt("phone", "11999999999").issues[0]?.code, "PHONE_NOT_E164");
  assert.equal(validateAbt("url", "http://example.com").issues[0]?.code, "URL_SCHEME_FORBIDDEN");
  assert.equal(validateAbt("date", "2026-02-30").valid, false);
  assert.equal(validateAbt("timestamp", "2026-11-08T12:00:00").valid, false);
});
test("ABTs validate tenant, provenance, currency and typed metrics", () => {
  const evidence = { id: "evidence_demo_001", tenantId: "tenant_other_001", sourceId: "crm", contentHash: "a".repeat(64), capturedAt: "2026-11-08T12:00:00Z" };
  assert.equal(validateAbt("evidence", evidence, { tenantId: "tenant_demo_001" }).issues[0]?.code, "TENANT_MISMATCH");
  assert.equal(validateAbt("money", { amount: 1.234, currency: "BRL" }).issues[0]?.code, "MONEY_SCALE_INVALID");
  assert.equal(validateAbt("metric", { metricId: "metric_xxx", value: 3, unit: "USD" }, { metricId: "metric_yyy", unit: "BRL" }).issues.length, 2);
  assert.equal(validateAbt("secret", { secretRef: "vault/key", value: "leak" }).issues[0]?.code, "SECRET_REFERENCE_ONLY");
});
test("email normalization is explicit and auditable", () => {
  const result = validateAbt("email", "person@EXAMPLE.COM");
  assert.equal(result.valid, true);
  assert.equal(result.value, "person@example.com");
  assert.equal(result.repairs[0]?.rule, "EMAIL_DOMAIN_LOWERCASE");
});
