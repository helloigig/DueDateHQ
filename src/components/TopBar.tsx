import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, UserPlus, Upload, FilePlus } from "lucide-react";
import { AddClientModal } from "./AddClientModal";
import { BellDropdown } from "./BellDropdown";
import { CommandPaletteStub } from "./CommandPaletteStub";
import { useSession } from "../data/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";

export function TopBar() {
  const [modal, setModal] = useState<"client" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setPaletteOpen(true);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <header className="h-14 shrink-0 bg-surface border-b border-line flex items-center gap-3 px-5">
      {/* Three-zone topbar: spacer / centered search / action cluster.
          Yuqi audit 2026-05-05 — search was left-pinned at 288px which
          made it feel like a sidebar prop, not a primary nav move. The
          topbar's loudest interaction is search, so it earns center
          stage. The right cluster carries identity (plan badge),
          create-action (+New), and notifications (bell). Order swap:
          plan badge moved LEFT of +New so the action sits closest to
          the bell (the two attention-takers cluster). */}
      <div className="flex-1 min-w-0" />
      <div className="w-full max-w-md shrink min-w-0">
        <button
          onClick={() => setPaletteOpen(true)}
          title="Search (⌘K)"
          aria-label="Search (Cmd+K)"
          className="
            group w-full h-9 flex items-center gap-2.5 px-3
            rounded-md bg-surface
            border border-line hover:border-line-strong
            transition-colors
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-soft focus-visible:border-indigo
          "
        >
          <Search
            className="w-4 h-4 shrink-0 text-ink-400 group-hover:text-ink-500 transition-colors"
            aria-hidden
          />
          {/* Scope copy uses the canonical sidebar destination names —
              "Today, Clients, Alerts, Mail" — so the user trains on
              one vocabulary across nav + search. Don't drift to
              synonyms ("inbox", "deadlines", "feed") here. */}
          <span className="flex-1 text-left text-sm text-ink-500 truncate">
            <span className="hidden sm:inline">
              Search Today, Clients, Alerts, Mail…
            </span>
            <span className="sm:hidden">Search</span>
          </span>
          <kbd
            className="
              hidden sm:inline-flex items-center gap-0.5 shrink-0
              text-2xs font-medium text-ink-500 font-mono
              bg-sunken border border-line rounded px-1.5 py-0.5
            "
          >
            ⌘K
          </kbd>
        </button>
      </div>
      <div className="flex-1 min-w-0 flex items-center justify-end gap-3">
        <TrialBadge />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button className="shrink-0">+ New</Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => setModal("client")}>
              <UserPlus className="w-4 h-4 text-ink-500" aria-hidden />
              <span className="flex-1">New client</span>
              <span className="text-2xs text-ink-400">~2 min</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => navigate("/clients")}
              title="Pick a client first, then add a task on their page"
            >
              <FilePlus className="w-4 h-4 text-ink-500" aria-hidden />
              <span className="flex-1">New task</span>
              <span className="text-2xs text-ink-400">via client</span>
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => navigate("/import")}>
              <Upload className="w-4 h-4 text-ink-500" aria-hidden />
              <span className="flex-1">Upload clients (CSV)</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <p className="px-3 py-1.5 text-2xs text-ink-400">
              Tasks belong to a client. Open the client first, then add a deadline.
            </p>
          </DropdownMenuContent>
        </DropdownMenu>

        <BellDropdown />
      </div>

      {/* Account entrance lives in the Sidebar bottom-left (Linear/Notion
          convention). Avatar + dropdown removed from here so there's a
          single account surface; if you need it back, see <Sidebar>. */}

      <AddClientModal open={modal === "client"} onClose={() => setModal(null)} />
      <CommandPaletteStub open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}

/**
 * Plan / trial pill in the top bar. Five states:
 *
 *   - "Solo plan" / "Pro plan" / "Team plan"        (neutral, paid + no trial)
 *   - "Solo · 28-day trial"  (neutral, days > 5, plan name from session.tier)
 *   - "Solo · 3-day trial"   (warn-tone, days ≤ 5)
 *   - "Trial ended — pick a plan"                  (danger-tone, expired)
 *
 * Yuqi audit 2026-05-05 — was hardcoded "Pro trial · X days left" even
 * for Solo accounts (the tier was on session, just unread). Now reads
 * session.tier so the badge matches the plan the user actually chose.
 *
 * Click → /settings/billing. Always rendered when a session exists so
 * the user can see their plan tier at a glance — not just during trial.
 */
function TrialBadge() {
  const session = useSession();
  const status = useMemo(() => {
    if (!session) return null;
    const planName =
      session.tier === "solo"
        ? "Solo"
        : session.tier === "pro"
          ? "Pro"
          : session.tier === "team"
            ? "Team"
            : "Solo";
    if (!session.trialEndsAt) {
      return { tone: "neutral" as const, label: `${planName} plan` };
    }
    const ms = new Date(session.trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    if (days <= 0) return { tone: "danger" as const, label: "Trial ended — pick a plan" };
    if (days <= 5) return { tone: "warn" as const, label: `${planName} · ${days}-day trial` };
    return { tone: "neutral" as const, label: `${planName} · ${days}-day trial` };
  }, [session]);

  if (!status) return null;
  // The default state uses sunken-tone neutral, NOT info-blue. Info-blue
  // is reserved for AI-decided surfaces (AdvisoryPeek, "AI noticed"
  // banner) — overloading it on the trial pill made every info-toned
  // thing on screen feel like the same kind of signal.
  // Warn + danger keep their tones — those are real alerts.
  const toneClass =
    status.tone === "danger"
      ? "bg-danger-bg text-danger-ink border-danger-border hover:border-danger-ink"
      : status.tone === "warn"
        ? "bg-warn-bg text-warn-ink border-warn-border hover:border-warn-ink"
        : "bg-sunken text-ink-700 border-line hover:border-ink-400 hover:text-ink-900";

  return (
    <Link
      to="/settings/billing"
      className={`hidden lg:inline-flex items-center text-2xs font-medium px-2 py-1 rounded border transition-colors whitespace-nowrap shrink-0 ${toneClass}`}
      title="Trial details — Settings → Billing"
    >
      {status.label}
    </Link>
  );
}
