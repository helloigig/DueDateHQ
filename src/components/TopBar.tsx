import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Search, UserPlus, Upload, LogOut, FilePlus } from "lucide-react";
import { AddClientModal } from "./AddClientModal";
import { BellDropdown } from "./BellDropdown";
import { CommandPaletteStub } from "./CommandPaletteStub";
import { signOut, useSession } from "../data/session";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";
import { Button } from "./ui/button";
import { Avatar } from "./ui/Avatar";

export function TopBar() {
  const [modal, setModal] = useState<"client" | null>(null);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const navigate = useNavigate();
  const session = useSession();

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
      <div className="flex-1 max-w-md">
        <button
          onClick={() => setPaletteOpen(true)}
          title="Search (⌘K)"
          className="w-full flex items-center gap-2 px-3 py-1.5 rounded-md bg-sunken text-ink-500 text-sm hover:bg-sunken/70 hover:text-ink-700 transition-colors"
        >
          <Search className="w-4 h-4 shrink-0" aria-hidden />
          <span className="flex-1 text-left truncate">
            <span className="hidden sm:inline">
              Search clients, deadlines, alerts
            </span>
            <span className="sm:hidden">Search</span>
          </span>
          <kbd className="ml-auto hidden sm:inline text-2xs text-ink-400 font-mono border border-line rounded px-1 py-0.5">
            ⌘K
          </kbd>
        </button>
      </div>

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

      <TrialBadge />
      <BellDropdown />

      <div className="flex items-center gap-2 pl-2 border-l border-line">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              className="flex items-center gap-2 px-1 py-1 rounded hover:bg-sunken"
              aria-label="Open user menu"
            >
              <Avatar
                size="md"
                tone="primary"
                initials={session?.userInitials || "SC"}
                name={session?.userName || "Sarah Chen"}
              />
              <span className="hidden lg:inline text-sm text-ink-700 whitespace-nowrap">
                {session?.userName || "Sarah Chen"}
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="px-3 py-2 border-b border-line">
              <div className="text-sm font-medium text-ink-900 truncate">
                {session?.userName}
              </div>
              <div className="text-2xs text-ink-500 truncate">
                {session?.userEmail}
              </div>
            </div>
            <DropdownMenuItem onSelect={() => navigate("/settings")}>
              Settings
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                // signOut() handles everything: clear Supabase, clear
                // local session, hard-reload to /login. We do NOT call
                // navigate() here — that would render /login mid-flight
                // (with stale React state) and crash before the reload
                // fires, which the user experiences as a frozen page.
                void signOut();
              }}
            >
              <LogOut className="w-3.5 h-3.5 text-ink-500" aria-hidden />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <AddClientModal open={modal === "client"} onClose={() => setModal(null)} />
      <CommandPaletteStub open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </header>
  );
}

/**
 * Calm trial pill in the top bar. Three states:
 *
 *   - "Pro trial · 28 days left" (info-tone, days > 5)
 *   - "Pro trial · 3 days left"  (warn-tone, days ≤ 5)
 *   - "Trial ended — pick a plan" (danger-tone, expired)
 *
 * Click → /settings/billing. Hidden once the user picks a paid plan
 * (when trialEndsAt is cleared and tier is solo/pro/team with a billing
 * subscription — currently we just check trialEndsAt presence).
 */
function TrialBadge() {
  const session = useSession();
  const status = useMemo(() => {
    if (!session?.trialEndsAt) return null;
    const ms = new Date(session.trialEndsAt).getTime() - Date.now();
    const days = Math.ceil(ms / (24 * 60 * 60 * 1000));
    if (days <= 0) return { tone: "danger" as const, label: "Trial ended — pick a plan" };
    if (days <= 5) return { tone: "warn" as const, label: `Pro trial · ${days} day${days === 1 ? "" : "s"} left` };
    return { tone: "neutral" as const, label: `Pro trial · ${days} days left` };
  }, [session?.trialEndsAt]);

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
