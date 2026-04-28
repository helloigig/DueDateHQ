import { Link } from "react-router-dom";
import { AlertTriangle, Megaphone, Moon } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SpotlightCard {
  key: string;
  icon: "overdue" | "quiet" | "alert";
  title: string;
  reason: string;
  clients: { id: string; name: string }[];
  totalCount: number;
  action?: { label: string; onClick: () => void };
}

const ICON_MAP: Record<SpotlightCard["icon"], LucideIcon> = {
  overdue: AlertTriangle,
  quiet: Moon,
  alert: Megaphone,
};

const TONE_MAP: Record<SpotlightCard["icon"], string> = {
  overdue: "text-danger-ink",
  quiet: "text-ink-500",
  alert: "text-info-ink",
};

export function SpotlightStrip({ cards }: { cards: SpotlightCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section
      aria-label="AI insights"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {cards.map((card) => (
        <SpotlightCardView key={card.key} card={card} />
      ))}
    </section>
  );
}

function SpotlightCardView({ card }: { card: SpotlightCard }) {
  const Icon = ICON_MAP[card.icon];
  const tone = TONE_MAP[card.icon];
  const overflow = card.totalCount - card.clients.length;
  return (
    <div className="bg-surface border border-line rounded-md p-3 flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Icon className={`w-3.5 h-3.5 ${tone}`} aria-hidden />
          <h2 className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
            {card.title}
          </h2>
        </div>
        <span className="text-2xs font-semibold tabular-nums text-ink-700">
          {card.totalCount}
        </span>
      </div>
      <p className="text-xs text-ink-500">{card.reason}</p>
      {card.clients.length > 0 ? (
        <ul className="flex flex-wrap gap-1.5">
          {card.clients.map((c) => (
            <li key={c.id}>
              <Link
                to={`/clients/${c.id}`}
                className="inline-flex text-xs px-2 py-0.5 rounded border border-line bg-sunken text-ink-700 hover:bg-canvas hover:text-ink-900 hover:border-line-strong"
              >
                {c.name}
              </Link>
            </li>
          ))}
          {overflow > 0 && (
            <li className="inline-flex text-2xs items-center text-ink-500 px-1 self-center tabular-nums">
              +{overflow}
            </li>
          )}
        </ul>
      ) : (
        <p className="text-xs text-ink-400 italic">Nothing flagged.</p>
      )}
      {card.action && card.totalCount > 0 && (
        <button
          type="button"
          onClick={card.action.onClick}
          className="text-xs text-ink-700 hover:text-ink-900 underline underline-offset-2 self-start mt-auto"
        >
          {card.action.label} →
        </button>
      )}
    </div>
  );
}
