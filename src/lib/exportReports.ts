import type { Report } from '../services/api';
import type { DemandForecast } from '../types';
import { type ExportFormat, ReceiptBuilder, type ReceiptLine, php, qty, receiptTimestamp, saveReceipt } from './receipt';
import { t } from '../i18n';

const STATUS = { healthy: t('ENOUGH'), low: t('LOW'), critical: t('ALMOST OUT'), out: t('OUT') } as const;
const PER = { day: t('day'), week: t('week'), month: t('month') } as const;

/** Stock running out sooner than this many days shows up in the restock list. */
const RESTOCK_WITHIN_DAYS = 14;

/** Every report section, for the selected period and category, as a receipt-style list. */
export function buildReportReceipt(
  report: Report,
  businessName: string,
  periodLabel: string,
  demand: DemandForecast[],
): ReceiptLine[] {
  const { summary, sales, purchases, expenses, inventory, range } = report;
  const filtered = range.categoryName !== null;
  const per = PER[range.granularity];
  const r = new ReceiptBuilder();

  r.center(businessName || t('My Business'), true)
    .center(t('BUSINESS REPORT'))
    .center(periodLabel)
    .center(receiptTimestamp());

  r.section(t('Summary'), () => {
    r.row(t('Revenue'), php(summary.revenue))
      .row(t('Sales made'), String(summary.transactions))
      .row(t('Stock purchased'), php(summary.purchases))
      .row(filtered ? t('Expenses (all)') : t('Expenses'), php(summary.expenses))
      .rule()
      .row(t('NET POSITION'), php(summary.netPosition), { bold: true });
  });

  r.section(t('Sales by category'), () => {
    if (sales.byCategory.length === 0) r.text(t('No sales in this period.'));
    for (const c of sales.byCategory) r.row(c.label, php(c.value));
  });

  const salesRows = sales.series.filter((p) => p.value > 0);
  r.section(t('Sales per {{per}}', { per }), () => {
    if (salesRows.length === 0) r.text(t('No sales in this period.'));
    for (const p of salesRows) r.row(p.label, php(p.value));
  });

  r.section(filtered ? t('Expenses by category (all)') : t('Expenses by category'), () => {
    if (expenses.byCategory.length === 0) r.text(t('No expenses in this period.'));
    for (const c of expenses.byCategory) r.row(c.label, php(c.value));
  });

  const purchaseRows = purchases.series.filter((p) => p.value > 0);
  r.section(t('Purchases per {{per}}', { per }), () => {
    if (purchaseRows.length === 0) r.text(t('No received purchases in this period.'));
    for (const p of purchaseRows) r.row(p.label, php(p.value));
  });

  r.section(t('Inventory today ({{count}} items)', { count: inventory.products.length }), () => {
    if (inventory.products.length === 0) r.text(t('No products.'));
    for (const p of inventory.products) {
      r.row(p.name);
      r.row(`${qty(p.currentStock)} ${p.unit}  ${STATUS[p.status]}`, php(p.stockValue), { indent: 2 });
    }
    if (inventory.products.length > 0) r.rule().row(t('STOCK VALUE'), php(inventory.totalValue), { bold: true });
  });

  const restock = demand.filter((d) => d.averageDailyDemand > 0 && d.daysOfCover <= RESTOCK_WITHIN_DAYS);
  r.section(filtered ? t('Restock soon (all products)') : t('Restock soon'), () => {
    if (demand.length === 0) r.text(t('No forecast yet.'));
    else if (restock.length === 0) r.text(t('Nothing runs out within {{days}} days.', { days: RESTOCK_WITHIN_DAYS }));
    for (const d of restock) {
      r.row(d.productName);
      r.row(t('{{qty}} {{unit}} left', { qty: qty(d.currentStock), unit: d.unit }), t('~{{days}} days', { days: qty(d.daysOfCover) }), { indent: 2 });
    }
  });

  return r.footer().lines;
}

export function exportReportReceipt(
  report: Report,
  businessName: string,
  periodLabel: string,
  demand: DemandForecast[],
  format: ExportFormat,
): Promise<void> {
  return saveReceipt(buildReportReceipt(report, businessName, periodLabel, demand), 'report', format);
}
