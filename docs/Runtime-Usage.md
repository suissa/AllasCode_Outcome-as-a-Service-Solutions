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

## Durable PostgreSQL adapter and HTTP boundary

The repository now includes a driver-neutral SQL port, a PostgreSQL implementation, and a native Node HTTP adapter. Apply `migrations/0001_outcome_platform.sql` through your deployment migration runner before starting the service.

```ts
import postgres from "postgres";
import {
  PostgresJsDatabase, PostgresOutcomeStore, createOutcomeHttpServer,
  type PostgresQueryClient,
} from "./src/index.ts";

const client = postgres(process.env.DATABASE_URL!, { max: 10 });
const store = new PostgresOutcomeStore(
  new PostgresJsDatabase(client as unknown as PostgresQueryClient),
);
const server = createOutcomeHttpServer({
  store,
  authenticate: async (request) => identityProvider.authenticate(request),
  authorize: async (actor, action, resource) => policyEngine.authorize(actor, action, resource),
});
server.listen(Number(process.env.PORT ?? 3000));
```

The identity provider and policy engine above are application-owned adapters; this repository deliberately does not invent an authentication provider or default-allow policy. The API returns 401 when authentication is absent and 403 when the injected authorization policy denies an action. Case creation overrides the tenant from the authenticated actor and validates the initial outcome contract. Mutating case endpoints require an `Idempotency-Key` header. Requests are limited to 1 MiB and responses are marked no-store.

The PostgreSQL store commits case state, append-only audit event and idempotency result in one transaction. It serializes concurrent uses of a tenant/idempotency key with a transaction-scoped advisory lock. The adapter has unit tests and the CI pipeline runs integration tests against PostgreSQL 16.

## Atomic behavior validation and execution planning

- `validateAbt` provides strict primitive/domain ABT checks, stable error codes and explicit repair proposals (repairs are never silently applied).
- `validateTaskGraph` rejects cycles, unknown dependencies, tenant mismatches, incomplete task contracts and high-risk tasks without approval gates.
- `executionWaves` returns deterministic topological execution waves. This is planning and readiness logic; a fully durable worker/queue, compensation runner and external connector deployment are still required.
- `captureIntent` normalizes web/API/conversation intent envelopes with source provenance; qualified intents can be expanded into discovery tasks.
- Outcome validation checks tenant-bound evidence, metric/unit consistency, period ordering and observation validity before persistence.

## Local validation

Run `npm run typecheck` and `npm test`. To run the real PostgreSQL integration test locally, provide `DATABASE_URL` pointing to a disposable PostgreSQL database; the test applies the idempotent migration and removes its generated tenant data afterward.

## Durable task execution

`PostgresWorkflowTaskStore` persists workflow task state and append-only task events. `DurableWorkflowRuntime` claims tasks with compare-and-set transitions, checks completed dependencies, pauses high-risk work at an approval gate, enforces execution timeouts, records outputs/failures, supports bounded retry and cancellation, and invokes an optional compensation callback after an execution error.

A task executor receives an `AbortSignal`; it must honor cancellation and implement its own idempotent external side effects. Compensation is an injected behavior, not a guarantee that an external system can be rolled back. The runtime is a durable step engine, but it does not yet include a background queue, distributed worker deployment, scheduled retry/backoff service, dead-letter UI or outbox relay.
