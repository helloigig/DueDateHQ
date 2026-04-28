import { useEffect, useMemo, useState } from "react";
import { Search, Users, FileText, Bell, Settings, Plus, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useModalDialog } from "../hooks/useModalDialog";
import { useStore } from "../data/store";

interface Props {
  open: boolean;
  onClose: () => void;
}

interface Result {
  id: string;
  label: string;
  hint?: string;
  href: string;
  group: "clients" | "tasks" | "alerts" | "navigate" | "settings";
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_RESULTS: Result[] = [
  { id: "nav-dash", label: "Dashboard", href: "/", group: "navigate", icon: Sparkles },
  { id: "nav-clients", label: "Clients", href: "/clients", group: "navigate", icon: Users },
  { id: "nav-alerts", label: "Alerts feed", href: "/announcements", group: "navigate", icon: Bell },
  { id: "nav-import", label: "Import roster", href: "/import", group: "navigate", icon: Plus },
  { id: "nav-firm", label: "Settings · Firm", href: "/settings/firm", group: "settings", icon: Settings },
  { id: "nav-team", label: "Settings · Team", href: "/settings/team", group: "settings", icon: Settings },
  { id: "nav-pkgs", label: "Settings · Service Packages", href: "/settings/packages", group: "settings", icon: Settings },
  { id: "nav-rems", label: "Settings · Reminder Templates", href: "/settings/reminders", group: "settings", icon: Settings },
  { id: "nav-int", label: "Settings · Integrations", href: "/settings/integrations", group: "settings", icon: Settings },
  { id: "nav-bill", label: "Settings · Billing", href: "/settings/billing", group: "settings", icon: Settings },
];

export function CommandPaletteStub({ open, onClose }: Props) {
  const dialogRef = useModalDialog(open, onClose);
  const navigate = useNavigate();
  const { clients, tasks, announcements } = useStore();
  const [query, setQuery] = useState("");
  const [activeIdx, setActiveIdx] = useState(0);

  // Reset query each time the palette opens
  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIdx(0);
    }
  }, [open]);

  const results = useMemo<Result[]>(() => {
    const q = query.trim().toLowerCase();
    if (!q) return NAV_RESULTS.slice(0, 6);

    const matches: Result[] = [];

    // Clients
    for (const c of clients) {
      if (c.name.toLowerCase().includes(q) || c.contactEmail.toLowerCase().includes(q)) {
        matches.push({
          id: `c-${c.id}`,
          label: c.name,
          hint: `${c.entityType} · ${c.primaryState}`,
          href: `/clients/${c.id}`,
          group: "clients",
          icon: Users,
        });
        if (matches.length >= 25) break;
      }
    }

    // Tasks (form name)
    for (const t of tasks) {
      if (t.formType.toLowerCase().includes(q)) {
        const client = clients.find((c) => c.id === t.clientId);
        if (!client) continue;
        matches.push({
          id: `t-${t.id}`,
          label: `${t.formType} · ${client.name}`,
          hint: `Due ${t.officialDueDate}`,
          href: `/clients/${client.id}/tasks/${t.id}`,
          group: "tasks",
          icon: FileText,
        });
        if (matches.length >= 35) break;
      }
    }

    // Alerts
    for (const a of announcements) {
      if (
        a.title.toLowerCase().includes(q) ||
        a.stateCode.toLowerCase().includes(q)
      ) {
        matches.push({
          id: `a-${a.id}`,
          label: `${a.stateCode}: ${a.title}`,
          hint: `${a.affectedClientIds.length} affected`,
          href: `/announcements/${a.id}`,
          group: "alerts",
          icon: Bell,
        });
      }
    }

    // Nav fallbacks
    for (const n of NAV_RESULTS) {
      if (n.label.toLowerCase().includes(q)) matches.push(n);
    }

    return matches.slice(0, 30);
  }, [query, clients, tasks, announcements]);

  if (!open) return null;

  const go = (r: Result) => {
    navigate(r.href);
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(results.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) go(r);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink-900/40 backdrop-blur-[2px] flex items-start justify-center p-4 pt-32"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        role="dialog"
        aria-label="Search"
        className="bg-surface rounded-md shadow-overlay border border-line w-full max-w-lg outline-none"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-line flex items-center gap-2">
          <Search className="w-4 h-4 text-ink-400" aria-hidden />
          <input
            autoFocus
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
            }}
            onKeyDown={onKeyDown}
            placeholder="Search clients, tasks, alerts, settings…"
            className="flex-1 bg-transparent text-sm text-ink-900 placeholder:text-ink-400 focus:outline-none"
          />
          <kbd className="text-2xs text-ink-400 font-mono border border-line rounded px-1 py-0.5">
            esc
          </kbd>
        </div>
        <div className="max-h-[400px] overflow-y-auto">
          {results.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-ink-500">
              Nothing matches "{query}"
            </div>
          ) : (
            <ul className="py-1">
              {results.map((r, idx) => {
                const Icon = r.icon;
                const active = idx === activeIdx;
                return (
                  <li key={r.id}>
                    <button
                      onClick={() => go(r)}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={`w-full flex items-center gap-2.5 px-4 py-2 text-left text-sm ${
                        active ? "bg-sunken text-ink-900" : "text-ink-700"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5 text-ink-400 shrink-0" aria-hidden />
                      <span className="flex-1 truncate">{r.label}</span>
                      {r.hint && (
                        <span className="text-2xs text-ink-400">{r.hint}</span>
                      )}
                      <span className="text-2xs uppercase tracking-wider text-ink-300">
                        {r.group}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
        <footer className="px-4 py-2 border-t border-line text-2xs text-ink-400 flex items-center gap-3">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span className="ml-auto">Across clients · tasks · alerts</span>
        </footer>
      </div>
    </div>
  );
}
