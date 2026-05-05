import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  TrendingUp,
  TrendingDown,
  Calendar,
  BookOpen,
  ArrowUpRight,
  AlertTriangle,
  Globe,
  Sparkles,
  Gem,
  Users,
} from "lucide-react";
import { useStore } from "../data/store";
import { useAllOpenInsights, useResolveInsight } from "../hooks/useAiInsights";
import { PageContainer } from "../components/ui/PageContainer";

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
  const { clients, deadlines, tasks, checklistItems } = useStore();
  const insights = useAllOpenInsights();
  const resolveInsight = useResolveInsight();
  const clientsById = useMemo(() => {
    const m = new Map<string, (typeof clients)[number]>();
    for (const c of clients) m.set(c.id, c);
    return m;
  }, [clients]);

  // Mode E advisory triggers — typed RSU/salary/property/life-event signals
  // come from useAllOpenInsights. Currently insights all map to mode E in
  // the store; the title text carries the trigger type.
  const advisoryTriggers = insights;

  // Churn risk computation — clients with stuck reminders + premium tier or
  // long open task lists. Mirrors the spotlight logic in Clients.tsx so
  // signals are consistent across surfaces.
  const churnRisks = useMemo(() => {
    const taskClient = new Map<string, string>();
    for (const t of tasks) taskClient.set(t.id, t.clientId);
    const stuckByClient = new Map<string, number>();
    const now = Date.now();
    for (const ci of checklistItems) {
      const clientId = taskClient.get(ci.taskId);
      if (!clientId) continue;
      if (ci.state !== "requested_waiting") continue;
      if (!ci.lastReminderAt) continue;
      const days = Math.floor(
        (now - new Date(ci.lastReminderAt).getTime()) /
          (24 * 60 * 60 * 1000),
      );
      if (days >= 14) {
        stuckByClient.set(clientId, (stuckByClient.get(clientId) ?? 0) + 1);
      }
    }
    return clients
      .filter((c) => c.status === "active" && stuckByClient.has(c.id))
      .map((c) => ({
        client: c,
        stuckCount: stuckByClient.get(c.id) ?? 0,
      }))
      .sort((a, b) => b.stuckCount - a.stuckCount)
      .slice(0, 6);
  }, [clients, tasks, checklistItems]);

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
    <PageContainer variant="wide" className="space-y-card">
      <header>
        <p className="text-micro text-ink-500 flex items-center gap-2">
          Opportunities
          <span className="inline-flex items-center gap-1 text-2xs font-medium px-1.5 py-0.5 rounded-full border border-info-border bg-info-bg text-info-ink normal-case tracking-normal">
            <Sparkles className="w-3 h-3" aria-hidden />
            AI surfaced
          </span>
        </p>
        <h1 className="text-display font-semibold text-ink-900 mt-1 leading-7 tracking-[-0.01em]">
          Revenue and risk the AI noticed
        </h1>
        <p className="text-caption text-ink-500 mt-2 max-w-2xl">
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
        <SectionAnchor href="#advisory" label="Advisory triggers" />
        <SectionAnchor href="#churn" label="Churn risks" />
        <SectionAnchor href="#pricing" label="Pricing" />
        <SectionAnchor href="#capacity" label="Capacity" />
        <SectionAnchor href="#firm-brain" label="Firm brain" />
        <SectionAnchor href="#benchmarks" label="Cross-firm benchmarks" />
      </nav>

      {/* Advisory triggers — Group 1 per IA v0.7 §3.9. Pattern 4 (advisory
          awakening, PRD §2.7) is what gets the senior partner past month 3-6
          and into Layer B retention. The soft prompt at the bottom of the
          section is the Pattern 4 nudge from PRD §2.7 — explicit copy. */}
      <section
        id="advisory"
        className="bg-surface border border-line rounded-md overflow-hidden scroll-mt-20"
      >
        <header className="flex items-baseline px-5 py-3 border-b border-line bg-sunken/40 gap-2">
          <Gem className="w-4 h-4 text-info-ink shrink-0" aria-hidden />
          <h2 className="text-sm font-semibold text-ink-900">
            Advisory triggers
          </h2>
          <span className="text-2xs text-ink-500">Mode E · life events + revenue patterns</span>
          <span className="ml-auto text-2xs text-ink-500 tabular-nums">
            {advisoryTriggers.length} open
          </span>
        </header>
        <div className="px-5 py-4">
          {advisoryTriggers.length === 0 ? (
            <p className="text-xs text-ink-500">
              No advisory triggers right now. Mode E sweeps each client's
              multi-year history for life events (RSU vests, salary jumps,
              new properties) and surfaces them here when you have a few
              minutes to act.
            </p>
          ) : (
            <ul className="space-y-2">
              {advisoryTriggers.map((insight) => {
                const client = clientsById.get(insight.clientId);
                if (!client) return null;
                return (
                  <li
                    key={insight.id}
                    className="flex items-start gap-3 border border-line rounded p-3 bg-canvas"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-info-ink shrink-0 mt-0.5" aria-hidden />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap mb-0.5">
                        <Link
                          to={`/clients/${client.id}`}
                          className="text-sm font-medium text-ink-900 hover:underline"
                        >
                          {client.name}
                        </Link>
                        <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded border border-info-border bg-info-bg text-info-ink">
                          Mode {insight.mode}
                        </span>
                      </div>
                      <p className="text-sm text-ink-900">{insight.title}</p>
                      <p className="text-xs text-ink-500 mt-0.5">{insight.detail}</p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        <Link
                          to={`/clients/${client.id}`}
                          className="text-2xs px-2 py-0.5 rounded bg-indigo text-white hover:bg-indigo-hover"
                        >
                          Open client
                        </Link>
                        {insight.actions.includes("ask_client") && (
                          <button
                            onClick={() => resolveInsight(insight.id, "ask_client")}
                            className="text-2xs px-2 py-0.5 rounded border border-line text-ink-700 hover:bg-sunken"
                          >
                            Draft email
                          </button>
                        )}
                        <button
                          onClick={() => resolveInsight(insight.id, "mark_known")}
                          className="text-2xs px-2 py-0.5 rounded border border-line text-ink-500 hover:bg-sunken"
                        >
                          Mark known
                        </button>
                        <button
                          onClick={() => resolveInsight(insight.id, "snooze")}
                          className="text-2xs px-2 py-0.5 rounded border border-line text-ink-500 hover:bg-sunken"
                        >
                          Snooze 30d
                        </button>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
          {advisoryTriggers.length > 0 && (
            <p className="mt-4 pt-3 border-t border-line text-xs text-ink-500 italic">
              This is the kind of opportunity advisory work is built on — the
              cross-year pattern recognition that turns a preparer into an
              adviser.
            </p>
          )}
        </div>
      </section>

      {/* Churn risks — Group 2 per IA v0.7 §3.9. Stuck-reminder count is the
          loudest churn signal (response time slowing → relationship fade per
          PRD §2.5 JTBD). */}
      <section
        id="churn"
        className="bg-surface border border-line rounded-md overflow-hidden scroll-mt-20"
      >
        <header className="flex items-baseline px-5 py-3 border-b border-line bg-sunken/40 gap-2">
          <Users className="w-4 h-4 text-warn-ink shrink-0" aria-hidden />
          <h2 className="text-sm font-semibold text-ink-900">Churn risks</h2>
          <span className="text-2xs text-ink-500">stuck reminders &gt; 14 days</span>
          <span className="ml-auto text-2xs text-ink-500 tabular-nums">
            {churnRisks.length} flagged
          </span>
        </header>
        <div className="px-5 py-4">
          {churnRisks.length === 0 ? (
            <p className="text-xs text-ink-500">
              No clients flagged for churn. We watch reminder-staleness, declined
              advisory, and shrinking service mix; nothing's hit the threshold
              right now.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {churnRisks.map(({ client, stuckCount }) => (
                <li
                  key={client.id}
                  className="flex items-baseline gap-3 py-2.5 first:pt-0 last:pb-0"
                >
                  <Link
                    to={`/clients/${client.id}`}
                    className="text-sm font-medium text-ink-900 hover:underline flex-1 truncate"
                  >
                    {client.name}
                  </Link>
                  <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded border border-warn-border bg-warn-bg text-warn-ink tabular-nums">
                    {stuckCount} stuck
                  </span>
                  <Link
                    to={`/clients/${client.id}`}
                    className="text-2xs text-info-ink hover:underline"
                  >
                    Review →
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

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
              <span className="font-medium tabular-nums">Two clients underbilled by combined ~$1,400.</span>{" "}
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
            <p className="text-xs text-warn-ink/90 tabular-nums">
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
                <span className="font-medium tabular-nums">~$8K revenue / ~110 hours</span>{" "}
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
          <Globe className="w-3.5 h-3.5 text-info-ink shrink-0" aria-hidden />
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
    </PageContainer>
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
      <p className="text-base font-semibold text-ink-900 tabular-nums">{value}</p>
      <p className="text-2xs text-ink-500 mt-1 tabular-nums">{detail}</p>
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
