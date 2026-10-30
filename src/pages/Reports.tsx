import {
  bagOutline,
  cartOutline,
  cubeOutline,
  downloadOutline,
  printOutline,
  trendingUpOutline,
  walletOutline,
} from 'ionicons/icons';
import { useEffect, useState, type ReactNode } from 'react';
import BarChart from '../components/charts/BarChart';
import BarList from '../components/charts/BarList';
import TrendChart from '../components/charts/TrendChart';
import Button from '../components/common/Button';
import { DateField, SelectField } from '../components/common/Field';
import { ErrorState, LoadingState, SkeletonGrid } from '../components/common/States';
import { StatusBadge } from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import { Segmented } from '../components/common/Toolbar';
import PageHeader from '../components/layout/PageHeader';
import { Card, Section } from '../components/layout/Section';
import { useAuth } from '../context/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { exportReportReceipt } from '../lib/exportReports';
import { chooseExportFormat } from '../lib/swal';
import { categoryService, type Report } from '../services/api';
import { dataService, usesLiveData } from '../services/dataService';
import type { SeriesPoint } from '../types';
import { number, peso, pesoCompact } from '../utils/format';
import './Reports.css';
import { intlLocale, t } from '../i18n';

type ReportTab = 'sales' | 'expenses' | 'inventory' | 'purchasing' | 'forecast';
type Period = '30d' | '3m' | '6m' | '12m' | 'custom';

const TABS: { value: ReportTab; label: string; icon: string }[] = [
  { value: 'sales', label: t('Sales'), icon: cartOutline },
  { value: 'expenses', label: t('Expenses'), icon: walletOutline },
  { value: 'inventory', label: t('Inventory'), icon: cubeOutline },
  { value: 'purchasing', label: t('Purchasing'), icon: bagOutline },
  { value: 'forecast', label: t('Forecast'), icon: trendingUpOutline },
];

const PERIODS: { value: Period; label: string }[] = [
  { value: '30d', label: t('Last 30 days') },
  { value: '3m', label: t('Last 3 months') },
  { value: '6m', label: t('Last 6 months') },
  { value: '12m', label: t('Last 12 months') },
  { value: 'custom', label: t('Custom range') },
];

const MAX_SPAN_DAYS = 731;

interface DateRange {
  from: string;
  to: string;
}

/** Local-time YYYY-MM-DD (toISOString would shift to UTC and can land on yesterday). */
function isoDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(s: string): Date {
  return new Date(`${s}T00:00:00`);
}

function presetRange(period: Exclude<Period, 'custom'>): DateRange {
  const to = new Date();
  const from = new Date(to);
  if (period === '30d') from.setDate(from.getDate() - 29);
  else {
    from.setMonth(from.getMonth() - { '3m': 3, '6m': 6, '12m': 12 }[period]);
    from.setDate(from.getDate() + 1);
  }
  return { from: isoDate(from), to: isoDate(to) };
}

function shortDate(s: string, withYear: boolean): string {
  return parseIso(s).toLocaleDateString(intlLocale(), {
    month: 'short',
    day: 'numeric',
    ...(withYear ? { year: 'numeric' } : {}),
  });
}

function rangeLabel(range: DateRange): string {
  const sameYear = range.from.slice(0, 4) === range.to.slice(0, 4);
  return `${shortDate(range.from, !sameYear)} – ${shortDate(range.to, true)}`;
}

/** Plain-language chart description for screen readers, from the real figures. */
function describe(series: SeriesPoint[], what: string, unit: string): string {
  const total = series.reduce((sum, p) => sum + p.value, 0);
  if (total === 0) return t('No {{what}} recorded in this period.', { what });
  const peak = series.reduce((best, p) => (p.value > best.value ? p : best), series[0]);
  return t('{{what}} per {{unit}}, {{v3}} to {{v4}}: {{v5}} in total, highest {{v6}} ({{label}}).', { what, unit, v3: series[0].label, v4: series[series.length - 1].label, v5: peso(total), v6: peso(peak.value), label: peak.label });
}

