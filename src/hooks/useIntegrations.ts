/**
 * Integrations — QBO / Xero / Gmail / Outlook / Stripe.
 *
 * `useStartConnect` opens the BE-issued authorize URL in a popup.
 * After the provider redirects back to /oauth/callback, the BE
 * persists tokens; this window polls integrations.list until the
 * row flips status='connected'.
 *
 * `useIntegrationCatalog` returns which providers have BE client
 * credentials configured — the FE renders Connect vs Coming soon
 * based on it.
 */
import { useEffect, useState } from "react";
import { trpc } from "../lib/api/client";

export function useIntegrations() {
  return trpc.integrations.list.useQuery(undefined, {
    refetchInterval: 30_000,
  });
}

export function useIntegrationCatalog() {
  return trpc.integrations.catalog.useQuery();
}

export function useStartConnect() {
  const utils = trpc.useUtils();
  const mutation = trpc.integrations.startConnect.useMutation({
    onSuccess: ({ authorizeUrl }) => {
      // Open the OAuth popup. Most providers reject iframes, so we
      // open in a real window that the user explicitly closes.
      const popup = window.open(
        authorizeUrl,
        "oauth-connect",
        "width=520,height=700,popup=1",
      );
      if (!popup) {
        // Fallback when popups are blocked — full-window redirect.
        window.location.assign(authorizeUrl);
        return;
      }
      // Refetch the integrations list after the popup likely closed
      // (we can't observe the popup directly across origins). Polling
      // covers the gap; once status flips to 'connected' the cards
      // render the success state.
      const start = Date.now();
      const poll = setInterval(() => {
        if (Date.now() - start > 5 * 60 * 1000) {
          clearInterval(poll);
          return;
        }
        if (popup.closed) {
          clearInterval(poll);
        }
        void utils.integrations.list.invalidate();
      }, 3_000);
    },
  });
  return mutation;
}

export function useDisconnect() {
  const utils = trpc.useUtils();
  return trpc.integrations.disconnect.useMutation({
    onSuccess: () => {
      void utils.integrations.list.invalidate();
    },
  });
}

/**
 * Listens for the OAuth callback's postMessage (when the BE wraps the
 * callback in a small HTML page that posts back to opener). Falls back
 * to the polling approach above when no message is received.
 */
export function useOAuthCallbackBridge() {
  const utils = trpc.useUtils();
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "ddhq.oauth.connected") {
        setLastEvent(e.data?.kind ?? "ok");
        void utils.integrations.list.invalidate();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [utils]);
  return lastEvent;
}
