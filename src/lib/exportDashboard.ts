import type { DashboardData } from '../services/dataService';
import { type ExportFormat, ReceiptBuilder, type ReceiptLine, pct, php, qty, receiptTimestamp, saveReceipt } from './receipt';
import { t } from '../i18n';
import { label } from '../i18n/labels';

const STATUS = { healthy: t('ENOUGH'), low: t('LOW'), critical: t('ALMOST OUT'), out: t('OUT') } as const;

/** Stock running out sooner than this many days shows up in the restock list. */
const RESTOCK_WITHIN_DAYS = 14;

/** The dashboard's important figures as a receipt-style list. */
export function buildDashboardReceipt(data: DashboardData): ReceiptLine[] {
  const { profile, sales, expenses, expensesByCategory, products, alerts, recentSales, demand } = data;
  const r = new ReceiptBuilder();

  r.center(profile.businessName || t('My Business'), true)
    .center(t('BUSINESS SUMMARY'))
    .center(receiptTimestamp());

  r.section(t('Sales'), () => {
    r.row(t('Today'), php(sales.today))
      .row(t('{{pct}} vs yesterday', { pct: pct(sales.todayChangePct) }), '', { indent: 2 })
      .row(t('This week'), php(sales.week))
      .row(t('{{pct}} vs last week', { pct: pct(sales.weekChangePct) }), '', { indent: 2 })
      .row(t('This month'), php(sales.month))
      .row(t('{{pct}} vs last month', { pct: pct(sales.monthChangePct) }), '', { indent: 2 })
      .row(t('Sales today'), String(sales.transactionsToday))
      .row(t('Average sale today'), php(sales.averageBasket))
      .row(t('Cash today'), php(sales.todayCash))
      .row(t('GCash today'), php(sales.todayGCash));
  });

  r.section(t('Expenses'), () => {
    r.row(t('Today'), php(expenses.today)).row(t('This month'), php(expenses.monthToDate));
    if (expensesByCategory.length === 0) r.text(t('No expenses this month.'));
    else {
      r.text(t('This month by category:'));
      for (const c of expensesByCategory) r.row(c.label, php(c.value), { indent: 2 });
    }
  });

  const needsAttention = products.filter((p) => p.isActive && p.status !== 'healthy');
  r.section(t('Stock alerts ({{count}})', { count: needsAttention.length }), () => {
    if (needsAttention.length === 0) r.text(t('All stock levels are healthy.'));
    for (const p of needsAttention) {
      r.row(p.name);
      r.row(t('{{qty}} {{unit}} (low at {{min}})', { qty: qty(p.currentStock), unit: p.unit, min: qty(p.minimumStock) }), STATUS[p.status], { indent: 2 });
    }
  });

  r.section(t('Inventory ({{count}} items)', { count: products.length }), () => {
    if (products.length === 0) r.text(t('No products yet.'));
    for (const p of products) {
      r.row(p.name);
      r.row(`${qty(p.currentStock)} ${p.unit}`, `@ ${php(p.sellingPrice)}`, { indent: 2 });
    }
  });

  r.section(t('Recent sales'), () => {
    if (recentSales.length === 0) r.text(t('No sales recorded yet.'));
    for (const s of recentSales) {
      r.row(`${s.reference}  ${s.date}`, php(s.total));
      r.row(s.items.map((i) => `${i.productName} x${qty(i.quantity)}`).join(', ') + ` (${label(s.paymentMethod)}${s.paymentReference ? ` ...${s.paymentReference}` : ''})`, '', { indent: 2 });
    }
  });

  const restock = demand.filter((d) => d.averageDailyDemand > 0 && d.daysOfCover <= RESTOCK_WITHIN_DAYS);
  r.section(t('Restock soon'), () => {
    if (demand.length === 0) r.text(t('No forecast yet.'));
    else if (restock.length === 0) r.text(t('Nothing runs out within {{days}} days.', { days: RESTOCK_WITHIN_DAYS }));
    for (const d of restock) {
      r.row(d.productName);
      r.row(t('{{qty}} {{unit}} left', { qty: qty(d.currentStock), unit: d.unit }), t('~{{days}} days', { days: qty(d.daysOfCover) }), { indent: 2 });
    }
  });

  const unread = alerts.filter((a) => !a.read);
  r.section(t('Alerts ({{count}} unread)', { count: unread.length }), () => {
    if (unread.length === 0) r.text(t('No unread alerts.'));
    for (const a of unread) r.row(`${a.severity === 'critical' ? '!' : '-'} ${a.title}`);
  });

  return r.footer().lines;
}

export function exportDashboardReceipt(data: DashboardData, format: ExportFormat): Promise<void> {
  return saveReceipt(buildDashboardReceipt(data), 'dashboard', format);
}