export function Reports() {
  const { activeBusiness } = useAuth();
  const { showToast } = useToast();
  const [tab, setTab] = useState<ReportTab>('sales');

  const [period, setPeriod] = useState<Period>('6m');
  const [range, setRange] = useState<DateRange>(() => presetRange('6m'));
  const [customFrom, setCustomFrom] = useState(range.from);
  const [customTo, setCustomTo] = useState(range.to);
  const [rangeError, setRangeError] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState('all');

  const [exporting, setExporting] = useState(false);
  const [printing, setPrinting] = useState(false);

  const { data: report, loading, error, reload } = useAsyncData(
    () =>
      dataService.getReport({
        from: range.from,
        to: range.to,
        categoryId: categoryId === 'all' ? null : categoryId,
      }),
    [activeBusiness?.id, range.from, range.to, categoryId],
  );
  // Forecasts look ahead, so they don't follow the date filter.
  const { data: forecasts } = useAsyncData(() => dataService.getForecasts(), [activeBusiness?.id]);
  const { data: categories } = useAsyncData(
    () => (usesLiveData() && activeBusiness ? categoryService.list(activeBusiness.id) : Promise.resolve([])),
    [activeBusiness?.id],
  );

  const choosePeriod = (next: Period) => {
    setPeriod(next);
    if (next === 'custom') return;
    const r = presetRange(next);
    setRange(r);
    setCustomFrom(r.from);
    setCustomTo(r.to);
    setRangeError(null);
  };

  // Custom dates only apply once they make a valid range, so a half-typed
  // date never fires a request the server would reject.
  const applyCustom = (from: string, to: string) => {
    setCustomFrom(from);
    setCustomTo(to);
    if (!from || !to) return;
    if (from > to) {
      setRangeError(t('The start date must be on or before the end date.'));
      return;
    }
    if ((parseIso(to).getTime() - parseIso(from).getTime()) / 86_400_000 + 1 > MAX_SPAN_DAYS) {
      setRangeError(t('Reports can cover at most two years at a time.'));
      return;
    }
    setRangeError(null);
    setRange({ from, to });
  };

  const categoryName =
    categoryId === 'all' ? null : (categories ?? []).find((c) => c.id === categoryId)?.name ?? null;
  const periodLabel = categoryName ? `${rangeLabel(range)} · ${categoryName}` : rangeLabel(range);

  const handleExport = async () => {
    if (!report) return;
    const format = await chooseExportFormat('report');
    if (!format) return;

    setExporting(true);
    try {
      await exportReportReceipt(report, activeBusiness?.name ?? '', periodLabel, forecasts?.demand ?? [], format);
      showToast(format === 'pdf' ? t('Receipt PDF downloaded.') : t('Receipt image downloaded.'));
    } catch {
      showToast(t('Could not create the export. Please try again.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  // Printing renders every section (not just the open tab), then hands off to
  // the browser's print dialog once that has painted.
  useEffect(() => {
    if (!printing) return;
    const done = () => setPrinting(false);
    window.addEventListener('afterprint', done, { once: true });
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => window.print());
    });
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('afterprint', done);
    };
  }, [printing]);

  const header = (
    <PageHeader
      title={t('Reports')}
      description={t('Summaries you can review, compare and hand to your bookkeeper.')}
      actions={
        <>
          <Button
            variant="secondary"
            icon={printOutline}
            className="bl-noexport"
            disabled={!report}
            onClick={() => setPrinting(true)}
          >
            {t('Print')}
          </Button>
          <Button
            variant="primary"
            icon={downloadOutline}
            className="bl-noexport"
            disabled={!report}
            loading={exporting}
            onClick={() => void handleExport()}
          >
            {exporting ? t('Exporting') : t('Export')}
          </Button>
        </>
      }
    />
  );

  const filters = (
    <Card className="bl-rep__filters bl-noexport" padding="tight">
      <div className="bl-rep__filters-row">
        <SelectField
          label={t('Reporting period')}
          value={period}
          onChange={(e) => choosePeriod(e.target.value as Period)}
          options={PERIODS}
        />
        <DateField
          label={t('From')}
          value={period === 'custom' ? customFrom : range.from}
          max={period === 'custom' ? customTo : undefined}
          disabled={period !== 'custom'}
          onChange={(e) => applyCustom(e.target.value, customTo)}
        />
        <DateField
          label={t('To')}
          value={period === 'custom' ? customTo : range.to}
          min={period === 'custom' ? customFrom : undefined}
          disabled={period !== 'custom'}
          onChange={(e) => applyCustom(customFrom, e.target.value)}
        />
        <SelectField
          label={t('Product category')}
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
          options={[
            { value: 'all', label: t('All categories') },
            ...(categories ?? []).map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </div>
      {rangeError && (
        <p className="bl-form-error bl-rep__filters-error" role="alert">
          {rangeError}
        </p>
      )}
    </Card>
  );

  let body: ReactNode;
  if (loading) {
    body = (
      <LoadingState label={t('Loading reports')}>
        <SkeletonGrid count={4} lines={2} />
      </LoadingState>
    );
  } else if (error || !report) {
    body = (
      <ErrorState
        title={t('Unable to load reports')}
        description={t('We could not assemble your reports. Please try again.')}
        onRetry={reload}
      />
    );
  } else {
    body = (
      <ReportBody
        report={report}
        periodLabel={periodLabel}
        tab={tab}
        onTabChange={setTab}
        printing={printing}
        forecasts={forecasts}
      />
    );
  }

  return (
    <div className={printing ? 'bl-rep bl-rep--printing' : 'bl-rep'}>
      {header}
      <p className="bl-rep__printmeta">
        {activeBusiness?.name} · {periodLabel}
      </p>
      {filters}
      {body}
    </div>
  );
}

function ReportBody({
  report,
  periodLabel,
  tab,
  onTabChange,
  printing,
  forecasts,
}: {
  report: Report;
  periodLabel: string;
  tab: ReportTab;
  onTabChange: (tab: ReportTab) => void;
  printing: boolean;
  forecasts: Awaited<ReturnType<typeof dataService.getForecasts>> | null;
}) {
  const { summary, sales, expenses, purchases, inventory, range } = report;
  const unit = range.granularity;
  const filtered = range.categoryName !== null;

  const sections: Record<ReportTab, ReactNode> = {
    sales: (
      <Section title={t('Sales report')} description={t('Revenue per {{unit}} and by product category', { unit })}>
        <div className="bl-grid bl-grid--split bl-grid--gap-lg">
          <Card title={t('Revenue per {{unit}}', { unit })}>
            <TrendChart
              data={sales.series}
              format={(v) => peso(v)}
              axisFormat={pesoCompact}
              seriesName="Revenue"
              summary={describe(sales.series, t('Revenue'), unit)}
              height={250}
            />
          </Card>
          <Card title={t('Revenue by category')} description={periodLabel}>
            {sales.byCategory.length === 0 ? (
              <p className="bl-caption">{t('No sales in this period.')}</p>
            ) : (
              <BarList data={sales.byCategory} format={(v) => peso(v)} />
            )}
          </Card>
        </div>
      </Section>
    ),
    expenses: (
      <Section
        title={t('Expense report')}
        description={
          filtered
            ? t('Operating costs — all categories (expenses aren’t linked to products)')
            : t('Operating costs per {{unit}} and by category', { unit })
        }
      >
        <div className="bl-grid bl-grid--split bl-grid--gap-lg">
          <Card title={t('Expenses per {{unit}}', { unit })}>
            <BarChart
              data={expenses.series}
              format={(v) => peso(v)}
              axisFormat={pesoCompact}
              seriesName="Expenses"
              summary={describe(expenses.series, t('Expenses'), unit)}
              height={250}
            />
          </Card>
          <Card title={t('Expenses by category')} description={rangeLabel(range)}>
            {expenses.byCategory.length === 0 ? (
              <p className="bl-caption">{t('No expenses in this period.')}</p>
            ) : (
              <BarList data={expenses.byCategory} format={(v) => peso(v)} />
            )}
          </Card>
        </div>
      </Section>
    ),
    inventory: (
      <Section
        title={t('Inventory report')}
        description={
          filtered
            ? t('Stock position as of today · {{category}} — not tied to the date range', { category: range.categoryName })
            : t('Stock position as of today — not tied to the date range')
        }
      >
        <Card padding="none">
          <div className="bl-table-wrap bl-scroll">
            <table className="bl-table">
              <caption className="bl-sr-only">{t('Stock position and value for every tracked product')}</caption>
              <thead>
                <tr>
                  <th scope="col">{t('Product')}</th>
                  <th scope="col">{t('Category')}</th>
                  <th scope="col" className="bl-td-num">
                    {t('On hand')}
                  </th>
                  <th scope="col" className="bl-td-num">
                    {t('Minimum')}
                  </th>
                  <th scope="col" className="bl-td-num">
                    {t('Stock value')}
                  </th>
                  <th scope="col">{t('Status')}</th>
                </tr>
              </thead>
              <tbody>
                {inventory.products.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="bl-caption">
                      {filtered ? t('No products in this category.') : t('No products.')}
                    </td>
                  </tr>
                ) : (
                  inventory.products.map((product) => (
                    <tr key={product.id}>
                      <td className="bl-table__primary">{product.name}</td>
                      <td>{product.category}</td>
                      <td className="bl-td-num">
                        {number(product.currentStock)} {product.unit}
                      </td>
                      <td className="bl-td-num">{number(product.minimumStock)}</td>
                      <td className="bl-td-num">{peso(product.stockValue)}</td>
                      <td>
                        <StatusBadge status={product.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr>
                  <th scope="row" colSpan={4}>
                    {t('Total stock value')}
                  </th>
                  <td className="bl-td-num bl-table__primary">{peso(inventory.totalValue)}</td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </Section>
    ),
    purchasing: (
      <Section title={t('Purchasing report')} description={t('Received stock orders per {{unit}}', { unit })}>
        <Card title={t('Purchasing spend per {{unit}}', { unit })}>
          <BarChart
            data={purchases.series}
            format={(v) => peso(v)}
            axisFormat={pesoCompact}
            seriesName="Purchasing spend"
            summary={describe(purchases.series, t('Purchasing spend'), unit)}
            height={260}
          />
        </Card>
      </Section>
    ),
    forecast: (
      <Section
        title={t('Forecast report')}
        description={t('Forecasts look ahead, so they aren\'t affected by the filters above')}
      >
        <div className="bl-grid bl-grid--split bl-grid--gap-lg">
          <Card title={t('Expected sales')} description={t('Next 7 days, per product')}>
            {(forecasts?.demand ?? []).length === 0 ? (
              <p className="bl-caption">
                {t('No forecasts yet. Open the Forecast page to generate them from your sales history.')}
              </p>
            ) : (
              <BarList
                data={(forecasts?.demand ?? []).map((d) => ({ label: d.productName, value: d.forecastQuantity }))}
                format={(v) => number(v)}
                showShare={false}
              />
            )}
          </Card>
          <Card title={t('Forecast accuracy')}>
            <p className="bl-caption">
              {t('Accuracy is measured by comparing past forecasts against what actually sold. It appears once forecasts have been running for a few weeks.')}
            </p>
            <p className="bl-rep__note">
              {t('Forecasts are estimates based on your recorded history. They do not account for events outside your data, such as holidays or supplier shortages.')}
            </p>
          </Card>
        </div>
      </Section>
    ),
  };

  return (
    <>
      {/* ---- Headline figures ------------------------------------------------ */}
      <Section title={t('Period summary')} description={periodLabel}>
        <div className="bl-grid bl-grid--kpi">
          <Card className="bl-rep__sum">
            <span className="bl-label">{t('Revenue')}</span>
            <p className="bl-metric">{peso(summary.revenue)}</p>
            <p className="bl-caption">
              {summary.transactions === 1
                ? t('1 sale recorded')
                : t('{{count}} sales recorded', { count: summary.transactions })}
            </p>
          </Card>
          <Card className="bl-rep__sum">
            <span className="bl-label">{t('Stock purchased')}</span>
            <p className="bl-metric">{peso(summary.purchases)}</p>
            <p className="bl-caption">{t('Received orders from suppliers')}</p>
          </Card>
          <Card className="bl-rep__sum">
            <span className="bl-label">{t('Operating expenses')}</span>
            <p className="bl-metric">{peso(summary.expenses)}</p>
            <p className="bl-caption">
              {filtered ? t('All categories — not linked to products') : t('Rent, utilities, wages and more')}
            </p>
          </Card>
          <Card className={`bl-rep__sum ${summary.netPosition >= 0 ? 'bl-rep__sum--good' : 'bl-rep__sum--bad'}`}>
            <span className="bl-label">{t('Net position')}</span>
            <p className="bl-metric">{peso(summary.netPosition)}</p>
            <p className="bl-caption">{t('Revenue less purchases and expenses')}</p>
          </Card>
        </div>
      </Section>

      {/* ---- Report tabs ------------------------------------------------------ */}
      <div className="bl-rep__tabs bl-noexport">
        <Segmented
          label={t('Select a report')}
          value={tab}
          onChange={onTabChange}
          options={TABS.map((t) => ({ value: t.value, label: t.label }))}
        />
      </div>

      {printing ? TABS.map((t) => <div key={t.value}>{sections[t.value]}</div>) : sections[tab]}
    </>
  );
}

export default Reports;
