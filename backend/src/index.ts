import { serve } from "@hono/node-server";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { serveStatic } from "@hono/node-server/serve-static";
import { env } from "./env.js";
import { createContext } from "./trpc/context.js";
import { appRouter } from "./trpc/_app.js";
import {
  fromPostmark,
  fromSes,
  processInboundEmail,
} from "./lib/inbound-email.js";
import {
  fromPostmarkDelivery,
  fromResend,
  fromSesNotification,
  persistDeliveryEvent,
} from "./lib/delivery-webhooks.js";
import { handleCallback } from "./lib/oauth.js";
import { startScraperScheduler } from "./lib/scraper.js";
import { startExportWorker, ARTIFACT_DIR } from "./lib/export-worker.js";
import { startMethodBPoller } from "./lib/method-b-poller.js";
import { startQboSyncScheduler } from "./lib/sync/qbo.js";
import { log, captureException } from "./lib/observability.js";

const app = new Hono();

app.use("*", logger());

// CORS_ORIGIN supports three forms:
//   - "*"                   → echo every request origin (works w/ credentials)
//   - "https://example.com" → single origin
//   - "a.com,b.com,c.com"   → comma-separated allowlist
//
// Hono's `origin` callback runs per-request. We trim + filter empties so a
// stray comma or newline in the secret doesn't lock everyone out.
const corsAllowlist = env.CORS_ORIGIN.split(",")
  .map((o) => o.trim())
  .filter(Boolean);
const corsAllowAll = corsAllowlist.length === 1 && corsAllowlist[0] === "*";

app.use(
  "*",
  cors({
    origin: (origin) => {
      if (!origin) return "*";
      if (corsAllowAll) return origin;
      return corsAllowlist.includes(origin) ? origin : null;
    },
    credentials: true,
    allowHeaders: ["Authorization", "Content-Type"],
  }),
);

app.get("/health", (c) =>
  c.json({ ok: true, serverTime: new Date().toISOString() }),
);

// ───────── Inbound email webhook (Method A — PRD §7.7) ─────────
//
// Postmark / SES / Mailgun POST inbound parse here. The route adapter
// normalizes provider-specific JSON into the canonical InboundEmail
// shape, then processInboundEmail does the look-up + state transition.
//
// Auth: providers don't get a JWT, so we authenticate by webhook secret
// in the path (so the secret never appears in logs). Real production
// uses provider signature verification.
app.post("/api/inbound/email/postmark/:secret", async (c) => {
  const secret = c.req.param("secret");
  if (!secret || secret !== process.env.INBOUND_WEBHOOK_SECRET) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const body = await c.req.json();
    const normalized = fromPostmark(body);
    if (!normalized) {
      return c.json({ ok: false, error: "malformed" }, 400);
    }
    const result = await processInboundEmail(normalized);
    return c.json({ ok: true, matched: !!result, result });
  } catch (err) {
    captureException(err, { route: "/api/inbound/email/postmark" });
    return c.json({ ok: false, error: "internal" }, 500);
  }
});

// AWS SES inbound webhook (Method A — PRD §7.7 + v0.8 amendment §3.5).
// SES + SNS deliver inbound mail JSON; processInboundEmail runs the same
// 7-class classifier path as Postmark (per `feedback_unified_ai_surface`).
app.post("/api/inbound/email/ses/:secret", async (c) => {
  const secret = c.req.param("secret");
  if (!secret || secret !== process.env.INBOUND_WEBHOOK_SECRET) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const body = await c.req.json();
    const normalized = fromSes(body);
    if (!normalized) {
      return c.json({ ok: false, error: "malformed" }, 400);
    }
    const result = await processInboundEmail(normalized);
    return c.json({ ok: true, matched: !!result, result });
  } catch (err) {
    captureException(err, { route: "/api/inbound/email/ses" });
    return c.json({ ok: false, error: "internal" }, 500);
  }
});

// ───────── Delivery event webhooks (PRD §5.8) ─────────
//
// SES + Postmark POST bounce / complaint / delivery / open events here.
// Persists to delivery_events table; bounces surface as TodoItems via the
// todoItems router for the CPA to fix-address or suppress.
app.post("/api/delivery/postmark/:secret", async (c) => {
  const secret = c.req.param("secret");
  if (!secret || secret !== process.env.DELIVERY_WEBHOOK_SECRET) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const body = await c.req.json();
    const ev = fromPostmarkDelivery(body);
    if (!ev) {
      return c.json({ ok: false, error: "unrecognized_event_type" }, 400);
    }
    const result = await persistDeliveryEvent(ev);
    return c.json({ ok: result.ok, reason: result.reason });
  } catch (err) {
    captureException(err, { route: "/api/delivery/postmark" });
    return c.json({ ok: false, error: "internal" }, 500);
  }
});

