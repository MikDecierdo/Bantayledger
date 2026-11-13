import type { Report } from '../services/api';
import type { DemandForecast } from '../types';
import { type ExportFormat, php, qty, receiptTimestamp } from './receipt';
import { type Cell, loadLogo, PaperDoc, savePaper } from './reportPaper';
import { t } from '../i18n';

const STATUS_COLOR = { healthy: '#1F7A4D', low: '#B26A00', critical: '#C0392B', out: '#C0392B' } as const;

/** Stock running out sooner than this many days shows up in the restock list. */
const RESTOCK_WITHIN_DAYS = 14;

export interface ReportPaperInfo {
  businessName: string;
  periodLabel: string;
  preparedBy: string;
}

function share(value: number, total: number): string {
  return total > 0 ? `${((value / total) * 100).toFixed(1)}%` : '-';
}

/** Every report section, for the selected period and category, on short bond paper pages. */
export function buildReportPaper(report: Report, info: ReportPaperInfo, demand: DemandForecast[], logo: string | null) {
  // Looked up here, not when the file loads, so they follow the language picked now.
  const STATUS = { healthy: t('Enough'), low: t('Low'), critical: t('Almost out'), out: t('Out of stock') };
  const PER = { day: t('day'), week: t('week'), month: t('month') };
  const PERIOD = { day: t('Day'), week: t('Week'), month: t('Month') };
  const { summary, sales, purchases, expenses, inventory, range } = report;
  const filtered = range.categoryName !== null;
  const per = PER[range.granularity];
  const businessName = info.businessName || t('My Business');

  const doc = new PaperDoc({
    title: t('Business Report'),
    businessName,
    periodLabel: info.periodLabel,
    generatedAt: receiptTimestamp().replace(/\s{2,}/, ' '),
    preparedBy: info.preparedBy,
    logo,
  });

  doc.boxes([
    { label: t('Revenue'), value: php(summary.revenue) },
    { label: t('Sales made'), value: String(summary.transactions) },
    { label: t('Stock purchased'), value: php(summary.purchases) },
    { label: filtered ? t('Expenses (all)') : t('Expenses'), value: php(summary.expenses) },
    { label: t('Net position'), value: php(summary.netPosition), color: summary.netPosition < 0 ? '#C0392B' : '#1F7A4D' },
  ]);

  const salesTotal = sales.byCategory.reduce((sum, c) => sum + c.value, 0);
  doc.table(
    t('Sales by category'),
    [{ label: t('Category'), width: 5 }, { label: t('Amount'), width: 2.5, align: 'right' }, { label: t('Share'), width: 1.5, align: 'right' }],
    sales.byCategory.map((c) => [{ text: c.label }, { text: php(c.value) }, { text: share(c.value, salesTotal) }]),
    { total: [{ text: t('Total') }, { text: php(salesTotal) }, { text: '100%' }], empty: t('No sales in this period.') },
  );

  const salesRows = sales.series.filter((p) => p.value > 0);
  doc.table(
    t('Sales per {{per}}', { per }),
    [{ label: PERIOD[range.granularity], width: 6.5 }, { label: t('Amount'), width: 2.5, align: 'right' }],
    salesRows.map((p) => [{ text: p.label }, { text: php(p.value) }]),
    { total: [{ text: t('Total') }, { text: php(salesRows.reduce((s, p) => s + p.value, 0)) }], empty: t('No sales in this period.') },
  );

  const expenseTotal = expenses.byCategory.reduce((sum, c) => sum + c.value, 0);
  doc.table(
    filtered ? t('Expenses by category (all)') : t('Expenses by category'),
    [{ label: t('Category'), width: 5 }, { label: t('Amount'), width: 2.5, align: 'right' }, { label: t('Share'), width: 1.5, align: 'right' }],
    expenses.byCategory.map((c) => [{ text: c.label }, { text: php(c.value) }, { text: share(c.value, expenseTotal) }]),
    { total: [{ text: t('Total') }, { text: php(expenseTotal) }, { text: '100%' }], empty: t('No expenses in this period.') },
  );

  const purchaseRows = purchases.series.filter((p) => p.value > 0);
  doc.table(
    t('Purchases per {{per}}', { per }),
    [{ label: PERIOD[range.granularity], width: 6.5 }, { label: t('Amount'), width: 2.5, align: 'right' }],
    purchaseRows.map((p) => [{ text: p.label }, { text: php(p.value) }]),
    { total: [{ text: t('Total') }, { text: php(purchaseRows.reduce((s, p) => s + p.value, 0)) }], empty: t('No received purchases in this period.') },
  );

  doc.table(
    t('Inventory today ({{count}} items)', { count: inventory.products.length }),
    [
      { label: t('Product'), width: 4.4 },
      { label: t('Stock'), width: 1.8, align: 'right' },
      { label: t('Status'), width: 1.5 },
      { label: t('Stock value'), width: 2, align: 'right' },
    ],
    inventory.products.map((p): Cell[] => [
      { text: p.name },
      { text: `${qty(p.currentStock)} ${p.unit}` },
      { text: STATUS[p.status], color: STATUS_COLOR[p.status], bold: p.status !== 'healthy' },
      { text: php(p.stockValue) },
    ]),
    { total: [{ text: t('Total stock value') }, { text: '' }, { text: '' }, { text: php(inventory.totalValue) }], empty: t('No products.') },
  );

  const restock = demand
    .filter((d) => d.averageDailyDemand > 0 && d.daysOfCover <= RESTOCK_WITHIN_DAYS)
    .sort((a, b) => a.daysOfCover - b.daysOfCover);
  doc.table(
    filtered ? t('Restock soon (all products)') : t('Restock soon'),
    [
      { label: t('Product'), width: 4.4 },
      { label: t('Left'), width: 1.7, align: 'right' },
      { label: t('Sold per day'), width: 1.7, align: 'right' },
      { label: t('Runs out in'), width: 1.7, align: 'right' },
    ],
    restock.map((d): Cell[] => [
      { text: d.productName },
      { text: `${qty(d.currentStock)} ${d.unit}` },
      { text: qty(d.averageDailyDemand) },
      { text: t('~{{days}} days', { days: qty(d.daysOfCover) }), color: d.daysOfCover <= 3 ? '#C0392B' : undefined, bold: d.daysOfCover <= 3 },
    ]),
    {
      empty:
        demand.length === 0 ? t('No forecast yet.') : t('Nothing runs out within {{days}} days.', { days: RESTOCK_WITHIN_DAYS }),
    },
  );

  return doc.finish();
}

/** Saves the report on short bond paper (8.5 x 11 in) as a PDF or a PNG. */
export async function exportReportPaper(
  report: Report,
  info: ReportPaperInfo,
  demand: DemandForecast[],
  format: ExportFormat,
): Promise<void> {
  const pages = buildReportPaper(report, info, demand, await loadLogo());
  await savePaper(pages, 'report', format);
}
