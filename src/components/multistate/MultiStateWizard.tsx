import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { trpc } from "../../lib/api/client";
import { useModalDialog } from "../../hooks/useModalDialog";
import { findState, US_STATES } from "../../data/usStates";
import { SearchablePicker } from "./pickers/SearchablePicker";
import { MapPicker } from "./pickers/MapPicker";
import { TwoPanePicker } from "./pickers/TwoPanePicker";
import { TagPicker } from "./pickers/TagPicker";
import { ReviewStep } from "./ReviewStep";
import { ConfirmModal } from "./ConfirmModal";

export type PickerVariant = "list" | "map" | "panes" | "tags";

const VALID_VARIANTS: PickerVariant[] = ["list", "map", "panes", "tags"];

interface Props {
  open: boolean;
  onClose: () => void;
  /** When provided, the wizard commits against this client. Required for the
   *  Confirm button to be enabled. Pre-AddClient flow can leave this null
   *  and use the wizard purely for state selection (the AddClient modal
   *  reads `selectedStates` via `onStatesChange`). */
  clientId?: string | null;
  clientName?: string;
  /** Pre-checked states (e.g. when re-opening on Client Detail). */
  initialStates?: string[];
  /** Called whenever the user picks/unpicks states. Lets a parent flow
   *  (AddClient) read the selection without forcing a full commit. */
  onStatesChange?: (codes: string[]) => void;
  /** Called when the user successfully commits. */
  onCommit?: (result: {
    createdDeadlines: number;
    createdTasks: number;
    createdPackageId: string | null;
  }) => void;
}

type Step = "pick" | "review" | "confirm";

/**
 * Multi-state filing wizard. Three sequential surfaces:
 *  1. Picker — one of four UI variants (`?picker=` query)
 *  2. Review — preview deadlines, exclude per-row before commit
 *  3. Confirm — final modal with count + "save as package" checkbox
 *
 * The picker variant is dev-toggleable via URL query so the team can
 * compare side-by-side. Defaults to `list` (most familiar pattern for CPAs).
 */
