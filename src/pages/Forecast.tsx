import { IonIcon } from '@ionic/react';
import {
  cartOutline,
  checkmarkCircleOutline,
  informationCircleOutline,
  refreshOutline,
  trendingUpOutline,
  walletOutline,
  warningOutline,
} from 'ionicons/icons';
import { useState } from 'react';
import BarChart from '../components/charts/BarChart';
import ForecastChart from '../components/charts/ForecastChart';
import Button from '../components/common/Button';
import { EmptyState, ErrorState, LoadingState, SkeletonGrid } from '../components/common/States';
import { Badge } from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import { Segmented } from '../components/common/Toolbar';
import {
  CostForecastCard,
  DemandForecastCard,
  PriceForecastCard,
} from '../components/dashboard/ForecastCard';
import PriceWhatIf from '../components/forecast/PriceWhatIf';
import PageHeader from '../components/layout/PageHeader';
import PinnedSummary from '../components/layout/PinnedSummary';
import { Card, Section } from '../components/layout/Section';
import { Bento, Workspace } from '../components/layout/Workspace';
import { useAuth } from '../context/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { toUserMessage } from '../lib/errors';
import { dataService } from '../services/dataService';
import { number, peso, pesoCompact, relativeTime } from '../utils/format';
import './Forecast.css';
import { t } from '../i18n';

type Horizon = '7d' | '14d' | '30d';

const HORIZONS: { value: Horizon; label: string }[] = [
  { value: '7d', label: t('Next 7 days') },
  { value: '14d', label: t('Next 14 days') },
  { value: '30d', label: t('Next 30 days') },
];

