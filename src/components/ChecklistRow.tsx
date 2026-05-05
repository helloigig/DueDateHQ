import { useEffect, useRef, useState } from "react";
import {
  Check,
  Clock,
  Circle,
  AlertTriangle,
  RotateCcw,
  Mail,
  MoreHorizontal,
  Trash2,
} from "lucide-react";
import type { ChecklistItem, DocumentState } from "../types";
import {
  useDeleteChecklistItem,
  useSetChecklistItemState,
} from "../hooks/useChecklist";
import { confirmWithUndo } from "../lib/confirmWithUndo";

/**
 * Renders one Layer 3 checklist item per IA §3.4. Each row's visual
 * variant + inline actions are state-dependent. The Confirm action on
 * `received_unreviewed` is the only path to `received_confirmed` —
 * enforces the PRD §5.3 invariant.
 */

interface Props {
  item: ChecklistItem;
  /** Opens the email draft modal (email-drafter). Caller wires from the parent. */
  onOpenEmailDraft: (
    itemId: string,
    intent: "send_reminder" | "ask_client" | "request_initial"
  ) => void;
}

const STATE_LABEL: Record<DocumentState, string> = {
  not_requested: "Not requested",
  requested_waiting: "Requested · waiting",
  received_unreviewed: "Received · awaiting review",
  received_confirmed: "Confirmed",
  received_issue: "Has issue",
  not_applicable: "Not applicable",
};

function StateIcon({ state }: { state: DocumentState }) {
  switch (state) {
    case "received_confirmed":
      return (
        <span className="w-5 h-5 rounded-full bg-ok-bg text-ok-ink border border-ok-border flex items-center justify-center">
          <Check className="w-3 h-3" aria-hidden />
        </span>
      );
    case "received_unreviewed":
      return (
        <span className="w-5 h-5 rounded-full border border-ink-400 flex items-center justify-center bg-info-bg">
          <span className="w-2.5 h-2.5 rounded-full bg-info-solid" />
        </span>
      );
    case "received_issue":
      return (
        <span className="w-5 h-5 rounded-full bg-warn-bg text-warn-ink border border-warn-border flex items-center justify-center">
          <AlertTriangle className="w-3 h-3" aria-hidden />
        </span>
      );
    case "requested_waiting":
      return (
        <span className="w-5 h-5 rounded-full border border-ink-300 flex items-center justify-center text-ink-500">
          <Clock className="w-3 h-3" aria-hidden />
        </span>
      );
    case "not_applicable":
      return (
        <span className="w-5 h-5 rounded-full border border-ink-300 text-ink-300 flex items-center justify-center text-2xs">
          —
        </span>
      );
    case "not_requested":
    default:
      return (
        <span className="w-5 h-5 rounded-full border border-ink-300 flex items-center justify-center">
          <Circle className="w-3 h-3 text-ink-300" aria-hidden />
        </span>
      );
  }
}

