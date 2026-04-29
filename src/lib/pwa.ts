// PWA registration + install/push helpers.
//
// Service worker (public/sw.js) handles offline shell + Web Push for state-alert
// pushes (PRD §8.5 / arch §10.6). VAPID keys land when the real notification
// service is wired; for now subscribePush() stays a no-op stub so callers can
// wire the UI flow without waiting on the backend.

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined") return null;
  if (!("serviceWorker" in navigator)) return null;
  // Dev-mode skip — Vite serves modules in ways the SW gets in the way of HMR.
  if (import.meta.env.DEV) return null;
  try {
    const reg = await navigator.serviceWorker.register("/sw.js", { scope: "/" });
    return reg;
  } catch (err) {
    console.warn("[pwa] sw register failed", err);
    return null;
  }
}

export type InstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

let deferredPrompt: InstallPromptEvent | null = null;
const installListeners = new Set<(available: boolean) => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as InstallPromptEvent;
    installListeners.forEach((fn) => fn(true));
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installListeners.forEach((fn) => fn(false));
  });
}

export function isInstallAvailable(): boolean {
  return !!deferredPrompt;
}

export function onInstallAvailableChange(fn: (available: boolean) => void): () => void {
  installListeners.add(fn);
  return () => {
    installListeners.delete(fn);
  };
}

export async function promptInstall(): Promise<"accepted" | "dismissed" | "unavailable"> {
  if (!deferredPrompt) return "unavailable";
  await deferredPrompt.prompt();
  const choice = await deferredPrompt.userChoice;
  deferredPrompt = null;
  installListeners.forEach((fn) => fn(false));
  return choice.outcome;
}

export function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const mq = window.matchMedia("(display-mode: standalone)");
  // iOS-Safari uses navigator.standalone instead of the media query.
  const iosStandalone = (navigator as { standalone?: boolean }).standalone === true;
  return mq.matches || iosStandalone;
}

// Stub — wires up to a real /api/v1/push/subscribe endpoint when VAPID keys exist.
export async function subscribePush(): Promise<PushSubscription | null> {
  if (!("serviceWorker" in navigator) || !("PushManager" in window)) return null;
  const reg = await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  // Without VAPID keys we can't actually subscribe. Leave the call shape in
  // place so the UI can be tested; real subscription happens when the backend
  // exposes its public key.
  console.info("[pwa] push subscription deferred (awaiting VAPID public key)");
  return null;
}