export function Forecast() {
  const { activeBusiness } = useAuth();
  const { showToast } = useToast();
  const { data, loading, error, reload } = useAsyncData(async () => {
    // Regenerates only if the last run is over a day old. A failure here
    // shouldn't block showing the forecasts that already exist.
    await dataService.refreshForecasts(true).catch(() => undefined);
    return dataService.getForecasts();
  }, [activeBusiness?.id]);
  const [horizon, setHorizon] = useState<Horizon>('7d');
  const [selected, setSelected] = useState(0);
  const [productTab, setProductTab] = useState<'demand' | 'price' | 'cost'>('demand');
  const [resultTab, setResultTab] = useState<'trends' | 'accuracy'>('trends');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dataService.refreshForecasts();
      reload();
      showToast(t('Forecasts updated from your latest records.'));
    } catch (err) {
      showToast(toUserMessage(err, t('Could not refresh forecasts. Please try again.')), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const header = (
    <PageHeader
      title={t('Forecast')}
      description={t('What your records suggest about demand, supplier prices and purchasing cost.')}
      actions={
        <>
          <Segmented
            label={t('Forecast horizon')}
            value={horizon}
            onChange={setHorizon}
            options={HORIZONS}
          />
          <Button
            variant="secondary"
            icon={refreshOutline}
            loading={refreshing}
            onClick={() => void handleRefresh()}
          >
            {refreshing ? t('Refreshing') : t('Refresh forecast')}
          </Button>
        </>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label={t('Loading forecasts')}>
          <SkeletonGrid count={3} lines={4} />
        </LoadingState>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <ErrorState
          title={t('Unable to load forecasts')}
          description={t('We could not calculate your forecasts right now. Please try again.')}
          onRetry={reload}
        />
      </>
    );
  }

  const { demand, price, cost, accuracy, forecastVsActual, generatedAt } = data;

  // Empty until the forecasting service runs. `demand[-1]` would be undefined
  // and every read off it would throw, so the whole section is conditional.
  const active = demand.length > 0 ? demand[Math.min(selected, demand.length - 1)] : null;

  const totalCost = cost.reduce((sum, c) => sum + c.estimatedCost, 0);
  const totalPrevious = cost.reduce((sum, c) => sum + c.previousCost, 0);
  const totalDiff = totalCost - totalPrevious;

  const shortfalls = demand.filter((d) => d.forecastQuantity > d.currentStock);

  const updatedText = generatedAt
    ? t('Last updated {{v1}} from your recorded sales and purchases.', { v1: relativeTime(generatedAt) })
    : t('Not generated yet — add some sales, then use Refresh forecast.');

  const productDescriptions = {
    demand: t('Expected sales volume for the next 7 days'),
    price: t('Where supplier unit prices are heading over the next quarter'),
    cost: t('Expected sales multiplied by the estimated price per piece'),
  };

  return (
    <Workspace className="bl-fcast">
      {header}

      <p className="bl-caption bl-fcast__updated bl-fit-hide">{updatedText}</p>

      {/* Horizon is a display control in this preview. */}
      {horizon !== '7d' && (
        <div className="bl-fcast__notice" role="status">
          <IonIcon icon={informationCircleOutline} aria-hidden="true" />
          <p>
            {t('Longer horizons are not available in this preview. Figures below cover the next 7 days.')}
          </p>
        </div>
      )}

      {/* ---- Summary --------------------------------------------------------- */}
      <PinnedSummary>
        <Section title={t('Forecast summary')} description={t('Across all tracked products')}>
          <div className="bl-grid bl-grid--kpi">
            <Card className="bl-fcast__sum">
              <span className="bl-label">{t('Products needing reorder')}</span>
              <p className="bl-metric">{shortfalls.length}</p>
              <p className="bl-caption">
                {t('of {{demandCount}} tracked products are expected to sell more than you have in stock', { demandCount: demand.length })}
              </p>
            </Card>
            <Card className="bl-fcast__sum">
              <span className="bl-label">{t('Estimated purchasing cost')}</span>
              <p className="bl-metric">{peso(totalCost)}</p>
              <p className="bl-caption">
                {totalDiff >= 0
                  ? t('About {{amount}} more than your last orders', { amount: peso(Math.abs(totalDiff)) })
                  : t('About {{amount}} less than your last orders', { amount: peso(Math.abs(totalDiff)) })}
              </p>
            </Card>
            <Card className="bl-fcast__sum">
              <span className="bl-label">{t('Prices trending up')}</span>
              <p className="bl-metric">{price.filter((p) => p.trend === 'up').length}</p>
              <p className="bl-caption">{t('supplier prices expected to rise this quarter')}</p>
            </Card>
            <Card className="bl-fcast__sum">
              <span className="bl-label">{t('How sure we are (average)')}</span>
              <p className="bl-metric">
                {demand.length > 0
                  ? `${Math.round(demand.reduce((s, d) => s + d.confidence, 0) / demand.length)}%`
                  : '—'}
              </p>
              <p className="bl-caption">{t('across all expected-sales forecasts')}</p>
            </Card>
          </div>
        </Section>
      </PinnedSummary>

      <Bento rows="minmax(0, 1.15fr) minmax(0, 1fr)">
        {/* ---- Demand chart --------------------------------------------------- */}
        <Card fill as="h2" className="bl-span-7" title={t('Expected sales')} description={updatedText}>
          {!active ? (
            <EmptyState
              icon={trendingUpOutline}
              title={t('No expected sales yet')}
              description={t('Once you have recorded enough sales, forecasts for each product will appear here.')}
              compact
            />
          ) : (
            <>
              <div className="bl-fcast__picker" role="tablist" aria-label={t('Select a product to chart')}>
                {demand.map((d, i) => (
                  <button
                    key={d.productId}
                    type="button"
                    role="tab"
                    className="bl-chip"
                    aria-selected={selected === i}
                    aria-pressed={selected === i}
                    onClick={() => setSelected(i)}
                  >
                    {d.productName}
                  </button>
                ))}
              </div>

              <div className="bl-fcast__detail">
                <div className="bl-fcast__detail-head">
                  <div>
                    <h3 className="bl-section-title">{active.productName}</h3>
                    <p className="bl-caption">{t('Next {{horizonDays}} days', { horizonDays: active.horizonDays })}</p>
                  </div>
                  <div className="bl-fcast__detail-stats">
                    <div>
                      <span className="bl-label">{t('Forecast')}</span>
                      <p className="bl-fcast__stat-value">
                        {number(active.forecastQuantity)} {active.unit}
                      </p>
                    </div>
                    <div>
                      <span className="bl-label">{t('Expected range')}</span>
                      <p className="bl-fcast__stat-value">
                        {number(active.rangeLow)}–{number(active.rangeHigh)}
                      </p>
                    </div>
                    <div>
                      <span className="bl-label">{t('Confidence')}</span>
                      <p className="bl-fcast__stat-value">{active.confidence}%</p>
                    </div>
                  </div>
                </div>

                <ForecastChart
                  data={active.series}
                  format={(v) => `${number(v)} ${active.unit}`}
                  axisFormat={(v) => number(v, 0)}
                  measure="Units"
                  summary={t('Chart of {{productName}} daily demand: seven recorded days, then a seven-day forecast totalling {{v2}} {{unit}}, expected range {{v4}} to {{v5}}.', { productName: active.productName, v2: number(active.forecastQuantity), unit: active.unit, v4: number(active.rangeLow), v5: number(active.rangeHigh) })}
                  height={250}
                  fill
                />
              </div>
            </>
          )}
        </Card>

        {/* ---- Per-product forecasts (expected sales / price / cost) ----------- */}
        <Card
          fill
          as="h2"
          className="bl-span-5"
          title={t('Product forecasts')}
          description={productDescriptions[productTab]}
          action={
            <Segmented
              label={t('Product forecasts')}
              value={productTab}
              onChange={setProductTab}
              options={[
                { value: 'demand', label: t('Sales') },
                { value: 'price', label: t('Prices') },
                { value: 'cost', label: t('Cost') },
              ]}
            />
          }
        >
          {productTab === 'demand' &&
            (demand.length === 0 ? (
              <EmptyState
                icon={trendingUpOutline}
                title={t('No expected sales yet')}
                description={t('Once you have recorded enough sales, forecasts for each product will appear here.')}
                compact
              />
            ) : (
              <div className="bl-fcast__cards">
                {demand.map((forecast) => (
                  <DemandForecastCard key={forecast.productId} forecast={forecast} />
                ))}
              </div>
            ))}

          {productTab === 'price' &&
            (price.length === 0 ? (
              <EmptyState
                icon={walletOutline}
                title={t('No price forecasts yet')}
                description={t('Supplier price forecasts appear once there are enough recorded purchases to spot a trend.')}
                compact
              />
            ) : (
              <div className="bl-fcast__cards">
                {price.map((forecast) => (
                  <PriceForecastCard key={forecast.productId} forecast={forecast} />
                ))}
              </div>
            ))}

          {productTab === 'cost' &&
            (cost.length === 0 ? (
              <EmptyState
                icon={cartOutline}
                title={t('No purchasing cost forecasts yet')}
                description={t('These combine expected sales with expected supplier prices, so they appear once both are available.')}
                compact
              />
            ) : (
              <>
                <div className="bl-fcast__total">
                  <div>
                    <span className="bl-label">{t('Total estimated purchasing cost')}</span>
                    <p className="bl-metric">{peso(totalCost)}</p>
                    <p className="bl-caption">
                      {totalDiff >= 0
                        ? t('Previous orders totalled {{previous}} — an increase of {{amount}} ({{pct}}%)', { previous: peso(totalPrevious), amount: peso(Math.abs(totalDiff)), pct: totalPrevious > 0 ? ((Math.abs(totalDiff) / totalPrevious) * 100).toFixed(1) : '0.0' })
                        : t('Previous orders totalled {{previous}} — a decrease of {{amount}} ({{pct}}%)', { previous: peso(totalPrevious), amount: peso(Math.abs(totalDiff)), pct: totalPrevious > 0 ? ((Math.abs(totalDiff) / totalPrevious) * 100).toFixed(1) : '0.0' })}
                    </p>
                  </div>
                  <Badge tone={totalDiff > 0 ? 'warning' : 'success'}>
                    {totalDiff > 0 ? t('Budget more') : t('Budget less')}
                  </Badge>
                </div>
                <div className="bl-fcast__cards">
                  {cost.map((forecast) => (
                    <CostForecastCard key={forecast.productId} forecast={forecast} />
                  ))}
                </div>
              </>
            ))}
        </Card>

        {/* ---- What if prices move -------------------------------------------- */}
        <Card
          fill
          as="h2"
          className="bl-span-7"
          title={t('Price what-if')}
          description={t('Test a supplier price rise or cut against your profit and monthly purchasing')}
        >
          <PriceWhatIf demand={demand} />
        </Card>

        {/* ---- Trends / accuracy ------------------------------------------------ */}
        <Card
          fill
          as="h2"
          className="bl-span-5"
          title={resultTab === 'trends' ? t('Forecast trends') : t('Forecast accuracy')}
          description={
            resultTab === 'trends'
              ? t('Forecast purchasing cost against what you actually spent')
              : t('How well past forecasts matched reality')
          }
          action={
            <Segmented
              label={t('Forecast results')}
              value={resultTab}
              onChange={setResultTab}
              options={[
                { value: 'trends', label: t('Trends') },
                { value: 'accuracy', label: t('Accuracy') },
              ]}
            />
          }
        >
          {resultTab === 'trends' &&
            (forecastVsActual.length === 0 ? (
              <p className="bl-support">
                {t('This compares what forecasts predicted against what you actually spent. It fills in once forecasts have been generated and the month has closed.')}
              </p>
            ) : (
              <BarChart
                data={forecastVsActual.map((d) => ({ label: d.label, value: d.actual ?? 0 }))}
                comparison={{
                  data: forecastVsActual.map((d) => ({ label: d.label, value: d.forecast ?? 0 })),
                  seriesName: t('Forecast'),
                }}
                seriesName="Actual"
                format={(v) => (v === 0 ? t('Not yet recorded') : peso(v))}
                axisFormat={pesoCompact}
                summary={t('Grouped bar chart comparing actual and forecast monthly purchasing cost.')}
                height={230}
                fill
              />
            ))}

          {resultTab === 'accuracy' && (
            <>
              {accuracy.length === 0 && (
                <p className="bl-support">
                  {t('Accuracy is measured by comparing past forecasts against what actually happened. It will appear once forecasts have been running for a while.')}
                </p>
              )}
              <ul className="bl-accuracy">
                {accuracy.map((item) => {
                  const met = item.value >= item.target;
                  return (
                    <li key={item.metric} className="bl-accuracy__row">
                      <div className="bl-accuracy__head">
                        <span className="bl-accuracy__metric">
                          <IonIcon
                            icon={met ? checkmarkCircleOutline : warningOutline}
                            className={met ? 'bl-accuracy__ok' : 'bl-accuracy__warn'}
                            aria-hidden="true"
                          />
                          {item.metric}
                        </span>
                        <span className="bl-accuracy__value">
                          {item.value}%
                          <span className="bl-accuracy__target">{t('/ {{target}}% target', { target: item.target })}</span>
                        </span>
                      </div>
                      <div
                        className="bl-meter"
                        role="meter"
                        aria-valuenow={item.value}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-label={t('{{metric}}: {{value}} percent against a {{target}} percent target', { metric: item.metric, value: item.value, target: item.target })}
                      >
                        <div
                          className={`bl-meter__fill ${met ? '' : 'bl-meter__fill--warning'}`}
                          style={{ width: `${item.value}%` }}
                        />
                      </div>
                      <p className="bl-caption">{item.description}</p>
                    </li>
                  );
                })}
              </ul>

              <p className="bl-fcast__method">
                {t('Accuracy is measured against the last 90 days of recorded sales and invoices. Forecasts are estimates, not guarantees.')}
              </p>
            </>
          )}
        </Card>
      </Bento>
    </Workspace>
  );
}

export default Forecast;