app.post("/api/delivery/ses/:secret", async (c) => {
  const secret = c.req.param("secret");
  if (!secret || secret !== process.env.DELIVERY_WEBHOOK_SECRET) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const body = await c.req.json();
    const ev = fromSesNotification(body);
    if (!ev) {
      return c.json({ ok: false, error: "unrecognized_event_type" }, 400);
    }
    const result = await persistDeliveryEvent(ev);
    return c.json({ ok: result.ok, reason: result.reason });
  } catch (err) {
    captureException(err, { route: "/api/delivery/ses" });
    return c.json({ ok: false, error: "internal" }, 500);
  }
});

// Resend webhook (current outbound provider — see lib/email-out.ts).
// Resend tags emails with email_draft_id at send time so the bounce /
// complaint / delivered events route back to the right DeliveryEvent.
app.post("/api/delivery/resend/:secret", async (c) => {
  const secret = c.req.param("secret");
  if (!secret || secret !== process.env.DELIVERY_WEBHOOK_SECRET) {
    return c.json({ ok: false, error: "unauthorized" }, 401);
  }
  try {
    const body = await c.req.json();
    const ev = fromResend(body);
    if (!ev) {
      return c.json({ ok: false, error: "unrecognized_event_type" }, 400);
    }
    const result = await persistDeliveryEvent(ev);
    return c.json({ ok: result.ok, reason: result.reason });
  } catch (err) {
    captureException(err, { route: "/api/delivery/resend" });
    return c.json({ ok: false, error: "internal" }, 500);
  }
});

// ───────── OAuth callback ─────────
//
// All providers redirect here with code + state. We exchange and persist
// then bounce the user back to wherever they came from.
app.get("/oauth/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const error = c.req.query("error");

  if (error) {
    return c.html(
      `<html><body><script>window.close()</script>OAuth error: ${error}</body></html>`,
    );
  }
  if (!code || !state) {
    return c.json({ ok: false, error: "missing_code_or_state" }, 400);
  }
  try {
    const { redirectAfter } = await handleCallback(code, state);
    return c.redirect(redirectAfter);
  } catch (err) {
    captureException(err, { route: "/oauth/callback" });
    return c.json(
      { ok: false, error: err instanceof Error ? err.message : "internal" },
      400,
    );
  }
});

// ───────── Export artifact serving ─────────
//
// Workers write to ARTIFACT_DIR; we serve from /exports/* with the
// filename = exportRuns.id.<ext>. Real production uses Supabase Storage
// pre-signed URLs; for Phase 1 these files are short-lived and
// per-firm protected by a uuid filename.
app.use(
  "/exports/*",
  serveStatic({
    root: ARTIFACT_DIR.startsWith("/") ? ARTIFACT_DIR : `./${ARTIFACT_DIR}`,
    rewriteRequestPath: (path) => path.replace(/^\/exports/, ""),
  }),
);

// ───────── tRPC ─────────
app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (opts) => createContext(opts),
  }),
);

// ───────── Background workers ─────────
//
// These run in-process for Phase 1. Real production extracts them to
// separate processes (BullMQ workers + Cloudflare Worker scrapers).
// `unref()` ensures the process can still exit if the schedulers were
// the only things keeping it alive.
if (env.NODE_ENV !== "test") {
  startExportWorker();
  // Scraper interval — 1 hour by default. Set SCRAPER_DISABLED=1 in
  // dev when you don't want network calls on every server restart.
  if (process.env.SCRAPER_DISABLED !== "1") {
    startScraperScheduler();
  }
  // Method B poller — gated by env so dev runs don't burn quota
  // against the user's real Gmail. Production sets METHOD_B_ENABLED=1.
  if (process.env.METHOD_B_ENABLED === "1") {
    startMethodBPoller();
  }
  // QBO sync scheduler — gated by env so dev runs don't burn QBO
  // sandbox quota. Production sets QBO_SYNC_ENABLED=1. Walks every
  // connected QBO integration on a 30-minute cycle for incremental
  // sync; first-sync-after-connect runs immediately via the OAuth
  // callback path so the user sees clients populate without waiting.
  if (process.env.QBO_SYNC_ENABLED === "1") {
    startQboSyncScheduler();
  }
}

serve(
  {
    fetch: app.fetch,
    port: env.PORT,
    // Bind to 0.0.0.0 so Fly's proxy can reach the container. Without
    // this Hono defaults to localhost (::1 / 127.0.0.1) which Fly's
    // load balancer can't connect to → "not listening on expected
    // address" warning, requests time out at the edge.
    hostname: "0.0.0.0",
  },
  (info) => {
    log.info("backend.listening", {
      port: info.port,
      address: info.address,
      env: env.NODE_ENV,
      scraperDisabled: process.env.SCRAPER_DISABLED === "1",
    });
  },
);

export type { AppRouter } from "./trpc/_app.js";
