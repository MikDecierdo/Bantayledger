import { trashOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import { t } from '../../i18n';
import Button from './Button';
import { SelectField, TextField } from './Field';

/**
 * The units a sari-sari store sells by, as stored with each product (and shown in
 * stock messages, e.g. "12 bottles"). These come built in and cannot be deleted;
 * anything else can be typed with "Other", and those typed units can be deleted.
 */
export const STORE_UNITS = [
  'pcs',
  'packs',
  'sachets',
  'bottles',
  'cans',
  'boxes',
  'bars',
  'sticks',
  'rolls',
  'tubes',
  'pouches',
  'jars',
  'cups',
  'bags',
  'sacks',
  'trays',
  'dozens',
  'kg',
  'grams',
  'liters',
  'mL',
] as const;

// Other ways stores write the same unit.
const UNIT_ALIASES: Record<string, string> = {
  kilo: 'kg', kilos: 'kg', kilogram: 'kg', kilograms: 'kg', kgs: 'kg',
  gram: 'grams', g: 'grams', gr: 'grams',
  liter: 'liters', litre: 'liters', litres: 'liters', l: 'liters',
  ml: 'mL', pc: 'pcs', piraso: 'pcs',
};

/**
 * The built-in unit a typed one means, or null: "Bottle" and "Bottles" are
 * "bottles", "Pieces" is "pcs", "Kilo" is "kg".
 */
export function canonicalUnit(unit: string): string | null {
  const u = unit.trim().toLowerCase();
  if (!u) return null;
  if (UNIT_ALIASES[u]) return UNIT_ALIASES[u];
  const one = singularUnit(u).toLowerCase();
  return STORE_UNITS.find((s) => s.toLowerCase() === u || singularUnit(s).toLowerCase() === one) ?? null;
}

/** True for a built-in unit, however it is spelled. */
export function isStoreUnit(unit: string): boolean {
  return canonicalUnit(unit) !== null;
}

// Units typed with "Other" are remembered per store on this device, so they show
// up in the list next time even before a product uses them.
const savedKey = (businessId: string) => `bantayledger.customUnits.${businessId}`;

export function loadSavedUnits(businessId: string): string[] {
  try {
    const raw = window.localStorage.getItem(savedKey(businessId));
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((u): u is string => typeof u === 'string') : [];
  } catch {
    return [];
  }
}

export function saveSavedUnits(businessId: string, units: string[]): void {
  try {
    window.localStorage.setItem(savedKey(businessId), JSON.stringify(units));
  } catch {
    /* storage unavailable: the list just won't be remembered */
  }
}

/** Unique typed units (not built in), in alphabetical order. */
export function customUnitList(units: string[]): string[] {
  const seen = new Map<string, string>();
  for (const raw of units) {
    const u = (raw ?? '').trim();
    if (u && !isStoreUnit(u) && !seen.has(u.toLowerCase())) seen.set(u.toLowerCase(), u);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}

const OTHER = '__other__';

interface UnitFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  /** Units the store typed before; listed after the built-in ones and deletable. */
  customUnits?: string[];
  /** Deletes a typed unit (only offered for those, never for built-in units). */
  onDelete?: (unit: string) => void;
}

/** A dropdown of store units, the store's own typed units, and "Other" to type a new one. */
export default function UnitField({ label, value, onChange, required, customUnits = [], onDelete }: UnitFieldProps) {
  // A product saved as "Bottle" or "Kilo" shows (and saves) the built-in "bottles" or "kg".
  const canonical = canonicalUnit(value);
  useEffect(() => {
    if (canonical && canonical !== value) onChange(canonical);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canonical, value]);

  const isCustomListed = customUnits.some((u) => u.toLowerCase() === value.trim().toLowerCase());
  const listed = isStoreUnit(value) || isCustomListed;
  // A unit not in either list (being typed now) shows "Other" with the text box.
  const [typing, setTyping] = useState(value !== '' && !listed);
  useEffect(() => {
    if (value !== '' && !listed) setTyping(true);
  }, [value, listed]);

  return (
    <div className="bl-unit-field">
      <div className="bl-unit-field__row">
        <SelectField
          label={label}
          required={required}
          placeholder={t('Select a unit')}
          className="bl-unit-field__select"
          value={typing ? OTHER : value}
          onChange={(e) => {
            if (e.target.value === OTHER) {
              setTyping(true);
              onChange('');
            } else {
              setTyping(false);
              onChange(e.target.value);
            }
          }}
          options={[
            ...STORE_UNITS.map((u) => ({ value: u, label: u })),
            ...customUnits.map((u) => ({ value: u, label: u })),
            { value: OTHER, label: t('Other (type your own)') },
          ]}
        />
        {onDelete && !typing && isCustomListed && (
          <Button variant="ghost" icon={trashOutline} aria-label={t('Delete this unit')} onClick={() => onDelete(value)} />
        )}
      </div>
      {typing && (
        <TextField
          label={t('Your unit')}
          hideLabel
          required={required}
          textOnly
          maxLength={20}
          placeholder={t('e.g. tali')}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoFocus
        />
      )}
    </div>
  );
}

/** "sacks" → "sack", "boxes" → "box", "pcs" → "piece": for "in one sack", "Whole sack". */
export function singularUnit(unit: string): string {
  const u = unit.trim();
  if (u.toLowerCase() === 'pcs') return 'piece';
  if (/(ch|sh|x|ss)es$/i.test(u)) return u.slice(0, -2);
  if (/[^s]s$/i.test(u) && u.length > 2) return u.slice(0, -1);
  return u;
}
