import { useEffect, useRef, useState } from "react";
import { ChevronDown, Check, X } from "lucide-react";

export interface MultiSelectChipOption {
  value: string;
  label: string;
}

export interface MultiSelectChipProps {
  label: string;
  options: MultiSelectChipOption[];
  selected: string[];
  onChange: (next: string[]) => void;
}

export function MultiSelectChip({
  label,
  options,
  selected,
  onChange,
}: MultiSelectChipProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onMouseDown);
    return () => window.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const count = selected.length;
  const active = count > 0;

  return (
    <div ref={rootRef} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border transition-colors ${
          active
            ? "border-accent bg-accent/10 text-ink-900"
            : "border-line bg-surface text-ink-700 hover:bg-sunken"
        }`}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span>{label}</span>
        {active && (
          <span className="text-2xs font-semibold tabular-nums bg-accent text-canvas rounded-full min-w-[1.125rem] h-[1.125rem] px-1 inline-flex items-center justify-center">
            {count}
          </span>
        )}
        <ChevronDown className="w-3.5 h-3.5 text-ink-500" aria-hidden />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 w-56 bg-surface border border-line rounded-md shadow-overlay z-40 overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-line">
            <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
              {label}
            </p>
            {active && (
              <button
                type="button"
                onClick={() => onChange([])}
                className="text-2xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-0.5"
              >
                <X className="w-3 h-3" aria-hidden /> Clear
              </button>
            )}
          </div>
          <ul role="listbox" aria-multiselectable className="max-h-64 overflow-y-auto py-1">
            {options.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <li key={opt.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => toggle(opt.value)}
                    className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-ink-700 hover:bg-sunken text-left"
                  >
                    <span
                      className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                        isSelected
                          ? "bg-accent border-accent text-canvas"
                          : "border-line bg-surface"
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3" aria-hidden />}
                    </span>
                    <span className="truncate">{opt.label}</span>
                  </button>
                </li>
              );
            })}
            {options.length === 0 && (
              <li className="px-3 py-2 text-sm text-ink-500">No options</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
