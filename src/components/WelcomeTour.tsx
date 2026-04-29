import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, X, Calendar, Bell, Sparkles } from "lucide-react";

const STORAGE_KEY = "duedatehq.welcomeTour.dismissed.v1";

/**
 * First-run product tour — three full-bleed slides shown once on the first
 * dashboard visit, then never again (persisted in localStorage). Pattern is
 * Linear's onboarding tour / Notion's first-time hints / Stripe's welcome
 * modal — calm, dismissible, single CTA per slide.
 *
 * The three slides map to the three value lanes:
 *   1. Hook — "Never miss a state alert or deadline"
 *   2. Core — "Every client has a brain that knows their context"
 *   3. Moat — "AI flags, you decide"
 *
 * Visuals are CSS-only mockups (not screenshots) — they refresh themselves
 * if the design changes, no asset pipeline. Dark sans + Substack-clean type.
 */
export function WelcomeTour() {
  const [dismissed, setDismissed] = useState<boolean>(true);
  const [slide, setSlide] = useState(0);

  // Read storage in an effect to avoid hydration mismatches and to let the
  // session reset (sign out + sign in fresh) re-show the tour for QA.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const close = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  const slides = SLIDES;
  const current = slides[slide]!;
  const isLast = slide === slides.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 p-4"
      onMouseDown={(e) => {
        // Click outside to dismiss — explicit, the user committed
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="bg-surface border border-line rounded-lg shadow-overlay w-full max-w-lg overflow-hidden">
        <button
          onClick={close}
          className="absolute top-3 right-3 text-ink-400 hover:text-ink-900 p-1 rounded"
          aria-label="Close tour"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Visual mockup area — CSS only, no image asset */}
        <div className="bg-canvas border-b border-line h-48 sm:h-56 flex items-center justify-center px-6">
          {current.visual}
        </div>

        <div className="px-6 py-5">
          <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
            {current.eyebrow}
          </p>
          <h2 className="text-xl font-semibold text-ink-900 mt-1">
            {current.title}
          </h2>
          <p className="text-sm text-ink-500 mt-2 leading-relaxed">
            {current.body}
          </p>

          {/* Footer — progress + nav */}
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-line">
            <div className="flex gap-1.5" aria-label="Tour progress">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={[
                    "w-1.5 h-1.5 rounded-full transition-colors",
                    i === slide ? "bg-ink-900" : "bg-ink-300",
                  ].join(" ")}
                />
              ))}
            </div>
            <div className="flex items-center gap-2">
              {slide > 0 && (
                <button
                  onClick={() => setSlide((s) => Math.max(0, s - 1))}
                  className="text-xs px-3 py-1.5 rounded text-ink-500 hover:bg-sunken inline-flex items-center gap-1"
                >
                  <ArrowLeft className="w-3 h-3" aria-hidden /> Back
                </button>
              )}
              <button
                onClick={isLast ? close : () => setSlide((s) => s + 1)}
                className="text-sm px-4 py-1.5 rounded bg-accent text-canvas hover:bg-accent-hover inline-flex items-center gap-1.5"
              >
                {isLast ? "Got it" : "Next"}
                {!isLast && <ArrowRight className="w-3 h-3" aria-hidden />}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

interface Slide {
  eyebrow: string;
  title: string;
  body: string;
  visual: React.ReactNode;
}

const SLIDES: ReadonlyArray<Slide> = [
  {
    eyebrow: "Hook",
    title: "Never miss a state alert or deadline",
    body: "Every IRS notice, every state extension, every form change — surfaced within 24 hours of the official announcement. We trace the source and tell you which clients are affected.",
    visual: (
      <div className="w-full max-w-sm">
        <div className="bg-warn-bg border border-warn-border rounded-md p-3 flex items-start gap-2 shadow-sm">
          <Bell className="w-4 h-4 text-warn-ink shrink-0 mt-0.5" aria-hidden />
          <div className="text-xs">
            <p className="font-semibold text-warn-ink">
              CA FTB extends Q1 estimated tax payment to June 17
            </p>
            <p className="text-warn-ink/80 mt-0.5">
              Affects 14 of your clients · 4 hours ago · CA FTB Public Advisory
            </p>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <div className="flex-1 h-2 rounded-full bg-line" />
          <div className="flex-1 h-2 rounded-full bg-line" />
          <div className="flex-1 h-2 rounded-full bg-sunken" />
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Core",
    title: "Every client has a brain that knows their context",
    body: "Three years of prior returns, every K-1 quirk, every conversation — searchable on the client's page. New staff onboard in days, not weeks. Hand-offs happen without the 30-minute call.",
    visual: (
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-line rounded-md p-3 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-line">
            <span className="w-7 h-7 rounded-full bg-accent text-canvas text-2xs font-semibold flex items-center justify-center">
              RH
            </span>
            <span className="text-sm font-medium text-ink-900">
              Riverside Holdings LLC
            </span>
          </div>
          <div className="space-y-1.5 mt-2.5">
            <div className="flex justify-between text-2xs">
              <span className="text-ink-500">2024 Form 1065 — filed</span>
              <span className="text-ok-ink">✓</span>
            </div>
            <div className="flex justify-between text-2xs">
              <span className="text-ink-500">PTET election — yes (CA)</span>
              <span className="text-ink-700 font-mono">$24K</span>
            </div>
            <div className="flex justify-between text-2xs">
              <span className="text-ink-500">K-1 from Apex Fund — PFIC</span>
              <span className="text-ink-700 font-mono">§1296</span>
            </div>
          </div>
        </div>
      </div>
    ),
  },
  {
    eyebrow: "Moat",
    title: "AI flags, you decide",
    body: "The system suggests; you confirm. Every classification, every chase email, every advisory opportunity is reviewable. We never auto-confirm a checklist item — your click is the only way it advances.",
    visual: (
      <div className="w-full max-w-sm">
        <div className="bg-surface border border-line rounded-md p-3 shadow-sm">
          <div className="text-2xs text-info-ink bg-info-bg/40 border border-info-border rounded px-2 py-1 mb-2 flex items-start gap-1.5">
            <Sparkles className="w-3 h-3 shrink-0 mt-0.5" aria-hidden />
            <span>
              <span className="font-medium">AI noticed something.</span> Your
              call.
            </span>
          </div>
          <p className="text-xs text-ink-700">
            <span className="font-medium text-ink-900">Emily Tan</span> · 1040
            Personal
          </p>
          <p className="text-2xs text-ink-500 mt-0.5">
            W-2 received. AI matched it to your "Income — W-2" checklist row.
          </p>
          <div className="flex gap-2 mt-2.5">
            <button className="text-2xs px-2 py-1 rounded bg-accent text-canvas">
              Confirm
            </button>
            <button className="text-2xs px-2 py-1 rounded border border-line text-ink-500">
              Flag for review
            </button>
          </div>
        </div>
        <p className="text-2xs text-ink-400 italic mt-2 flex items-center gap-1">
          <Calendar className="w-3 h-3" aria-hidden /> Decisions like this stay
          in the audit trail forever.
        </p>
      </div>
    ),
  },
];
