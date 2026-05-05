/**
 * OAuth 2.0 Authorization Code flow — provider-agnostic scaffolding.
 *
 * Covers QBO, Xero, Gmail, Outlook (P0.3 + P0.4 of the gap audit). Each
 * provider has a small config block; the rest of the flow (state token,
 * authorize URL build, callback exchange, token storage) is shared.
 *
 * What's REAL here:
 *   - Authorize URL generation with state token (CSRF protection)
 *   - Callback handler signature
 *   - Token persistence to the `integrations` table (existing)
 *   - Refresh-token-on-401 wrapper for downstream API calls
 *
 * What's STUBBED:
 *   - Per-provider sync logic (QBO customers → DueDateHQ clients, etc.)
 *     — these live in lib/sync/<provider>.ts when the OAuth keys ship
 *   - Token encryption at rest — schema stores `access_token` plaintext
 *     today; production should AES-GCM with KMS key (or Supabase Vault)
 *
 * Config: each provider needs `<PROVIDER>_CLIENT_ID`, `<PROVIDER>_CLIENT_SECRET`
 * env vars. Without them, `startConnect` returns a clear error rather
 * than a 500. See backend/.env.example for the full list.
 */

import { randomBytes } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { db } from "../db/client.js";
import { integrations } from "../db/schema.js";
import { log, captureException } from "./observability.js";
import { encryptToken, decryptToken } from "./encryption.js";

export type ProviderKind = "qbo" | "xero" | "gmail" | "outlook";

interface ProviderConfig {
  authorizeUrl: string;
  tokenUrl: string;
  /** Default scopes — caller can override for narrower grants */
  scopes: string[];
  /** Env var prefix; we read `<prefix>_CLIENT_ID` and `<prefix>_CLIENT_SECRET` */
  envPrefix: string;
}

const PROVIDERS: Record<ProviderKind, ProviderConfig> = {
  qbo: {
    authorizeUrl: "https://appcenter.intuit.com/connect/oauth2",
    tokenUrl: "https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer",
    scopes: ["com.intuit.quickbooks.accounting"],
    envPrefix: "QBO",
  },
  xero: {
    authorizeUrl: "https://login.xero.com/identity/connect/authorize",
    tokenUrl: "https://identity.xero.com/connect/token",
    scopes: [
      "openid",
      "profile",
      "email",
      "accounting.contacts",
      "accounting.transactions.read",
    ],
    envPrefix: "XERO",
  },
  gmail: {
    authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
    tokenUrl: "https://oauth2.googleapis.com/token",
    // Phase 2 (Method B): send + read. Read scope is required for the
    // Method B inbound poller — watching the user's inbox for client
    // emails so attachments route to checklist items WITHOUT requiring
    // the client to know the per-task forwarding address.
    // Pass `scopes: ["https://www.googleapis.com/auth/gmail.send"]` to
    // startConnect() to opt back to Phase 1 send-only.
    scopes: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
    ],
    envPrefix: "GMAIL",
  },
  outlook: {
    authorizeUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    // Phase 2 (Method B): send + read. Same logic as Gmail — Mail.Read
    // is required for inbound polling.
    scopes: ["offline_access", "Mail.Send", "Mail.Read"],
    envPrefix: "OUTLOOK",
  },
};

// In-memory state-token store. CSRF protection — the value the user is
// redirected back with must match what we issued. Real production puts
// this in Redis with a 10-minute TTL; for in-process use a Map + size
// cap that evicts oldest.
const stateTokens = new Map<string, { firmId: string; userId: string; provider: ProviderKind; createdAt: number }>();
const STATE_TTL_MS = 10 * 60 * 1000;

function evictExpired() {
  const now = Date.now();
  for (const [k, v] of stateTokens) {
    if (now - v.createdAt > STATE_TTL_MS) stateTokens.delete(k);
  }
  // Cap at 5000 entries to avoid leaks
  if (stateTokens.size > 5000) {
    const oldest = [...stateTokens.entries()].sort(
      (a, b) => a[1].createdAt - b[1].createdAt,
    );
    for (const [k] of oldest.slice(0, stateTokens.size - 5000)) {
      stateTokens.delete(k);
    }
  }
}

function configFor(provider: ProviderKind): {
  cfg: ProviderConfig;
  clientId: string;
  clientSecret: string;
} | null {
  const cfg = PROVIDERS[provider];
  const clientId = process.env[`${cfg.envPrefix}_CLIENT_ID`];
  const clientSecret = process.env[`${cfg.envPrefix}_CLIENT_SECRET`];
  if (!clientId || !clientSecret) return null;
  return { cfg, clientId, clientSecret };
}