export function ChecklistRow({ item, onOpenEmailDraft }: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [pulse, setPulse] = useState(false);
  const prevState = useRef<DocumentState>(item.state);
  const setState = useSetChecklistItemState();
  const deleteItem = useDeleteChecklistItem();
  // Provenance: only user-added items are deletable. Mock-mode marks them
  // with `custom: true`; real-mode also exposes `addedByUserId`. Either
  // signal is enough.
  const isUserAdded = item.custom || !!item.addedByUserId;
  // Pulse when this row's state advances to received_confirmed — the §5.3
  // invariant moment. Honours prefers-reduced-motion via the keyframe rule.
  useEffect(() => {
    if (
      prevState.current !== "received_confirmed" &&
      item.state === "received_confirmed"
    ) {
      setPulse(true);
      const t = setTimeout(() => setPulse(false), 720);
      return () => clearTimeout(t);
    }
    prevState.current = item.state;
  }, [item.state]);

  const onConfirm = () => {
    // PRD §5.3 invariant — only "cpa" actor permitted here.
    // confirmWithUndo wraps this with a 5-sec undo window.
    confirmWithUndo(item, setState);
  };
  const onReject = () => {
    setState(item.id, "requested_waiting", "cpa");
  };
  const onRestore = () => {
    setState(item.id, "not_requested", "cpa");
  };
  const onMarkNA = () => {
    setState(item.id, "not_applicable", "cpa");
  };
  const onConfirmAnyway = () => {
    confirmWithUndo(item, setState);
  };
  const onMarkIssue = () => {
    // No-op state change — UI just keeps it as `received_issue`.
    setState(item.id, "received_issue", "cpa");
  };

  const labelStrike =
    item.state === "not_applicable" ? "line-through text-ink-400" : "";

  return (
    <div
      className={[
        "px-4 py-3 border-b border-line last:border-b-0 group ddhq-row-transition rounded-sm",
        item.state === "received_issue" ? "bg-warn-bg/30" : "",
        item.state === "received_confirmed" ? "bg-ok-bg/20" : "",
        pulse ? "animate-ddhq-confirm" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex items-start gap-3">
        <span className="pt-0.5">
          <StateIcon state={item.state} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className={`text-sm font-medium text-ink-900 ${labelStrike}`}>
              {item.label}
            </span>
            {item.custom && (
              <span className="text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded bg-sunken text-ink-500">
                custom
              </span>
            )}
            <span className="text-2xs uppercase tracking-wide text-ink-400">
              {STATE_LABEL[item.state]}
            </span>
          </div>
          {/* State-dependent inline detail */}
          <StateDetail item={item} />
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <StateActions
            item={item}
            onConfirm={onConfirm}
            onReject={onReject}
            onRestore={onRestore}
            onMarkNA={onMarkNA}
            onConfirmAnyway={onConfirmAnyway}
            onMarkIssue={onMarkIssue}
            onOpenEmailDraft={onOpenEmailDraft}
          />
          <div className="relative">
            <button
              onClick={() => setMenuOpen((v) => !v)}
              className="text-xs p-1.5 rounded hover:bg-sunken text-ink-500"
              aria-label="More actions"
            >
              <MoreHorizontal className="w-3.5 h-3.5" aria-hidden />
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-7 z-10 bg-surface border border-line rounded-md shadow-pop py-1 w-44">
                {item.state !== "not_applicable" && (
                  <MenuButton
                    onClick={() => {
                      onMarkNA();
                      setMenuOpen(false);
                    }}
                  >
                    Mark not applicable
                  </MenuButton>
                )}
                {item.state === "not_applicable" && (
                  <MenuButton
                    onClick={() => {
                      onRestore();
                      setMenuOpen(false);
                    }}
                  >
                    Restore
                  </MenuButton>
                )}
                {item.state !== "not_requested" && (
                  <MenuButton
                    onClick={() => {
                      onRestore();
                      setMenuOpen(false);
                    }}
                  >
                    Reset to "not requested"
                  </MenuButton>
                )}
                {isUserAdded && (
                  <>
                    <div className="border-t border-line my-1" />
                    <MenuButton
                      destructive
                      onClick={() => {
                        if (
                          window.confirm(
                            `Remove "${item.label}" from this checklist?`,
                          )
                        ) {
                          deleteItem(item.id);
                        }
                        setMenuOpen(false);
                      }}
                    >
                      <Trash2 className="w-3 h-3 inline mr-1.5 -mt-0.5" aria-hidden />
                      Remove item
                    </MenuButton>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function MenuButton({
  children,
  onClick,
  destructive = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  destructive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={
        "w-full text-left text-sm px-3 py-1.5 hover:bg-sunken " +
        (destructive ? "text-danger-ink" : "text-ink-700")
      }
    >
      {children}
    </button>
  );
}

function StateDetail({ item }: { item: ChecklistItem }) {
  switch (item.state) {
    case "requested_waiting":
      return (
        <div className="text-xs text-ink-500 mt-1">
          {item.lastReminderAt && (
            <>
              Last reminder: <span className="text-ink-700">{shortDate(item.lastReminderAt)}</span>
              {" · "}
            </>
          )}
          {item.nextReminderAt ? (
            <>
              Next: <span className="text-ink-700">{shortDate(item.nextReminderAt)}</span>
            </>
          ) : (
            "No follow-up scheduled"
          )}
        </div>
      );
    case "received_unreviewed":
      return (
        <div className="text-xs text-ink-500 mt-1 flex items-center gap-2 flex-wrap">
          {item.aiClassification && (
            <span>
              AI thinks: <span className="text-ink-700">{item.aiClassification}</span>
            </span>
          )}
          {item.aiConfidence && (
            <ConfidencePill confidence={item.aiConfidence} />
          )}
          {item.receivedFilename && (
            <span className="text-ink-400 font-mono">{item.receivedFilename}</span>
          )}
        </div>
      );
    case "received_confirmed":
      return (
        <div className="text-xs text-ink-500 mt-1">
          Confirmed {item.confirmedAt ? shortDate(item.confirmedAt) : ""}
          {item.confirmedBy ? ` by ${item.confirmedBy}` : ""}
        </div>
      );
    case "received_issue":
      return (
        <div className="text-xs mt-2 bg-warn-bg border border-warn-border rounded p-2 text-warn-ink">
          <div className="font-medium flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" aria-hidden />
            AI flag
            {item.flagSeverity && (
              <span className="ml-1 text-2xs uppercase tracking-wide">
                · {item.flagSeverity}
              </span>
            )}
          </div>
          <p className="mt-1">{item.flagReason}</p>
        </div>
      );
    case "not_requested":
      return (
        <div className="text-xs text-ink-400 mt-1">
          Not yet requested.
        </div>
      );
    default:
      return null;
  }
}

function ConfidencePill({ confidence }: { confidence: "high" | "medium" | "low" }) {
  const styles =
    confidence === "high"
      ? "bg-ok-bg text-ok-ink border-ok-border"
      : confidence === "medium"
      ? "bg-info-bg text-info-ink border-info-border"
      : "bg-warn-bg text-warn-ink border-warn-border";
  return (
    <span
      className={`text-2xs uppercase tracking-wide px-1.5 py-0.5 rounded border ${styles} animate-ddhq-ai-shimmer`}
      title="AI confidence on inbound classification"
    >
      AI {confidence}
    </span>
  );
}

function StateActions({
  item,
  onConfirm,
  onReject,
  onRestore,
  onMarkNA,
  onConfirmAnyway,
  onMarkIssue,
  onOpenEmailDraft,
}: {
  item: ChecklistItem;
  onConfirm: () => void;
  onReject: () => void;
  onRestore: () => void;
  onMarkNA: () => void;
  onConfirmAnyway: () => void;
  onMarkIssue: () => void;
  onOpenEmailDraft: Props["onOpenEmailDraft"];
}) {
  const sm = "text-xs px-2 py-1 rounded border";
  switch (item.state) {
    case "not_requested":
      return (
        <button
          onClick={() => onOpenEmailDraft(item.id, "request_initial")}
          className={`${sm} border-line text-ink-700 hover:bg-sunken flex items-center gap-1`}
        >
          <Mail className="w-3 h-3" aria-hidden /> Request from client
        </button>
      );
    case "requested_waiting":
      return (
        <button
          onClick={() => onOpenEmailDraft(item.id, "send_reminder")}
          className={`${sm} border-indigo bg-indigo text-white hover:bg-indigo-hover flex items-center gap-1`}
        >
          <Mail className="w-3 h-3" aria-hidden /> Send reminder now
        </button>
      );
    case "received_unreviewed":
      return (
        <>
          <button
            onClick={onConfirm}
            title="Confirm — only the CPA can promote to received_confirmed (PRD §5.3)"
            className={`${sm} border-ok-border bg-ok-bg text-ok-ink hover:bg-ok-bg/70`}
          >
            Confirm
          </button>
          <button
            onClick={onReject}
            className={`${sm} border-line text-ink-700 hover:bg-sunken`}
          >
            Reject
          </button>
        </>
      );
    case "received_issue":
      return (
        <>
          <button
            onClick={onConfirmAnyway}
            title="CPA verified the value is correct"
            className={`${sm} border-ok-border bg-ok-bg text-ok-ink hover:bg-ok-bg/70`}
          >
            Confirm anyway
          </button>
          <button
            onClick={onMarkIssue}
            className={`${sm} border-warn-border bg-warn-bg text-warn-ink hover:bg-warn-bg/70`}
          >
            Mark as issue
          </button>
          <button
            onClick={() => onOpenEmailDraft(item.id, "ask_client")}
            className={`${sm} border-indigo bg-indigo text-white hover:bg-indigo-hover flex items-center gap-1`}
          >
            <Mail className="w-3 h-3" aria-hidden /> Ask client
          </button>
        </>
      );
    case "not_applicable":
      return (
        <button
          onClick={onRestore}
          className={`${sm} border-line text-ink-700 hover:bg-sunken flex items-center gap-1`}
        >
          <RotateCcw className="w-3 h-3" aria-hidden /> Restore
        </button>
      );
    case "received_confirmed":
    default:
      return (
        <button
          onClick={onMarkNA}
          className={`${sm} border-line text-ink-500 hover:bg-sunken text-2xs`}
        >
          Mark N/A
        </button>
      );
  }
}

function shortDate(iso: string): string {
  // Accepts both date-only and full ISO timestamps.
  return iso.slice(0, 10);
}
