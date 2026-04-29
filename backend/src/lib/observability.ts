/**
 * Structured logging + error reporting. Vanilla — no deps.
 *
 * Real production wires this to:
 *   - pino (or @opentelemetry/api with OTLP exporter)
 *   - Sentry SDK for exception capture
 *
 * For now we emit JSON lines to stdout (agent-readable) + maintain the
 * Sentry capture surface so swapping the import is a one-liner.
 *
 * Drift detection (PRD §11.5): every AI inference written to the DB is
 * tagged with `was_acted_on` (the human's decision). Drift surface lives
 * at `aiInferences.driftReport` — see that procedure for the math.
 */

type LogLevel = "debug" | "info" | "warn" | "error";

interface LogPayload {
  level: LogLevel;
  msg: string;
  /** Span/correlation id when known; otherwise undefined */
  ctx?: Record<string, unknown>;
}

function emit({ level, msg, ctx }: LogPayload) {
  const line = JSON.stringify({
    t: new Date().toISOString(),
    level,
    msg,
    ...(ctx ?? {}),
  });
  // eslint-disable-next-line no-console
  if (level === "error") console.error(line);
  else console.log(line);
}

export const log = {
  debug: (msg: string, ctx?: Record<string, unknown>) =>
    emit({ level: "debug", msg, ctx }),
  info: (msg: string, ctx?: Record<string, unknown>) =>
    emit({ level: "info", msg, ctx }),
  warn: (msg: string, ctx?: Record<string, unknown>) =>
    emit({ level: "warn", msg, ctx }),
  error: (msg: string, ctx?: Record<string, unknown>) =>
    emit({ level: "error", msg, ctx }),
};

/**
 * Sentry-shaped capture surface. Today logs the error structurally; once
 * Sentry SDK ships in deps, swap the body for `Sentry.captureException`.
 * Keeping the call sites unchanged is the whole point of this indirection.
 */
export function captureException(
  err: unknown,
  context?: Record<string, unknown>,
) {
  const message = err instanceof Error ? err.message : String(err);
  const stack = err instanceof Error ? err.stack : undefined;
  log.error("captured_exception", { message, stack, ...context });
}

/**
 * Span timer — wraps an async operation, logs duration + outcome.
 * Use for slow operations (scraper run, OAuth callback, export job)
 * so you can profile them without an APM.
 */
export async function span<T>(
  name: string,
  fn: () => Promise<T>,
  ctx?: Record<string, unknown>,
): Promise<T> {
  const start = Date.now();
  try {
    const out = await fn();
    log.info(`${name}.done`, { ...ctx, durationMs: Date.now() - start });
    return out;
  } catch (err) {
    captureException(err, { span: name, ...ctx, durationMs: Date.now() - start });
    throw err;
  }
}