export interface StartConnectInput {
  firmId: string;
  userId: string;
  provider: ProviderKind;
  /** The page the user came from — they return to it after callback */
  redirectAfter: string;
  /** Override scopes if you need narrower or broader grants */
  scopes?: string[];
}

export interface StartConnectResult {
  /** URL the FE opens in a popup or redirects to */
  authorizeUrl: string;
}

/**
 * Build the authorize URL + register the state token. The FE opens the
 * returned URL; the provider redirects back to `${BACKEND_URL}/oauth/callback`
 * with `code` + `state` query params. The callback handler exchanges the
 * code, stores the tokens, then redirects to `redirectAfter`.
 */
export function startConnect(
  input: StartConnectInput,
): StartConnectResult {
  evictExpired();
  const conf = configFor(input.provider);
  if (!conf) {
    throw new Error(
      `oauth_${input.provider}_not_configured — set ${PROVIDERS[input.provider].envPrefix}_CLIENT_ID and _CLIENT_SECRET in env`,
    );
  }
  const state = randomBytes(24).toString("base64url");
  stateTokens.set(state, {
    firmId: input.firmId,
    userId: input.userId,
    provider: input.provider,
    createdAt: Date.now(),
  });

  const url = new URL(conf.cfg.authorizeUrl);
  url.searchParams.set("client_id", conf.clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set(
    "redirect_uri",
    `${process.env.BACKEND_URL ?? "http://localhost:8000"}/oauth/callback`,
  );
  url.searchParams.set("state", state);
  url.searchParams.set(
    "scope",
    (input.scopes ?? conf.cfg.scopes).join(" "),
  );
  // Provider-specific quirks
  if (input.provider === "gmail") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
  }
  if (input.provider === "outlook") {
    url.searchParams.set("response_mode", "query");
  }
  // Stash redirectAfter in the state map (we want to bring the user
  // back to where they started)
  const stash = stateTokens.get(state)!;
  (stash as Record<string, unknown>).redirectAfter = input.redirectAfter;

  log.info("oauth.start", {
    firmId: input.firmId,
    provider: input.provider,
  });

  return { authorizeUrl: url.toString() };
}

interface TokenExchangeResult {
  accessToken: string;
  refreshToken: string | null;
  expiresIn: number; // seconds
  externalAccountId: string | null;
  scope: string | null;
}

/**
 * OAuth callback handler — call from the Hono GET /oauth/callback route.
 * Validates state, exchanges code for tokens, persists to integrations
 * table, returns the user to redirectAfter.
 */
export async function handleCallback(
  code: string,
  state: string,
): Promise<{ redirectAfter: string }> {
  const stash = stateTokens.get(state);
  if (!stash) throw new Error("oauth_state_invalid_or_expired");
  stateTokens.delete(state);

  const conf = configFor(stash.provider);
  if (!conf) throw new Error(`oauth_${stash.provider}_not_configured`);

  const tokens = await exchangeCode({
    tokenUrl: conf.cfg.tokenUrl,
    clientId: conf.clientId,
    clientSecret: conf.clientSecret,
    code,
  });

  // Persist — upsert by (firm_id, kind)
  const existing = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.firmId, stash.firmId),
      eq(integrations.kind, stash.provider),
    ),
  });
  const expiresAt = new Date(Date.now() + tokens.expiresIn * 1000);
  if (existing) {
    await db
      .update(integrations)
      .set({
        accessTokenCiphertext: encryptToken(tokens.accessToken),
        refreshTokenCiphertext: tokens.refreshToken
          ? encryptToken(tokens.refreshToken)
          : null,
        expiresAt,
        status: "connected",
        externalAccountId: tokens.externalAccountId,
        scope: tokens.scope,
        lastSyncedAt: null,
        lastError: null,
      })
      .where(eq(integrations.id, existing.id));
  } else {
    await db.insert(integrations).values({
      firmId: stash.firmId,
      kind: stash.provider,
      status: "connected",
      accessTokenCiphertext: encryptToken(tokens.accessToken),
      refreshTokenCiphertext: tokens.refreshToken
        ? encryptToken(tokens.refreshToken)
        : null,
      expiresAt,
      externalAccountId: tokens.externalAccountId,
      scope: tokens.scope,
    });
  }

  log.info("oauth.callback.success", {
    firmId: stash.firmId,
    provider: stash.provider,
  });

  // Kick off the first sync IMMEDIATELY after connect — but don't
  // block the redirect on it. The user wants to see "Connected!" fast,
  // then watch their clients populate. Fire-and-forget; failures are
  // captured and surfaced via integrations.lastError.
  if (stash.provider === "qbo") {
    void (async () => {
      try {
        const { syncFirm } = await import("./sync/qbo.js");
        await syncFirm(stash.firmId);
      } catch (err) {
        captureException(err, {
          firmId: stash.firmId,
          provider: stash.provider,
          ctx: "post_connect_initial_sync",
        });
      }
    })();
  }

  return {
    redirectAfter:
      ((stash as Record<string, unknown>).redirectAfter as string) ?? "/",
  };
}

