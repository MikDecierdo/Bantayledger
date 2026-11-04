import { IonIcon } from '@ionic/react';
import { optionsOutline } from 'ionicons/icons';
import { useEffect, useState, type ReactNode } from 'react';
import Button from './Button';
import { Modal } from './Modal';
import './Toolbar.css';
import { t } from '../../i18n';

const PHONE_QUERY = '(max-width: 767px)';

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

/**
 * Filters that phones keep behind one Filter button, opening a sheet, so the content
 * below starts higher up. Larger screens show them as they are. `active` marks that
 * a filter is on.
 */
export function PhoneFilters({ children, active = false, className }: { children: ReactNode; active?: boolean; className?: string }) {
  const [isPhone, setIsPhone] = useState(() => window.matchMedia(PHONE_QUERY).matches);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const query = window.matchMedia(PHONE_QUERY);
    const onChange = () => setIsPhone(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);

  if (!isPhone) return <>{children}</>;

  return (
    <div className={className ?? 'bl-toolbar__filterwrap'}>
      <button
        type="button"
        className={`bl-toolbar__filterbtn${active ? ' is-on' : ''}`}
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        <IonIcon icon={optionsOutline} aria-hidden="true" />
        <span>{t('Filter')}</span>
        {active && <span className="bl-toolbar__filterdot" aria-label={t('On')} />}
      </button>
      <Modal
        isOpen={open}
        onClose={() => setOpen(false)}
        title={t('Filter')}
        icon="form"
        size="sm"
        footer={
          <Button variant="primary" block onClick={() => setOpen(false)}>
            {t('Done')}
          </Button>
        }
      >
        <div className="bl-toolbar__sheet">{children}</div>
      </Modal>
    </div>
  );
}

export function ToolbarFilters({ children, active = false }: { children: ReactNode; active?: boolean }) {
  return (
    <div className="bl-toolbar__filters">
      <PhoneFilters active={active}>{children}</PhoneFilters>
    </div>
  );
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
    <div className="bl-segment bl-scroll" role="tablist" aria-label={label}>
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
export function ResultCount({ shown, total }: { shown: number; total: number; noun?: string }) {
  return (
    <p className={`bl-caption bl-resultcount${shown === total ? ' bl-resultcount--all' : ''}`} role="status">
      {t('Showing {{shown}} of {{total}}', { shown, total })}
    </p>
  );
}

export default Toolbar;
