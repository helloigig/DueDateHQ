import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  BookOpen,
  ArrowUpRight,
  AlertTriangle,
  Sparkles,
} from "lucide-react";
import { useStore } from "../data/store";
import { useAllOpenInsights } from "../hooks/useAiInsights";

/**
 * Opportunities — Layer C firm-intelligence destination (PRD §4.4 Layer C),
 * surfaced under the user-facing label "Opportunities" in the sidebar so the
 * action is unambiguous: revenue or risk the AI noticed that a partner can
 * act on. The internal spec name "Insights" / "Layer C" stays in the code.
 *
 * The partner-retention thesis. Mode E + cohort substrate produce surfaces no
 * individual firm can build by hand: "this client is underbilled," "your Q3
 * is going to break capacity," "you've handled this edge case before."
 *
 * Three sections:
 *   1. Pricing intelligence — "$1,500 billed for Riverside, comparable LLCs $2,400"
 *   2. Capacity planning — "Q3 forecast: 18 days over capacity, hire by July"
 *   3. Firm brain — "every edge case the partner has handled, searchable"
 *
 * P2 surface; PRD §10.5. Wireframe: deterministic sample data, real
 * implementation reads cohort aggregates + per-firm history.
 */
export function Insights() {
  const { clients, deadlines, tasks } = useStore();
  const insights = useAllOpenInsights();

  const stats = useMemo(() => {
    const active = clients.filter((c) => c.status === "active");
    const open = deadlines.filter(
      (d) => d.status !== "completed" && d.status !== "filed_extension"
    );
    return {
      activeClients: active.length,
      openTasks: open.length,
      advisoryOpen: insights.length,
      tasksThisYear: tasks.length,
    };
  }, [clients, deadlines, tasks, insights]);

  return (
    <div className="max-w-6xl mx-auto px-4 md:px-6 py-6 space-y-6">
      <header>
        <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
          Opportunities
        </p>
        <h1 className="text-2xl font-semibold text-ink-900 mt-1">
          Revenue and risk the AI noticed
        </h1>
        <p className="text-sm text-ink-500 mt-2 max-w-2xl">
          Things you'd catch if you had time to read every prior return and
          benchmark every fee against the market. Pricing, capacity, and your
          own institutional knowledge — surfaced from your roster, your prior
          years, and anonymous cross-firm baselines.
        </p>
      </header>

      {/* Sticky in-page section nav. Four chips that jump to each section
          via fragment links + scroll-margin so the section header isn't
          obscured by the nav. Persists below the page header so a CPA
          scrolling Pricing → Capacity → Firm brain doesn't have to scroll
          back up to switch sections. */}
      <nav
        className="sticky top-0 z-10 -mx-4 md:-mx-6 px-4 md:px-6 py-2 bg-canvas/95 backdrop-blur-sm border-b border-line flex flex-wrap gap-1.5"
        aria-label="Page sections"
      >
        <SectionAnchor href="#pricing" label="Pricing" />
        <SectionAnchor href="#capacity" label="Capacity" />
        <SectionAnchor href="#firm-brain" label="Firm brain" />
        <SectionAnchor href="#benchmarks" label="Cross-firm benchmarks" />
      </nav>

      {/* Pricing intelligence */}
      <section
        id="pricing"
        className="bg-surface border border-line rounded-md overflow-hidden scroll-mt-20"
      >
        <header className="flex items-baseline px-5 py-3 border-b border-line bg-sunken/40 gap-2">
          <h2 className="text-sm font-semibold text-ink-900">
            Pricing intelligence
          </h2>
          <span className="text-2xs text-ink-500">
            cohort baselines
          </span>
        </header>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-ink-500">
            Comparable-client benchmarks. Each row shows what you billed vs.
            what comparable clients in your book paid. Outliers flagged for
            review.
          </p>

          <PricingRow
            client="Riverside Holdings LLC"
            entity="LLC"
            yourBill={1500}
            comparable={2400}
            hours={12}
            tone="under"
          />
          <PricingRow
            client="Pacific Ridge S-Corp"
            entity="S-Corp"
            yourBill={2200}
            comparable={2350}
            hours={9}
            tone="match"
          />
          <PricingRow
            client="Suncoast Advisors S-Corp"
            entity="S-Corp"
            yourBill={3100}
            comparable={2350}
            hours={8}
            tone="over"
          />
          <PricingRow
            client="Mark Sullivan"
            entity="Individual"
            yourBill={450}
            comparable={680}
            hours={3}
            tone="under"
          />

          <div className="pt-3 border-t border-line">
            <p className="text-xs text-ink-700">
              <span className="font-medium">Two clients underbilled by combined ~$1,400.</span>{" "}
              Worth a pricing conversation at next year's engagement letter.
            </p>
          </div>
        </div>
      </section>

      {/* Capacity planning */}
      <section
        id="capacity"
        className="bg-surface border border-line rounded-md overflow-hidden scroll-mt-20"
      >
        <header className="flex items-baseline px-5 py-3 border-b border-line bg-sunken/40 gap-2">
          <h2 className="text-sm font-semibold text-ink-900">
            Capacity planning
          </h2>
          <span className="text-2xs text-ink-500">
            workload forecast
          </span>
        </header>
        <div className="px-5 py-4 space-y-4">
          <div className="bg-warn-bg/40 border border-warn-border rounded p-4">
            <div className="flex items-baseline gap-2 mb-1.5">
              <AlertTriangle
                className="w-4 h-4 text-warn-ink shrink-0"
                aria-hidden
              />
              <h3 className="text-sm font-semibold text-warn-ink">
                Q1 2027 forecast: 18 days over capacity
              </h3>
            </div>
            <p className="text-xs text-warn-ink/90">
              Based on your {stats.activeClients} active clients' historical
              March workload + this year's pipeline, you'll be ~22% over your
              available billable capacity.
            </p>
            <ul className="text-xs text-warn-ink mt-2 space-y-1 list-disc pl-5">
              <li>
                Hire a senior preparer by{" "}
                <span className="font-medium">July 15</span> to onboard before
                busy season, or
              </li>
              <li>
                Stop accepting new individual returns starting{" "}
                <span className="font-medium">November</span>, or
              </li>
              <li>
                Decline the bottom-10% margin clients (~5 clients,{" "}
                <span className="font-medium">~$8K revenue / ~110 hours</span>{" "}
                — we'll surface candidates).
              </li>
            </ul>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <CapacityCard
              icon={<Calendar className="w-4 h-4" aria-hidden />}
              label="Peak month"
              value="March"
              detail="142% of average load"
            />
            <CapacityCard
              icon={<TrendingUp className="w-4 h-4" aria-hidden />}
              label="Off-peak"
              value="July-Aug"
              detail="64% of average load · capacity for advisory work"
            />
            <CapacityCard
              icon={<TrendingDown className="w-4 h-4" aria-hidden />}
              label="Bottom margin"
              value="5 clients"
              detail="~$8K revenue, ~110 hours · review for repricing or release"
            />
          </div>
        </div>
      </section>

      {/* Firm brain */}
      <section
        id="firm-brain"
        className="bg-surface border border-line rounded-md overflow-hidden scroll-mt-20"
      >
        <header className="flex items-baseline px-5 py-3 border-b border-line bg-sunken/40 gap-2">
          <h2 className="text-sm font-semibold text-ink-900">Firm brain</h2>
          <span className="text-2xs text-ink-500">
            institutional knowledge
          </span>
        </header>
        <div className="px-5 py-4 space-y-3">
          <p className="text-xs text-ink-500 max-w-2xl">
            Every edge case the partner has handled, captured and searchable.
            When a junior staffer encounters a similar situation in 5 years,
            AI surfaces the partner's prior decision and reasoning. The "CPA
            water cooler" — institutional knowledge that today lives only in
            conversation.
          </p>

          <input
            type="text"
            placeholder='Search firm decisions: "K-1 from a fund with passive activity loss carryover"'
            className="w-full px-3 py-2 rounded-md border border-line bg-surface text-sm placeholder:text-ink-400"
          />

          <div className="space-y-2 mt-3">
            <KnowledgeEntry
              question="K-1 from a fund-of-funds with PFIC inclusion"
              context="Apex Fund · 2024 tax year"
              decision="Election to mark-to-market under §1296. Filed Form 8621. Reasoning: the fund's Form K-1 disclosed PFIC investments; client's holding period >1 year; mark-to-market avoided the punitive default treatment."
              author="Sarah Mitchell · Mar 12, 2024"
            />
            <KnowledgeEntry
              question="State residency change mid-year — California to Texas"
              context="Mark Sullivan · 2023"
              decision="Filed CA part-year 540NR + TX no-tax. CA elected piggyback method (partial-year). Memo to file: client moved July 8, used FTB Pub 1100 worksheet for income allocation."
              author="Sarah Mitchell · Sep 4, 2023"
            />
            <KnowledgeEntry
              question="Multi-tier partnership cancellation of debt"
              context="Riverside Holdings LLC · 2022"
              decision="Filed Form 982 §108(a)(1)(B) insolvency exclusion. Documented insolvency calculation pre-cancellation. Reasoning: client's liabilities exceeded FMV of assets at cancellation date by $47K."
              author="Sarah Mitchell · Apr 22, 2022"
            />
          </div>

          <p className="text-2xs text-ink-400 italic mt-3">
            P2 surface — wireframe shows the pattern. Production pulls from
            activity timeline + manually-tagged decisions + AI extraction over
            email correspondence.
          </p>
        </div>
      </section>

      {/* Cross-firm benchmarks teaser */}
      <section
        id="benchmarks"
        className="bg-info-bg/30 border border-info-border rounded-md p-4 scroll-mt-20"
      >
        <div className="flex items-baseline gap-2 mb-1.5">
          <Sparkles className="w-3.5 h-3.5 text-info-ink shrink-0" aria-hidden />
          <h2 className="text-sm font-semibold text-info-ink">
            Cross-firm benchmarks coming
          </h2>
          <span className="text-2xs text-info-ink/70">
            once 100+ firms onboard
          </span>
        </div>
        <p className="text-xs text-info-ink/90">
          Once we serve 100+ firms, anonymized aggregates produce baselines no
          single firm can build: K-1 average arrival time across all firms,
          fee benchmarks by entity type and state, advisory close-rate norms.
          Opt-in only.
        </p>
        <Link
          to="/settings/integrations"
          className="text-xs text-info-ink hover:underline mt-2 inline-flex items-center gap-1"
        >
          Read the data-sharing posture <ArrowUpRight className="w-3 h-3" />
        </Link>
      </section>
    </div>
  );
}

function PricingRow({
  client,
  entity,
  yourBill,
  comparable,
  hours,
  tone,
}: {
  client: string;
  entity: string;
  yourBill: number;
  comparable: number;
  hours: number;
  tone: "under" | "match" | "over";
}) {
  const delta = yourBill - comparable;
  const deltaPct = Math.round((delta / comparable) * 100);
  const tones = {
    under: "text-danger-ink bg-danger-bg/30 border-danger-border",
    match: "text-ink-500 bg-sunken/40 border-line",
    over: "text-ok-ink bg-ok-bg/30 border-ok-border",
  };
  return (
    <div className="flex items-baseline gap-3 text-sm">
      <div className="flex-1 min-w-0">
        <p className="text-ink-900 font-medium truncate">{client}</p>
        <p className="text-2xs text-ink-500">
          {entity} · {hours}h billed
        </p>
      </div>
      <div className="text-right text-xs">
        <p className="text-ink-700 tabular-nums">
          ${yourBill.toLocaleString()} billed
        </p>
        <p className="text-2xs text-ink-500 tabular-nums">
          ${comparable.toLocaleString()} cohort avg
        </p>
      </div>
      <span
        className={`text-2xs uppercase tracking-wide px-2 py-0.5 rounded border tabular-nums ${tones[tone]}`}
      >
        {delta >= 0 ? "+" : ""}
        {deltaPct}%
      </span>
    </div>
  );
}

function CapacityCard({
  icon,
  label,
  value,
  detail,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  detail: string;
}) {
  return (
    <div className="border border-line rounded p-3 bg-surface">
      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-ink-500">{icon}</span>
        <span className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
          {label}
        </span>
      </div>
      <p className="text-base font-semibold text-ink-900">{value}</p>
      <p className="text-2xs text-ink-500 mt-1">{detail}</p>
    </div>
  );
}

function KnowledgeEntry({
  question,
  context,
  decision,
  author,
}: {
  question: string;
  context: string;
  decision: string;
  author: string;
}) {
  return (
    <article className="border border-line rounded p-3 bg-surface">
      <div className="flex items-baseline gap-2 mb-1">
        <BookOpen
          className="w-3 h-3 text-ink-400 mt-0.5 shrink-0"
          aria-hidden
        />
        <h4 className="text-sm font-medium text-ink-900">{question}</h4>
      </div>
      <p className="text-2xs text-ink-500 mb-1.5">{context}</p>
      <p className="text-xs text-ink-700">{decision}</p>
      <p className="text-2xs text-ink-400 italic mt-2">— {author}</p>
    </article>
  );
}

/**
 * Anchor pill in the sticky page nav. Renders an accessible <a> for
 * fragment navigation. Uses the URL hash, so deep-links work too.
 */
function SectionAnchor({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      className="text-2xs uppercase tracking-wide font-semibold px-2.5 py-1 rounded border border-line text-ink-500 hover:text-ink-900 hover:bg-sunken transition-colors"
    >
      {label}
    </a>
  );
}
