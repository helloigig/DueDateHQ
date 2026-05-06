import { useEffect, useState } from "react";
import { ArrowRight, ArrowLeft, X, Calendar, Bell, Sparkles, Check } from "lucide-react";

const STORAGE_KEY = "duedatehq.welcomeTour.dismissed.v1";

/**
 * First-run product orientation.
 *
 * Two-stage UX (revised after design critique — fullscreen modals on day-1
 * are interruption noise, not orientation):
 *
 *   1. INLINE BANNER — single-line, dismissible card above the queue. The
 *      default first-run experience. CPAs who land on the dashboard see
 *      their queue immediately; the banner offers a tour without blocking.
 *
 *   2. MODAL TOUR — three slides mapping to the three value lanes:
 *        Hook   — never miss an alert
 *        Core   — every client has a brain
 *        Moat   — AI flags, you decide
 *      Opens only when the CPA explicitly clicks "Take the tour".
 *
 * Either path (banner dismiss or modal completion) sets the localStorage
 * flag; the orientation never re-fires.
 */
export function WelcomeTour() {
  const [dismissed, setDismissed] = useState<boolean>(true);
  const [stage, setStage] = useState<"banner" | "modal">("banner");
  const [slide, setSlide] = useState(0);

  // Read storage in an effect to avoid hydration mismatches and to let the
  // session reset (sign out + sign in fresh) re-show the orientation for QA.
  useEffect(() => {
    if (typeof window === "undefined") return;
    setDismissed(localStorage.getItem(STORAGE_KEY) === "1");
  }, []);

  const persist = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  if (dismissed) return null;

  // ───────────────────────────────────────────────── BANNER stage
  if (stage === "banner") {
    return (
      <aside
        className="mb-card group bg-gradient-to-br from-info-bg/70 via-info-bg/55 to-info-bg/40 border border-info-border/70 rounded-md px-region py-region flex items-center gap-3 transition-shadow hover:shadow-pop"
        aria-label="Welcome"
      >
        <span
          aria-hidden
          className="w-9 h-9 rounded-md bg-info-bg border border-info-border/60 flex items-center justify-center text-info-ink shrink-0 shadow-[inset_0_-1px_0_rgba(29,78,216,0.06)]"
        >
          <Sparkles className="w-4 h-4" aria-hidden />
        </span>
        <div className="flex-1 min-w-0">
          <p className="text-2xs font-semibold uppercase tracking-wider text-info-ink/80">
            Welcome to DueDateHQ
          </p>
          <p className="text-sm text-ink-900 mt-0.5 leading-snug">
            <span className="font-medium">We surface what changed</span>
            <span className="text-ink-500">
              {" "}— state alerts, deadlines slipping past your buffer, clients
              who&apos;ve gone quiet.
            </span>
          </p>
        </div>
        <button
          onClick={() => setStage("modal")}
          className="text-xs font-medium text-info-ink hover:text-info-ink/80 inline-flex items-center gap-1 shrink-0 px-3 h-8 rounded-md bg-surface/70 border border-info-border/40 hover:bg-surface hover:border-info-border/80 transition-colors group/cta"
        >
          60-second tour
          <ArrowRight
            className="w-3 h-3 transition-transform group-hover/cta:translate-x-0.5"
            aria-hidden
          />
        </button>
        <button
          onClick={persist}
          className="text-ink-400 hover:text-ink-700 shrink-0 w-7 h-7 inline-flex items-center justify-center rounded-md hover:bg-info-bg/40 transition-colors"
          aria-label="Dismiss welcome banner"
        >
          <X className="w-3.5 h-3.5" aria-hidden />
        </button>
      </aside>
    );
  }

  // ───────────────────────────────────────────────── MODAL stage
  const slides = SLIDES;
  const current = slides[slide]!;
  const isLast = slide === slides.length - 1;

  const closeModal = () => {
    persist();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome tour"
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-[2px] p-4 animate-in fade-in duration-200"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div className="relative bg-surface border border-line rounded-lg shadow-overlay w-full max-w-lg overflow-hidden animate-in zoom-in-95 fade-in duration-200">
        <button
          onClick={closeModal}
          className="absolute top-3 right-3 z-10 w-7 h-7 inline-flex items-center justify-center rounded-md text-ink-400 hover:text-ink-700 hover:bg-sunken/60 transition-colors"
          aria-label="Close tour"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Hero visual zone — soft gradient panel that frames the slide
            illustration. The gradient anchors the slide rhythm so each
            of the three slides feels like one chapter of one book. */}
        <div className="bg-gradient-to-br from-canvas via-sunken/40 to-canvas border-b border-line h-52 sm:h-60 flex items-center justify-center px-6">
          {current.visual}
        </div>

        <div className="px-region py-card">
          <p className="text-2xs font-semibold uppercase tracking-wider text-indigo-ink">
            {current.eyebrow}
          </p>
          <h2 className="text-xl font-semibold text-ink-900 mt-1.5 leading-snug">
            {current.title}
          </h2>
          <p className="text-sm text-ink-500 mt-2 leading-relaxed">
            {current.body}
          </p>

          <div className="flex items-center justify-between mt-card pt-region border-t border-line">
            <div className="flex gap-1.5 items-center" aria-label="Tour progress">
              {slides.map((_, i) => (
                <span
                  key={i}
                  className={[
                    "h-1.5 rounded-full transition-all duration-200",
                    i === slide
                      ? "w-6 bg-indigo"
                      : i < slide
                        ? "w-1.5 bg-ink-700"
                        : "w-1.5 bg-ink-300",
                  ].join(" ")}
                />
              ))}
              <span className="ml-2 text-2xs text-ink-500 tabular-nums">
                {slide + 1} of {slides.length}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {slide > 0 && (
                <button
                  onClick={() => setSlide((s) => Math.max(0, s - 1))}
                  className="text-xs h-9 px-3 rounded-md text-ink-700 hover:bg-sunken font-medium inline-flex items-center gap-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
                >
                  <ArrowLeft className="w-3.5 h-3.5" aria-hidden /> Back
                </button>
              )}
              <button
                onClick={isLast ? closeModal : () => setSlide((s) => s + 1)}
                className="text-sm h-9 px-4 rounded-md bg-indigo text-white hover:bg-indigo-hover font-medium inline-flex items-center gap-1.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo focus-visible:ring-offset-2"
              >
                {isLast ? "Got it" : "Next"}
                {!isLast && <ArrowRight className="w-3.5 h-3.5" aria-hidden />}
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
              California Franchise Tax Board extends Q1 estimated tax payment to June 17
            </p>
            <p className="text-warn-ink/80 mt-0.5">
              Affects 14 of your clients · 4 hours ago · California Franchise Tax Board Public Advisory
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
              <Check className="w-3 h-3 text-ok-ink" aria-hidden />
            </div>
            <div className="flex justify-between text-2xs">
              <span className="text-ink-500">PTET election — yes (CA)</span>
              <span className="text-ink-700 tabular-nums">$24K</span>
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
              <span className="font-medium">A flag for your review.</span> Your
              call.
            </span>
          </div>
          <p className="text-xs text-ink-700">
            <span className="font-medium text-ink-900">Emily Tan</span> · 1040
            Personal
          </p>
          <p className="text-2xs text-ink-500 mt-0.5">
            W-2 received. Matched to your &quot;Income — W-2&quot; checklist row.
          </p>
          <div className="flex gap-2 mt-2.5">
            <button className="text-2xs px-2 py-1 rounded bg-indigo text-white">
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
