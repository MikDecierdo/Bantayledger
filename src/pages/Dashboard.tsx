import { IonIcon } from '@ionic/react';
import {
  addOutline,
  alertCircleOutline,
  arrowForwardOutline,
  bagOutline,
  cartOutline,
  checkmarkCircleOutline,
  cubeOutline,
  documentTextOutline,
  sparklesOutline,
  swapVerticalOutline,
  trendingUpOutline,
  walletOutline,
} from 'ionicons/icons';
import { useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import BarList from '../components/charts/BarList';
import TrendChart from '../components/charts/TrendChart';
import Button from '../components/common/Button';
import { EmptyState, ErrorState, LoadingState, SkeletonGrid, SkeletonRows } from '../components/common/States';
import { StatusBadge } from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import AIInsightCard from '../components/dashboard/AIInsightCard';
import AlertCard from '../components/dashboard/AlertCard';
import {
  CostForecastCard,
  DemandForecastCard,
  PriceForecastCard,
} from '../components/dashboard/ForecastCard';
import StatCard from '../components/dashboard/StatCard';
import PageHeader from '../components/layout/PageHeader';
import PinnedSummary from '../components/layout/PinnedSummary';
import { Card, Section } from '../components/layout/Section';
import { useAuth } from '../context/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { exportDashboardReceipt } from '../lib/exportDashboard';
import { chooseExportFormat } from '../lib/swal';
import { dataService } from '../services/dataService';
import { greeting, number, peso, pesoCompact, relativeTime } from '../utils/format';
import './Dashboard.css';
import { intlLocale, t } from '../i18n';
import { label } from '../i18n/labels';

export function Dashboard() {
  const { activeBusiness } = useAuth();
  const history = useHistory();
  const { data, loading, error, reload } = useAsyncData(
    () => dataService.getDashboard(),
    [activeBusiness?.id],
  );
  const { showToast } = useToast();
  const [exporting, setExporting] = useState(false);

  const handleExport = async () => {
    if (!data) return;
    const format = await chooseExportFormat('dashboard');
    if (!format) return;

    setExporting(true);
    try {
      await exportDashboardReceipt(data, format);
      showToast(format === 'pdf' ? t('Receipt PDF downloaded.') : t('Receipt image downloaded.'));
    } catch {
      showToast(t('Could not create the export. Please try again.'), 'error');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <LoadingState label={t('Loading your business overview')}>
        <div className="bl-dash__greeting-skeleton" />
        <SkeletonGrid count={4} lines={1} />
        <div style={{ height: 24 }} />
        <SkeletonRows rows={4} />
      </LoadingState>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title={t('Unable to load your dashboard')}
        description={t('We could not reach your business data. Check your connection and try again.')}
        onRetry={reload}
      />
    );
  }

  const { profile, sales, salesLast7Days, expenses, expensesByCategory, products, alerts, insights } =
    data;

  const criticalAlerts = alerts.filter((a) => a.severity === 'critical');
  const activeProducts = products.filter((p) => p.isActive);
  const atRisk = activeProducts.filter((p) => p.status !== 'healthy');
  const lowStockCount = activeProducts.filter((p) => p.status === 'low' || p.status === 'critical').length;
  const outOfStockCount = activeProducts.filter((p) => p.status === 'out').length;

  // These are empty until the forecasting service runs, so every use below
  // has to tolerate `undefined` rather than assume a first element.
  const topDemand = data.demand[0];
  const topPrice = data.price[0];
  const topCost = data.cost[0];
  const topInsight = insights[0];
  const hasForecasts = Boolean(topDemand || topPrice || topCost);

  return (
    <>
      {/*
        The greeting is the first thing on the page. On phones the page title is
        hidden (the sticky bar carries it), so the greeting is repeated here as
        visible text and the header's description is suppressed to avoid saying
        the same thing twice.
      */}
      <div className="bl-dash__greeting bl-only-mobile">
        <h2 className="bl-dash__greeting-title">
          {greeting()}, {profile.firstName} 👋
        </h2>
        <p className="bl-caption">{t('Here\'s your business overview for today.')}</p>
      </div>

      <PageHeader
        title={`${greeting()}, ${profile.firstName} 👋`}
        description={t('Here\'s your business overview for {{businessName}} today.', { businessName: profile.businessName })}
        hideDescriptionOnMobile
        actions={
          <>
            <Button
              variant="secondary"
              icon={documentTextOutline}
              loading={exporting}
              onClick={() => void handleExport()}
            >
              {exporting ? t('Exporting') : t('Export')}
            </Button>
            <Button
              variant="primary"
              icon={addOutline}
              onClick={() => history.push('/sales', { openAdd: true })}
            >
              {t('Record Sale')}
            </Button>
          </>
        }
      />

      {/*
        A handful of one-tap shortcuts for the tasks a small retailer does
        every day, so they don't have to hunt through the menu for them —
        each lands on its page with the relevant "Add" form already open.
        "Record Sale" isn't repeated here since it's already the header's
        primary action above.
      */}
      <div className="bl-grid bl-grid--quickactions">
        <Button
          variant="secondary"
          icon={bagOutline}
          onClick={() => history.push('/purchases', { openAdd: true })}
        >
          {t('New Purchase')}
        </Button>
        <Button
          variant="secondary"
          icon={walletOutline}
          onClick={() => history.push('/expenses', { openAdd: true })}
        >
          {t('Add Expense')}
        </Button>
        <Button
          variant="secondary"
          icon={swapVerticalOutline}
          onClick={() => history.push('/inventory')}
        >
          {t('Update Stock')}
        </Button>
      </div>

      {/* ---- Business summary (KPIs) --------------------------------------- */}
      <PinnedSummary>
        <Section
          title={t('Business summary')}
          description={new Date().toLocaleDateString(intlLocale(), {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        >
          <div className="bl-grid bl-grid--kpi">
            <StatCard
              label={t('Today\'s sales')}
              value={peso(sales.today)}
              changePct={sales.todayChangePct}
              changeLabel={t('vs yesterday')}
              emphasis="hero"
              icon={cartOutline}
              spark={salesLast7Days.map((d) => d.value)}
              href="/sales"
            />
            <StatCard
              label={t('Expenses today')}
              value={peso(expenses.today)}
              changePct={expenses.todayChangePct}
              changeLabel={t('vs yesterday')}
              invertDelta
              icon={walletOutline}
              tone="info"
              href="/expenses"
            />
            <StatCard
              label={t('Low stock')}
              value={String(lowStockCount)}
              emphasis="plain"
              icon={cubeOutline}
              tone="warning"
              footnote={
                outOfStockCount > 0
                  ? t('{{outOfStockCount}} out of stock', { outOfStockCount })
                  : 'products below minimum'
              }
              href="/inventory"
            />
            <StatCard
              label={t('AI alerts')}
              value={String(alerts.filter((a) => !a.read).length)}
              emphasis="plain"
              icon={alertCircleOutline}
              tone="danger"
              footnote={t('{{criticalAlertsCount}} need attention now', { criticalAlertsCount: criticalAlerts.length })}
              href="/alerts"
            />
          </div>
        </Section>
      </PinnedSummary>

      {/* ---- Urgent alerts ----------------------------------------------- */}
      <Section
        title={t('Urgent alerts')}
        description={t('Issues that may affect sales in the next few days')}
        action={
          <Link to="/alerts" className="bl-viewall">
            {t('View all')}
            <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
          </Link>
        }
      >
        {criticalAlerts.length === 0 ? (
          <EmptyState
            icon={checkmarkCircleOutline}
            title={t('No critical alerts')}
            description={t('Nothing needs your immediate attention. We will let you know if that changes.')}
            compact
          />
        ) : (
          <div className="bl-grid bl-grid--2">
            {criticalAlerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </Section>

      {/* ---- Sales / expenses overview ------------------------------------- */}
      <div className="bl-grid bl-grid--split bl-grid--gap-lg bl-dash__split">
        <Section title={t('Sales overview')} description={t('Total sales over the last 7 days')}>
          <Card>
            <div className="bl-dash__chart-head">
              <div>
                <span className="bl-label">{t('This week')}</span>
                <p className="bl-metric">{peso(sales.week)}</p>
              </div>
              <dl className="bl-dash__chart-facts">
                <div>
                  <dt>{t('Transactions today')}</dt>
                  <dd>{sales.transactionsToday}</dd>
                </div>
                <div>
                  <dt>{t('Average basket')}</dt>
                  <dd>{peso(sales.averageBasket)}</dd>
                </div>
              </dl>
            </div>

            <TrendChart
              data={salesLast7Days}
              format={(v) => peso(v)}
              axisFormat={pesoCompact}
              seriesName="Total sales"
              summary={t('Line chart of gross sales over the last seven days, rising from ₱3,620 on Thursday to ₱4,250 on Wednesday, peaking at ₱5,240 on Saturday.')}
              height={210}
            />
          </Card>
        </Section>

        <Section title={t('Expense overview')} description={t('Month to date by category')}>
          <Card>
            <div className="bl-dash__expense-head">
              <div>
                <span className="bl-label">{t('Month to date')}</span>
                <p className="bl-metric">{peso(expenses.monthToDate)}</p>
              </div>
              <p className="bl-caption">
                {t('Largest: {{largestCategory}} ({{v2}})', { largestCategory: expenses.largestCategory, v2: peso(expenses.largestCategoryAmount) })}
              </p>
            </div>
            <BarList data={expensesByCategory.slice(0, 5)} format={(v) => peso(v)} />
            <Link to="/expenses" className="bl-viewall bl-dash__card-link">
              {t('View all expenses')}
              <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
            </Link>
          </Card>
        </Section>
      </div>

      {/* ---- Inventory risks ------------------------------------------------ */}
      <Section
        title={t('Inventory risks')}
        description={t('Products below their minimum stock level')}
        action={
          <Link to="/inventory" className="bl-viewall">
            {t('Open inventory')}
            <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
          </Link>
        }
      >
        {atRisk.length === 0 ? (
          <EmptyState
            icon={checkmarkCircleOutline}
            title={t('All products are healthy')}
            description={t('Every product is above its minimum stock level.')}
            compact
          />
        ) : (
          <Card padding="none">
            <ul className="bl-risklist">
              {atRisk.map((product) => {
                const cover = product.currentStock / (product.averageDailyDemand || 1);
                return (
                  <li key={product.id}>
                    <Link to={`/inventory/${product.id}`} className="bl-risklist__row">
                      <span className="bl-risklist__main">
                        <span className="bl-risklist__name">{product.name}</span>
                        <span className="bl-caption">
                          {t('{{stock}} of {{min}} {{unit}} minimum', {
                            stock: number(product.currentStock),
                            min: number(product.minimumStock),
                            unit: product.unit,
                          })}
                        </span>
                      </span>

                      <span className="bl-risklist__cover bl-hide-mobile">
                        <span className="bl-caption">{t('Days of cover')}</span>
                        <span className="bl-risklist__cover-value">
                          {product.currentStock === 0 ? '0' : number(cover)}
                        </span>
                      </span>

                      <StatusBadge status={product.status} />
                      <IonIcon
                        icon={arrowForwardOutline}
                        className="bl-risklist__chev"
                        aria-hidden="true"
                      />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        )}
      </Section>

      {/* ---- Forecasts ------------------------------------------------------ */}
      <Section
        title={t('Forecast highlights')}
        description={t('What your records suggest is coming next')}
        action={
          <Link to="/forecast" className="bl-viewall">
            {t('Full forecast')}
            <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
          </Link>
        }
      >
        {!hasForecasts ? (
          <EmptyState
            icon={trendingUpOutline}
            title={t('No forecasts yet')}
            description={t('Forecasts appear once there is enough sales and purchase history to learn from. Keep recording your day-to-day figures.')}
            compact
          />
        ) : (
          <div className="bl-grid bl-grid--3">
            {topDemand && (
              <div className="bl-dash__forecast-col">
                <h3 className="bl-dash__forecast-label">
                  <IonIcon icon={trendingUpOutline} aria-hidden="true" />
                  {t('Expected sales')}
                </h3>
                <DemandForecastCard forecast={topDemand} />
              </div>
            )}

            {topPrice && (
              <div className="bl-dash__forecast-col">
                <h3 className="bl-dash__forecast-label">
                  <IonIcon icon={walletOutline} aria-hidden="true" />
                  {t('Price forecast')}
                </h3>
                <PriceForecastCard forecast={topPrice} />
              </div>
            )}

            {topCost && (
              <div className="bl-dash__forecast-col">
                <h3 className="bl-dash__forecast-label">
                  <IonIcon icon={cartOutline} aria-hidden="true" />
                  {t('Purchasing cost forecast')}
                </h3>
                <CostForecastCard forecast={topCost} />
              </div>
            )}
          </div>
        )}
      </Section>

      {/* ---- AI insight + recent transactions ------------------------------- */}
      <div className="bl-grid bl-grid--split bl-grid--gap-lg">
        <Section
          title={t('Recent transactions')}
          description={t('Latest recorded sales')}
          action={
            <Link to="/sales" className="bl-viewall">
              {t('View all')}
              <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
            </Link>
          }
        >
          <Card padding="none">
            <ul className="bl-txlist">
              {data.recentSales.map((sale) => (
                <li key={sale.id} className="bl-txlist__row">
                  <span className="bl-txlist__icon" aria-hidden="true">
                    <IonIcon icon={cartOutline} />
                  </span>
                  <span className="bl-txlist__main">
                    <span className="bl-txlist__title">
                      {sale.items[0]?.productName ?? t('Sale')}
                      {sale.items.length > 1 && (
                        <span className="bl-txlist__more">{t('+{{v1}} more', { v1: sale.items.length - 1 })}</span>
                      )}
                    </span>
                    <span className="bl-caption">
                      {sale.reference} · {label(sale.paymentMethod)} · {sale.time}
                    </span>
                  </span>
                  <span className="bl-txlist__amount">{peso(sale.total)}</span>
                </li>
              ))}
            </ul>
          </Card>
        </Section>

        <Section
          title={t('AI insights')}
          description={t('Generated from your recorded data')}
          action={
            <Link to="/ai-insights" className="bl-viewall">
              {t('View all')}
              <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
            </Link>
          }
        >
          {!topInsight ? (
            <EmptyState
              icon={sparklesOutline}
              title={t('No insights yet')}
              description={t('Insights are generated from your recorded sales, stock and supplier prices. They will appear here once there is enough history.')}
              compact
            />
          ) : (
            <div className="bl-stack">
              <AIInsightCard insight={topInsight} />
              {insights.slice(1, 3).map((insight) => (
                <AIInsightCard key={insight.id} insight={insight} compact />
              ))}
            </div>
          )}
        </Section>
      </div>

      {topInsight && (
        <p className="bl-dash__updated bl-caption">
          <IonIcon icon={sparklesOutline} aria-hidden="true" />
          {t('Forecasts and insights last updated {{v1}}.', { v1: relativeTime(topInsight.generatedAt) })}
        </p>
      )}
    </>
  );
}

export default Dashboard;
