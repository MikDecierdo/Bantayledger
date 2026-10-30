import { t } from './index';

/*
 * Display names for the fixed values the database stores in English
 * (payment methods, expense categories). The stored value never changes;
 * only what people read does. Unknown values (for example categories the
 * owner typed) are shown as written.
 */
const LABELS: Record<string, string> = {
  Cash: t('Cash'),
  GCash: t('GCash'),
  Card: t('Card'),
  Utilities: t('Utilities'),
  Rent: t('Rent'),
  Salaries: t('Salaries'),
  Transport: t('Transport'),
  Supplies: t('Supplies'),
  Permits: t('Permits'),
  Maintenance: t('Maintenance'),
};

export const label = (value: string): string => LABELS[value] ?? value;
