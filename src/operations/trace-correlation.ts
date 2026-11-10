import { createTelemetryEvent, validateTraceContext, type ValidatedTraceContext } from "./observability.ts";

export class CorrelationError extends Error {
  constructor(readonly code: string, readonly path: string, message = code) {
    super(message);
    this.name = "CorrelationError";
  }
}

export interface OutcomeSignalContext extends ValidatedTraceContext {
  outcomeId: string;
  executionId: string;
}

interface SignalBase {
  id: string;
  occurredAt: string;
  context: OutcomeSignalContext;
  attributes?: Readonly<Record<string, string | number | boolean | null>>;
}

export interface TraceSignal extends SignalBase {
  kind: "trace";
  name: string;
  parentSpanId?: string;
}

export interface LogSignal extends SignalBase {
  kind: "log";
  level: "debug" | "info" | "warn" | "error";
  event: string;
}

export interface MetricSignal extends SignalBase {
  kind: "metric";
  name: string;
  value: number;
  unit: string;
}

export type OutcomeSignal = TraceSignal | LogSignal | MetricSignal;

export interface CorrelationInput {
  tenantId: string;
  outcomeId: string;
  executionId: string;
  signals: readonly OutcomeSignal[];
  now?: Date;
}

export interface CorrelatedSignal {
  kind: OutcomeSignal["kind"];
  id: string;
  occurredAt: string;
  context: Readonly<OutcomeSignalContext>;
  name?: string;
  parentSpanId?: string;
  level?: LogSignal["level"];
  event?: string;
  value?: number;
  unit?: string;
  attributes: Readonly<Record<string, string | number | boolean | null>>;
}

export interface OutcomeCorrelation {
  tenantId: string;
  outcomeId: string;
  executionId: string;
  traceId: string;
  signals: readonly CorrelatedSignal[];
  counts: Readonly<{ trace: number; log: number; metric: number }>;
  windowStart: string;
  windowEnd: string;
}

const requiredText = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0 && value.length <= 256;

const validSpanId = (value: unknown): value is string =>
  typeof value === "string" && /^(?!0{16})[a-f0-9]{16}$/i.test(value);

const validTimestamp = (value: unknown): value is string =>
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value) &&
  Number.isFinite(Date.parse(value));

function fail(code: string, path: string): never {
  throw new CorrelationError(code, path);
}

export function correlateOutcomeSignals(input: CorrelationInput): Readonly<OutcomeCorrelation> {
  if (!input || !requiredText(input.tenantId) || !requiredText(input.outcomeId) || !requiredText(input.executionId)) {
    fail("CORRELATION_SCOPE_INVALID", "scope");
  }
  if (!Array.isArray(input.signals) || input.signals.length === 0) {
    fail("CORRELATION_SIGNALS_REQUIRED", "signals");
  }
  const now = input.now ?? new Date();
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) fail("CORRELATION_CLOCK_INVALID", "now");

  const ids = new Set<string>();
  const traceSpans = new Set<string>();
  const normalized: CorrelatedSignal[] = [];
  let traceId: string | undefined;
  const counts = { trace: 0, log: 0, metric: 0 };

  for (let index = 0; index < input.signals.length; index += 1) {
    const signal = input.signals[index]!;
    const path = `signals[${index}]`;
    if (!signal || !requiredText(signal.id) || ids.has(signal.id)) {
      fail(ids.has(signal?.id) ? "CORRELATION_SIGNAL_DUPLICATE" : "CORRELATION_SIGNAL_INVALID", `${path}.id`);
    }
    ids.add(signal.id);
    if (!validTimestamp(signal.occurredAt)) fail("CORRELATION_TIMESTAMP_INVALID", `${path}.occurredAt`);
    if (Date.parse(signal.occurredAt) > now.getTime()) fail("CORRELATION_TIMESTAMP_FUTURE", `${path}.occurredAt`);
    if (signal.context?.tenantId !== input.tenantId) fail("CORRELATION_TENANT_MISMATCH", `${path}.context.tenantId`);
    if (signal.context?.outcomeId !== input.outcomeId) fail("CORRELATION_OUTCOME_MISMATCH", `${path}.context.outcomeId`);
    if (signal.context?.executionId !== input.executionId) fail("CORRELATION_EXECUTION_MISMATCH", `${path}.context.executionId`);

    const context = validateTraceContext(signal.context);
    if (!requiredText(context.outcomeId) || !requiredText(context.executionId)) {
      fail("CORRELATION_CONTEXT_INVALID", `${path}.context`);
    }
    if (traceId === undefined) traceId = context.traceId;
    else if (traceId !== context.traceId) fail("CORRELATION_TRACE_MISMATCH", `${path}.context.traceId`);

    if (signal.kind === "trace") {
      if (!requiredText(signal.name)) fail("CORRELATION_SIGNAL_INVALID", `${path}.name`);
      if (signal.parentSpanId !== undefined &&
          (!validSpanId(signal.parentSpanId) || signal.parentSpanId === context.spanId)) {
        fail("CORRELATION_SPAN_INVALID", `${path}.parentSpanId`);
      }
      if (traceSpans.has(context.spanId)) fail("CORRELATION_SPAN_DUPLICATE", `${path}.context.spanId`);
      traceSpans.add(context.spanId);
    } else if (signal.kind === "log") {
      if (!["debug", "info", "warn", "error"].includes(signal.level) || !requiredText(signal.event)) {
        fail("CORRELATION_SIGNAL_INVALID", path);
      }
    } else if (signal.kind === "metric") {
      if (!requiredText(signal.name) || !requiredText(signal.unit)) fail("CORRELATION_SIGNAL_INVALID", path);
      if (typeof signal.value !== "number" || !Number.isFinite(signal.value)) {
        fail("CORRELATION_METRIC_VALUE_INVALID", `${path}.value`);
      }
    } else {
      fail("CORRELATION_SIGNAL_INVALID", `${path}.kind`);
    }

    const safeEvent = createTelemetryEvent(context, {
      name: signal.kind === "log" ? signal.event : signal.name,
      occurredAt: signal.occurredAt,
      attributes: signal.attributes ?? {},
    });
    const base = {
      kind: signal.kind,
      id: signal.id,
      occurredAt: signal.occurredAt,
      context: Object.freeze({ ...context }) as Readonly<OutcomeSignalContext>,
      attributes: safeEvent.attributes,
    };
    if (signal.kind === "trace") normalized.push(Object.freeze({ ...base, name: signal.name, ...(signal.parentSpanId ? { parentSpanId: signal.parentSpanId } : {}) }));
    else if (signal.kind === "log") normalized.push(Object.freeze({ ...base, level: signal.level, event: signal.event }));
    else normalized.push(Object.freeze({ ...base, name: signal.name, value: signal.value, unit: signal.unit }));
    counts[signal.kind] += 1;
  }

  normalized.sort((a, b) =>
    Date.parse(a.occurredAt) - Date.parse(b.occurredAt) ||
    a.kind.localeCompare(b.kind) ||
    a.id.localeCompare(b.id),
  );

  return Object.freeze({
    tenantId: input.tenantId,
    outcomeId: input.outcomeId,
    executionId: input.executionId,
    traceId: traceId!,
    signals: Object.freeze(normalized),
    counts: Object.freeze(counts),
    windowStart: normalized[0]!.occurredAt,
    windowEnd: normalized[normalized.length - 1]!.occurredAt,
  });
}
