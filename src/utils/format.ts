/** Formatting helpers. Philippine Peso and PH-friendly date formats. */

import { intlLocale, t } from '../i18n';

/*
 * Number and date formats follow the active language (en-PH / fil-PH /
 * ceb-PH). Formatters are cached per locale.
 */
const formatterCache = new Map<string, Intl.NumberFormat>();

function numberFormat(options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const locale = intlLocale();
  const key = `${locale}|${options.minimumFractionDigits ?? ''}|${options.maximumFractionDigits ?? ''}`;
  let f = formatterCache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(locale, options);
    formatterCache.set(key, f);
  }
  return f;
}

const pesoFormatter = { format: (v: number) => numberFormat({ minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v) };
const pesoDecimalFormatter = { format: (v: number) => numberFormat({ minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v) };

/** ₱4,250 — the default money format across the app. */
export function peso(value: number, withDecimals = false): string {
  const abs = Math.abs(value);
  const body = withDecimals
    ? pesoDecimalFormatter.format(abs)
    : pesoFormatter.format(abs);
  return `${value < 0 ? '-' : ''}₱${body}`;
}

/** ₱4.2k — compact form for tight chart axes. */
export function pesoCompact(value: number): string {
  const abs = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1_000_000) return `${sign}₱${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}₱${(abs / 1_000).toFixed(abs >= 10_000 ? 0 : 1)}k`;
  return `${sign}₱${abs}`;
}

export function number(value: number, maxDigits = 1): string {
  return numberFormat({ maximumFractionDigits: maxDigits }).format(value);
}

/** +8.2% / -3.4% */
export function percent(value: number, digits = 1): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(digits)}%`;
}

/** "Sep 3, 2026" */
export function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intlLocale(), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

/** "Sep 3" */
export function dayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(intlLocale(), { month: 'short', day: 'numeric' });
}

/** "2h ago", "Yesterday", "Sep 1". */
export function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return t('Just now');
  if (mins < 60) return t('{{count}}m ago', { count: mins });
  const hours = Math.round(mins / 60);
  if (hours < 24) return t('{{count}}h ago', { count: hours });
  const days = Math.round(hours / 24);
  if (days === 1) return t('Yesterday');
  if (days < 7) return t('{{count}}d ago', { count: days });
  return dayMonth(iso);
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return t('Good morning');
  if (hour < 18) return t('Good afternoon');
  return t('Good evening');
}

export function initialsOf(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/*
 * Friendly names for what the app calls "waste" internally. The stored values
 * (route /waste, WasteReason, insight type "Waste") never change; only what
 * people read does.
 */
export const WASTE_FEATURE_NAME = t('Spoiled & Damaged');

const WASTE_REASON_LABELS: Record<string, string> = {
  Expired: t('Expired (Paso na)'),
  Damaged: t('Damaged (Nasira)'),
  Spoiled: t('Spoiled (Panis / Sira)'),
  Spillage: t('Spilled (Natapon)'),
  'Customer Return': t('Returned by customer (Ibinalik)'),
};

const INSIGHT_CATEGORY_LABELS: Record<string, string> = {
  Inventory: t('Inventory'),
  Pricing: t('Pricing'),
  Purchasing: t('Purchasing'),
  Sales: t('Sales'),
  Waste: t('Spoiled & Damaged'),
};

export const wasteReasonLabel = (reason: string): string => WASTE_REASON_LABELS[reason] ?? reason;

/** Insight categories as people read them; the stored value stays "Waste". */
export const insightCategoryLabel = (category: string): string =>
  INSIGHT_CATEGORY_LABELS[category] ?? category;