export function MultiStateWizard({
  open,
  onClose,
  clientId,
  clientName,
  initialStates = [],
  onStatesChange,
  onCommit,
}: Props) {
  const [params] = useSearchParams();
  const variant: PickerVariant = useMemo(() => {
    const q = params.get("picker") ?? "list";
    return (VALID_VARIANTS as readonly string[]).includes(q)
      ? (q as PickerVariant)
      : "list";
  }, [params]);

  const [selectedStates, setSelectedStates] = useState<string[]>(initialStates);
  const [step, setStep] = useState<Step>("pick");
  const [excludedTemplateIds, setExcludedTemplateIds] = useState<string[]>([]);
  const [showConfirm, setShowConfirm] = useState(false);

  const dialogRef = useModalDialog(open, onClose);

  // Keep parent in sync as user picks/unpicks
  useEffect(() => {
    onStatesChange?.(selectedStates);
  }, [selectedStates, onStatesChange]);

  const previewQuery = trpc.multistate.preview.useQuery(
    {
      stateCodes: selectedStates,
      includeFederal: true,
    },
    {
      enabled: open && selectedStates.length > 0,
      staleTime: 30_000,
    },
  );

  const commitMutation = trpc.multistate.commit.useMutation();

  const totalDeadlines = previewQuery.data?.totalDeadlines ?? 0;
  const filteredDeadlines = useMemo(() => {
    if (!previewQuery.data) return 0;
    let n = 0;
    for (const g of previewQuery.data.groups) {
      for (const d of g.deadlines) {
        if (!excludedTemplateIds.includes(d.templateId)) n++;
      }
    }
    return n;
  }, [previewQuery.data, excludedTemplateIds]);

  if (!open) return null;

  const togglePicker = (code: string) => {
    setSelectedStates((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  };

  const removeState = (code: string) => {
    setSelectedStates((prev) => prev.filter((c) => c !== code));
  };

  const onContinueToReview = () => {
    setStep("review");
    setExcludedTemplateIds([]);
  };

  const onCommit_ = async (saveAsPackage: boolean, customName?: string) => {
    if (!clientId) {
      setShowConfirm(false);
      onClose();
      return;
    }
    try {
      const result = await commitMutation.mutateAsync({
        clientId,
        stateCodes: selectedStates,
        includeFederal: true,
        excludedTemplateIds,
        saveAsPackage,
        customPackageName: customName,
      });
      onCommit?.(result);
      setShowConfirm(false);
      onClose();
    } catch {
      // Error surfaced inside the modal via mutation.error
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 backdrop-blur-[2px]"
      onMouseDown={onClose}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-label="Multi-state filing wizard"
        tabIndex={-1}
        className="bg-surface rounded-md shadow-overlay border border-line w-full max-w-3xl mx-4 outline-none flex flex-col max-h-[88vh]"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className="px-5 py-4 border-b border-line flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-ink-900">
              {step === "pick" && (
                <>Where does {clientName ?? "this client"} file?</>
              )}
              {step === "review" && <>Review deadlines</>}
            </h2>
            <p className="text-2xs text-ink-500 mt-0.5">
              {step === "pick" && (
                <>Pick the states this client has nexus in. Federal forms are
                  always included.</>
              )}
              {step === "review" && (
                <>Toggle off any deadline you don't want created.</>
              )}
            </p>
          </div>
          <span
            className="text-2xs text-ink-400 font-mono px-1.5 py-0.5 rounded border border-line"
            title="Picker variant — change via ?picker=list|map|panes|tags"
          >
            {variant}
          </span>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-ink-400 hover:text-ink-700 px-1"
          >
            ✕
          </button>
        </header>

        <main className="flex-1 overflow-auto">
          {step === "pick" && (
            <>
              {variant === "list" && (
                <SearchablePicker
                  selected={selectedStates}
                  onToggle={togglePicker}
                />
              )}
              {variant === "map" && (
                <MapPicker
                  selected={selectedStates}
                  onToggle={togglePicker}
                />
              )}
              {variant === "panes" && (
                <TwoPanePicker
                  selected={selectedStates}
                  onToggle={togglePicker}
                  onRemove={removeState}
                />
              )}
              {variant === "tags" && (
                <TagPicker
                  selected={selectedStates}
                  onToggle={togglePicker}
                  onRemove={removeState}
                />
              )}
            </>
          )}
          {step === "review" && (
            <ReviewStep
              selected={selectedStates}
              groups={previewQuery.data?.groups ?? []}
              isLoading={previewQuery.isLoading}
              excluded={excludedTemplateIds}
              onToggleExclude={(id) =>
                setExcludedTemplateIds((prev) =>
                  prev.includes(id)
                    ? prev.filter((x) => x !== id)
                    : [...prev, id],
                )
              }
              statesWithoutTemplates={
                previewQuery.data?.statesWithoutTemplates ?? []
              }
            />
          )}
        </main>

        <footer className="px-5 py-3 border-t border-line bg-sunken/30 flex items-center justify-between gap-3">
          <div className="text-xs text-ink-500">
            {selectedStates.length === 0 ? (
              <>No states picked yet</>
            ) : (
              <>
                <span className="font-medium text-ink-900">
                  {selectedStates.length}
                </span>{" "}
                state{selectedStates.length === 1 ? "" : "s"} selected
                {step === "pick" && totalDeadlines > 0 && (
                  <>
                    {" · "}
                    <span className="font-medium text-ink-900">
                      {totalDeadlines}
                    </span>{" "}
                    deadlines will be created
                  </>
                )}
                {step === "review" && (
                  <>
                    {" · "}
                    <span className="font-medium text-ink-900">
                      {filteredDeadlines}
                    </span>{" "}
                    of {totalDeadlines} will be created
                  </>
                )}
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {step === "pick" && (
              <>
                <button
                  onClick={onClose}
                  className="text-sm px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken"
                >
                  Cancel
                </button>
                <button
                  onClick={onContinueToReview}
                  disabled={selectedStates.length === 0}
                  className="text-sm px-4 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
                >
                  Continue → review
                </button>
              </>
            )}
            {step === "review" && (
              <>
                <button
                  onClick={() => setStep("pick")}
                  className="text-sm px-3 py-1.5 rounded border border-line text-ink-700 hover:bg-sunken"
                >
                  ← Back
                </button>
                <button
                  onClick={() => setShowConfirm(true)}
                  disabled={filteredDeadlines === 0 || !clientId}
                  className="text-sm px-4 py-1.5 rounded-md bg-accent text-canvas hover:bg-accent-hover disabled:opacity-40"
                  title={
                    !clientId
                      ? "Save the client first, then commit deadlines"
                      : undefined
                  }
                >
                  {clientId ? "Confirm and create" : "No client to commit to"}
                </button>
              </>
            )}
          </div>
        </footer>
      </div>

      {showConfirm && clientId && (
        <ConfirmModal
          clientName={clientName ?? "this client"}
          deadlineCount={filteredDeadlines}
          stateCount={selectedStates.length}
          stateLabel={
            selectedStates
              .map((c) => findState(c)?.name ?? c)
              .slice(0, 3)
              .join(", ") + (selectedStates.length > 3 ? ", …" : "")
          }
          isPending={commitMutation.isPending}
          errorMessage={commitMutation.error?.message ?? null}
          onCancel={() => setShowConfirm(false)}
          onConfirm={onCommit_}
        />
      )}
    </div>
  );
}

/** Re-export for convenience. Components consuming the picker count usually
 *  want this matching list. */
export { US_STATES };
