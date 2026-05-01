import { ChevronDown, X } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "./ui/dropdown-menu";

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
  const toggle = (value: string) => {
    if (selected.includes(value)) onChange(selected.filter((v) => v !== value));
    else onChange([...selected, value]);
  };

  const count = selected.length;
  const active = count > 0;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={`inline-flex items-center gap-1.5 text-sm px-2.5 py-1.5 rounded-md border transition-colors ${
            active
              ? "border-accent bg-accent/10 text-ink-900"
              : "border-line bg-surface text-ink-700 hover:bg-sunken"
          }`}
        >
          <span>{label}</span>
          {active && (
            <span className="text-2xs font-semibold tabular-nums bg-accent text-canvas rounded-full min-w-[1.125rem] h-[1.125rem] px-1 inline-flex items-center justify-center">
              {count}
            </span>
          )}
          <ChevronDown className="w-3.5 h-3.5 text-ink-500" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56 p-0">
        <div className="flex items-center justify-between px-3 py-2 border-b border-line">
          <p className="text-2xs uppercase tracking-wider text-ink-500 font-semibold">
            {label}
          </p>
          {active && (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                onChange([]);
              }}
              className="text-2xs text-ink-500 hover:text-ink-900 inline-flex items-center gap-0.5"
            >
              <X className="w-3 h-3" aria-hidden /> Clear
            </button>
          )}
        </div>
        <div className="max-h-64 overflow-y-auto py-1">
          {options.map((opt) => (
            <DropdownMenuCheckboxItem
              key={opt.value}
              checked={selected.includes(opt.value)}
              onCheckedChange={() => toggle(opt.value)}
              onSelect={(e) => e.preventDefault()}
            >
              <span className="truncate">{opt.label}</span>
            </DropdownMenuCheckboxItem>
          ))}
          {options.length === 0 && (
            <p className="px-3 py-2 text-sm text-ink-500">No options</p>
          )}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
