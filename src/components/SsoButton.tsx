interface Props {
  provider: "google" | "microsoft";
  /** Always true today — SSO is on the roadmap, not yet wired.
   *  Prop kept for the day OAuth lands so the call sites don't change. */
  disabled?: boolean;
  onClick?: () => void;
}

/**
 * SSO sign-in button. Currently always disabled — Google + Microsoft OAuth
 * are on the roadmap (per PRD §7.3). Buttons are surfaced on the signin /
 * signup pages so CPAs can see the option exists; the "Coming soon" badge
 * sets honest expectations without asking them to click and discover the
 * dead end.
 *
 * Same OAuth surface will eventually back Method B inbound (§7.4).
 */
export function SsoButton({ provider, disabled = true, onClick }: Props) {
  const label = provider === "google" ? "Google" : "Microsoft";
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      title={
        disabled
          ? `Sign in with ${label} — coming soon`
          : `Sign in with ${label}`
      }
      aria-label={
        disabled
          ? `Sign in with ${label} (coming soon)`
          : `Sign in with ${label}`
      }
      className="relative flex items-center justify-center gap-2 px-3 py-2 rounded-md border border-line bg-surface text-sm text-ink-700 hover:bg-sunken disabled:opacity-60 disabled:cursor-not-allowed"
    >
      {provider === "google" ? <GoogleIcon /> : <MicrosoftIcon />}
      <span className="font-medium">{label}</span>
      {disabled && (
        <span className="absolute -top-1.5 -right-1 text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded-full bg-sunken text-ink-500 border border-line whitespace-nowrap">
          Soon
        </span>
      )}
    </button>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden>
      <path
        d="M21.6 12.227c0-.682-.06-1.34-.173-1.969H12v3.726h5.376a4.6 4.6 0 0 1-1.992 3.018v2.51h3.226c1.886-1.736 2.99-4.292 2.99-7.285Z"
        fill="#4285F4"
      />
      <path
        d="M12 22c2.7 0 4.962-.895 6.616-2.422l-3.227-2.51c-.894.6-2.038.954-3.39.954-2.605 0-4.81-1.76-5.598-4.123H3.066v2.59A9.999 9.999 0 0 0 12 22Z"
        fill="#34A853"
      />
      <path
        d="M6.402 13.9a6.005 6.005 0 0 1 0-3.8V7.51H3.066a10 10 0 0 0 0 8.98L6.402 13.9Z"
        fill="#FBBC04"
      />
      <path
        d="M12 5.977c1.469 0 2.787.504 3.823 1.495l2.864-2.864C16.957 3.005 14.696 2.001 12 2.001A9.999 9.999 0 0 0 3.066 7.51L6.402 10.1C7.19 7.736 9.395 5.977 12 5.977Z"
        fill="#EA4335"
      />
    </svg>
  );
}

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" aria-hidden>
      <rect x="2" y="2" width="9" height="9" fill="#F35325" />
      <rect x="13" y="2" width="9" height="9" fill="#81BC06" />
      <rect x="2" y="13" width="9" height="9" fill="#05A6F0" />
      <rect x="13" y="13" width="9" height="9" fill="#FFBA08" />
    </svg>
  );
}
