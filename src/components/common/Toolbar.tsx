import type { ReactNode } from 'react';
import './Toolbar.css';

/**
 * Search + filters row above a list. Filters stay on one line above the data,
 * wrapping to their own row on narrow screens rather than shrinking the search.
 */
export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="bl-toolbar">{children}</div>;
}

export function ToolbarSearch({ children }: { children: ReactNode }) {
  return <div className="bl-toolbar__search">{children}</div>;
}

export function ToolbarFilters({ children }: { children: ReactNode }) {
  return <div className="bl-toolbar__filters">{children}</div>;
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (value: T) => void;
  label: string;
}

/** Accessible tab-style control for switching a view's time range or mode. */
export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: SegmentedProps<T>) {
  return (
    <div className="bl-segment" role="tablist" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          className="bl-segment__btn"
          aria-selected={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

interface ChipFilterProps<T extends string> {
  value: T;
  options: { value: T; label: string; count?: number }[];
  onChange: (value: T) => void;
  label: string;
}

/** Horizontally scrollable chips — the mobile-friendly filter pattern. */
export function ChipFilter<T extends string>({
  value,
  options,
  onChange,
  label,
}: ChipFilterProps<T>) {
  return (
    <div className="bl-chiprow bl-scroll" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="bl-chip"
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {typeof option.count === 'number' && (
            <span className="bl-chip__count">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}

/** Count line above a list: "Showing 5 of 7 products". */
export function ResultCount({ shown, total, noun }: { shown: number; total: number; noun: string }) {
  return (
    <p className="bl-caption bl-resultcount" role="status">
      Showing {shown} of {total} {noun}
    </p>
  );
}

export default Toolbar;