async function exchangeCode(args: {
  tokenUrl: string;
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<TokenExchangeResult> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code: args.code,
    client_id: args.clientId,
    client_secret: args.clientSecret,
    redirect_uri: `${process.env.BACKEND_URL ?? "http://localhost:8000"}/oauth/callback`,
  });
  const res = await fetch(args.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body: body.toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`oauth_token_exchange_failed: ${res.status} ${text.slice(0, 200)}`);
  }
  const json = (await res.json()) as Record<string, unknown>;
  return {
    accessToken: String(json.access_token ?? ""),
    refreshToken: json.refresh_token ? String(json.refresh_token) : null,
    expiresIn: Number(json.expires_in ?? 3600),
    externalAccountId: json.realmId
      ? String(json.realmId)
      : json.tenant_id
        ? String(json.tenant_id)
        : null,
    scope: json.scope ? String(json.scope) : null,
  };
}

/**
 * Fetch a fresh access token for a connected integration. Refreshes
 * automatically when the stored token has <60s of life left or has
 * already expired.
 *
 * Use this from sync-logic call sites instead of reading
 * integrations.access_token directly.
 */
export async function getFreshAccessToken(
  firmId: string,
  provider: ProviderKind,
): Promise<string> {
  const row = await db.query.integrations.findFirst({
    where: and(
      eq(integrations.firmId, firmId),
      eq(integrations.kind, provider),
      eq(integrations.status, "connected"),
    ),
  });
  if (!row) throw new Error(`integration_not_connected:${provider}`);
  const accessToken = decryptToken(row.accessTokenCiphertext);
  if (!accessToken) throw new Error(`integration_missing_token:${provider}`);

  const margin = 60 * 1000;
  const expired =
    !row.expiresAt || row.expiresAt.getTime() - Date.now() < margin;
  if (!expired) return accessToken;
  const refreshToken = decryptToken(row.refreshTokenCiphertext);
  if (!refreshToken) {
    throw new Error(`integration_no_refresh_token:${provider}`);
  }

  const conf = configFor(provider);
  if (!conf) throw new Error(`oauth_${provider}_not_configured`);

  try {
    const body = new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: refreshToken,
      client_id: conf.clientId,
      client_secret: conf.clientSecret,
    });
    const res = await fetch(conf.cfg.tokenUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        Accept: "application/json",
      },
      body: body.toString(),
    });
    if (!res.ok) {
      throw new Error(`refresh_failed:${res.status}`);
    }
    const json = (await res.json()) as Record<string, unknown>;
    const newAccess = String(json.access_token ?? "");
    const newRefreshRaw = json.refresh_token
      ? String(json.refresh_token)
      : refreshToken;
    const expiresIn = Number(json.expires_in ?? 3600);
    await db
      .update(integrations)
      .set({
        accessTokenCiphertext: encryptToken(newAccess),
        refreshTokenCiphertext: encryptToken(newRefreshRaw),
        expiresAt: new Date(Date.now() + expiresIn * 1000),
      })
      .where(eq(integrations.id, row.id));
    return newAccess;
  } catch (err) {
    captureException(err, { firmId, provider });
    await db
      .update(integrations)
      .set({
        status: "error",
        lastError: err instanceof Error ? err.message : String(err),
      })
      .where(eq(integrations.id, row.id));
    throw err;
  }
}

/**
 * Returns true if the given provider has client credentials in env.
 * Used by the FE to render "Connect" vs "Coming soon" CTAs.
 */
export function isConfigured(provider: ProviderKind): boolean {
  return configFor(provider) !== null;
}
