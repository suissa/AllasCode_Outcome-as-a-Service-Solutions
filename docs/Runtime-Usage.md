# Outcome Platform Runtime

This repository currently provides a TypeScript reference runtime/library (not a hosted SaaS deployment). The `OutcomePlatform` is an in-memory executable composition for local development, integration tests and adapter implementations.

## Quick start

```ts
import { OutcomePlatform } from "./src/application/platform.ts";
const platform = new OutcomePlatform();
platform.register(approvedCase);
const ctx = {tenantId:"tenant-1",actorId:"owner",correlationId:"req-1",idempotencyKey:"start-1"};
platform.start(ctx, approvedCase.id);
```

Commands require tenant, actor, correlation and idempotency identifiers. Writes are tenant-scoped, append an audit event only on first execution, and replay the original result when the same key/fingerprint is repeated. Reusing a key with a different payload fails with `IDEMPOTENCY_CONFLICT`.

## Lifecycle

1. Register a case whose outcome specification is approved.
2. Start it (specified → active).
3. Attach hash-verified, tenant-owned evidence.
4. Record observations for the outcome metric/unit.
5. Settle with an observation index; evidence is mandatory and an immutable report is generated.
6. Dispute a settled result with a non-empty reason.

`get(tenantId, caseId)` and `auditTrail(tenantId)` are tenant-filtered. The runtime is intentionally in-memory: production deployments must implement durable storage, authentication/authorization adapters, secret management, external connector delivery, and transactional outbox/queue before serving customers. Those infrastructure concerns are not represented as complete merely by this reference implementation.
