import { IonIcon } from '@ionic/react';
import {
  addOutline,
  chevronForwardOutline,
  createOutline,
  cubeOutline,
  swapVerticalOutline,
  trashOutline,
} from 'ionicons/icons';
import { useState } from 'react';
import { Link, useHistory, useParams } from 'react-router-dom';
import ForecastChart from '../components/charts/ForecastChart';
import TrendChart from '../components/charts/TrendChart';
import Button from '../components/common/Button';
import { NumberField, TextAreaField } from '../components/common/Field';
import { Modal } from '../components/common/Modal';
import { ErrorState, LoadingState, SkeletonCard, SkeletonGrid } from '../components/common/States';
import { Badge, CostDelta, StatusBadge } from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import AIInsightCard from '../components/dashboard/AIInsightCard';
import { CostForecastCard, ForecastStat } from '../components/dashboard/ForecastCard';
import PageHeader from '../components/layout/PageHeader';
import PinnedSummary from '../components/layout/PinnedSummary';
import { Card, Section } from '../components/layout/Section';
import { Bento, Workspace } from '../components/layout/Workspace';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { alertError, alertSuccess, confirmAction } from '../lib/swal';
import { useAsyncData } from '../hooks/useAsyncData';
import { dataService, usesLiveData } from '../services/dataService';
import { productService } from '../services/api';
import { number, peso, shortDate } from '../utils/format';
import './ProductDetails.css';
import { t } from '../i18n';

export function ProductDetails() {
  const { id } = useParams<{ id: string }>();
  const history = useHistory();
  const { showToast } = useToast();
  const { activeBusiness, isManager } = useAuth();

  const { data, loading, error, reload } = useAsyncData(
    () =>
      Promise.all([
        dataService.getProduct(id),
        dataService.getStockMovement(id),
        dataService.getUnitSales(id),
        dataService.getSuppliers(),
        dataService.getForecasts(),
        dataService.getInsights(),
      ]),
    [id, activeBusiness?.id],
  );

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustNotes, setAdjustNotes] = useState('');
  const [adjustSaving, setAdjustSaving] = useState(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  if (loading) {
    return (
      <LoadingState label={t('Loading product details')}>
        <SkeletonCard lines={2} />
        <div style={{ height: 24 }} />
        <SkeletonGrid count={3} lines={3} />
      </LoadingState>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title={t('Unable to load this product')}
        description={t('The product could not be found, or your data could not be reached.')}
        onRetry={reload}
      />
    );
  }

  const [product, movement, unitSales, suppliers, forecasts, allInsights] = data;

  // Everything below is derived from this business's own recorded history —
  // the forecasts are computed on-device, not fetched from anywhere.
  const supplier = suppliers.find((s) => s.id === product.supplierId);
  const demand = forecasts.demand.find((d) => d.productId === product.id);
  const price = forecasts.price.find((p) => p.productId === product.id);
  const cost = forecasts.cost.find((c) => c.productId === product.id);
  const insights = allInsights.filter((i) => i.productId === product.id);

  const margin = product.sellingPrice - product.costPrice;
  const marginPct = (margin / product.sellingPrice) * 100;
  const daysOfCover = product.currentStock / (product.averageDailyDemand || 1);

  const handleDelete = async () => {
    if (!isManager) {
      await alertError(t('Only an owner or admin can delete products'));
      return;
    }

    if (!usesLiveData() || !activeBusiness) {
      showToast(t('Deleting needs an active business. Please sign in again.'), 'info');
      return;
    }

    const confirmed = await confirmAction({
      title: t('Delete {{name}}?', { name: product.name }),
      text: t('This action cannot be undone. Sales and purchase history for this product will be kept.'),
      confirmLabel: t('Delete'),
    });
    if (!confirmed) return;

    try {
      await productService.remove(activeBusiness.id, product.id);
      showToast(t('{{name}} was removed.', { name: product.name }));
      history.push('/inventory');
    } catch (err) {
      await alertError(t('Could not delete this product'), toUserMessage(err));
    }
  };

  const openAdjustStock = () => {
    setAdjustQuantity('');
    setAdjustNotes('');
    setAdjustError(null);
    setAdjustOpen(true);
  };

  const handleAdjustStock = async () => {
    setAdjustError(null);

    const quantity = Number(adjustQuantity);
    if (!adjustQuantity || Number.isNaN(quantity) || quantity === 0) {
      setAdjustError(t('Enter a quantity — positive to add stock, negative to remove it.'));
      return;
    }

    if (!usesLiveData() || !activeBusiness) {
      setAdjustError(t('Adjusting stock needs an active business. Please sign in again.'));
      return;
    }

    setAdjustSaving(true);
    try {
      await productService.adjustStock(activeBusiness.id, product.id, quantity, adjustNotes.trim() || undefined);
      setAdjustOpen(false);
      reload();
      await alertSuccess(t('Stock adjusted'),
        quantity > 0
          ? t('Added {{qty}} {{unit}}.', { qty: number(Math.abs(quantity)), unit: product.unit })
          : t('Removed {{qty}} {{unit}}.', { qty: number(Math.abs(quantity)), unit: product.unit }),
      );
    } catch (err) {
      setAdjustError(toUserMessage(err));
    } finally {
      setAdjustSaving(false);
    }
  };

  return (
    <Workspace className="bl-pd">
      <nav className="bl-crumbs" aria-label={t('Breadcrumb')}>
        <ol>
          <li>
            <Link to="/inventory">{t('Inventory')}</Link>
          </li>
          <li aria-hidden="true">
            <IonIcon icon={chevronForwardOutline} />
          </li>
          <li aria-current="page">{product.name}</li>
        </ol>
      </nav>

      <PageHeader
        title={product.name}
        description={`${product.sku} · ${product.category}`}
        eyebrow={
          <div className="bl-row">
            <StatusBadge status={product.status} />
            {supplier && <Badge tone="neutral">{supplier.name}</Badge>}
          </div>
        }
        actions={
          <>
            <Button
              variant="secondary"
              icon={trashOutline}
              onClick={() => void handleDelete()}
              aria-label={t('Delete {{name}}', { name: product.name })}
              disabled={!isManager}
            />
            <Button
              variant="secondary"
              icon={createOutline}
              onClick={() => history.push('/inventory', { editProductId: product.id })}
            >
              {t('Edit')}
            </Button>
            <Button variant="secondary" icon={swapVerticalOutline} onClick={openAdjustStock}>
              {t('Adjust Stock')}
            </Button>
            <Button
              variant="primary"
              icon={addOutline}
              onClick={() =>
                history.push('/purchases', { openAdd: true, presetProductId: product.id })
              }
            >
              {t('Record Purchase')}
            </Button>
          </>
        }
      />

      {/* ---- At a glance ---------------------------------------------------- */}
      <PinnedSummary>
        <Section title={t('At a glance')}>
          <div className="bl-grid bl-grid--kpi">
            <Card className="bl-pd__stat">
              <ForecastStat
                label={t('Current stock')}
                value={`${number(product.currentStock)} ${product.unit}`}
                sub={t('Low-stock level {{v1}} {{unit}}', { v1: number(product.minimumStock), unit: product.unit })}
              />
            </Card>
            <Card className="bl-pd__stat">
              <ForecastStat
                label={t('Days of stock left')}
                value={product.currentStock === 0 ? t('0 days') : t('{{days}} days', { days: number(daysOfCover) })}
                sub={t('{{v1}} {{unit}} sold per day', { v1: number(product.averageDailyDemand), unit: product.unit })}
              />
            </Card>
            <Card className="bl-pd__stat">
              <ForecastStat
                label={t('Selling price')}
                value={peso(product.sellingPrice)}
                sub={t('Bought at {{v1}}', { v1: peso(product.costPrice) })}
              />
            </Card>
            <Card className="bl-pd__stat">
              <ForecastStat
                label={t('Profit')}
                value={peso(margin)}
                sub={t('{{v1}}% of the selling price', { v1: marginPct.toFixed(0) })}
              />
            </Card>
          </div>
        </Section>
      </PinnedSummary>

      <Bento rows="minmax(0, 1fr) minmax(0, 1fr)">
        {/* ---- Sales and movement ------------------------------------------- */}
        <Card fill as="h2" className="bl-span-4" title={t('Sales trend')} description={t('Units sold over the last 7 days')}>
          <TrendChart
            data={unitSales}
            format={(v) => `${number(v)} ${product.unit}`}
            axisFormat={(v) => number(v, 0)}
            seriesName="Units sold"
            summary={t('Line chart of {{name}} units sold over the last seven days, averaging about {{v2}} {{unit}} per day.', { name: product.name, v2: number(product.averageDailyDemand), unit: product.unit })}
            height={200}
            fill
          />
        </Card>

        <Card fill as="h2" className="bl-span-4" title={t('Inventory movement')} description={t('Stock on hand over the last 14 days')}>
          <TrendChart
            data={movement.map((m) => ({ label: m.date, value: m.stock }))}
            format={(v) => `${number(v)} ${product.unit}`}
            axisFormat={(v) => number(v, 0)}
            seriesName="Stock on hand"
            summary={t('Line chart of {{name}} stock on hand over 14 days, currently {{v2}} {{unit}}.', { name: product.name, v2: number(product.currentStock), unit: product.unit })}
            height={200}
            variant="line"
            fill
          />
        </Card>

        {/* ---- Expected sales ------------------------------------------------- */}
        <Card
          fill
          as="h2"
          className="bl-span-4"
          title={t('Expected sales')}
          description={
            demand
              ? t('Expected sales over the next {{horizonDays}} days', { horizonDays: demand.horizonDays })
              : undefined
          }
        >
          {!demand ? (
            <p className="bl-support">{t('Once you have recorded enough sales, forecasts for each product will appear here.')}</p>
          ) : (
            <>
              <div className="bl-pd__forecast-head">
                <div>
                  <p className="bl-metric">
                    {number(demand.forecastQuantity)}
                    <span className="bl-fc__unit"> {demand.unit}</span>
                  </p>
                  <p className="bl-caption">
                    {t('Expected range {{low}}–{{high}} {{unit}} · {{confidence}}% sure', {
                      low: number(demand.rangeLow),
                      high: number(demand.rangeHigh),
                      unit: demand.unit,
                      confidence: demand.confidence,
                    })}
                  </p>
                </div>
                {demand.forecastQuantity > demand.currentStock ? (
                  <Badge tone="warning">
                    {t('Short by {{v1}} {{unit}}', { v1: number(demand.forecastQuantity - demand.currentStock), unit: demand.unit })}
                  </Badge>
                ) : (
                  <Badge tone="success">{t('Stock is sufficient')}</Badge>
                )}
              </div>

              <ForecastChart
                data={demand.series}
                format={(v) => `${number(v)} ${demand.unit}`}
                axisFormat={(v) => number(v, 0)}
                measure="Units"
                summary={t('Chart of {{name}} daily demand: seven days recorded, then a seven-day forecast totalling {{v2}} {{unit}} with a range of {{v4}} to {{v5}}.', { name: product.name, v2: number(demand.forecastQuantity), unit: demand.unit, v4: number(demand.rangeLow), v5: number(demand.rangeHigh) })}
                height={230}
                fill
              />
            </>
          )}
        </Card>

        {/* ---- Price and purchasing cost ------------------------------------- */}
        <Card
          fill
          as="h2"
          className="bl-span-4"
          title={t('Price forecast')}
          description={
            price
              ? t('Supplier unit price from {{supplierName}}', { supplierName: price.supplierName })
              : t('What your next order is likely to cost')
          }
        >
          {!price && !cost && (
            <p className="bl-support">
              {t('Supplier price forecasts appear once there are enough recorded purchases to spot a trend.')}
            </p>
          )}
          {price && (
            <>
              <div className="bl-pd__pricegrid">
                <ForecastStat label={t('Current price')} value={peso(price.currentPrice)} />
                <ForecastStat
                  label={t('Estimated')}
                  value={`${peso(price.estimatedLow)}–${peso(price.estimatedHigh)}`}
                  sub={t('Average {{amount}}', { amount: peso(price.estimatedAverage) })}
                />
                <div className="bl-fc__stat">
                  <span className="bl-label">{t('Trend')}</span>
                  <span className="bl-pd__trend">
                    <CostDelta pct={price.changePct} label={t('in supplier price')} />
                  </span>
                  <span className="bl-caption">
                    {price.trend === 'up'
                      ? t('Increasing')
                      : price.trend === 'down'
                        ? t('Decreasing') : t('Stable')}
                  </span>
                </div>
              </div>

              <ForecastChart
                data={price.series}
                format={(v) => peso(v, v % 1 !== 0)}
                axisFormat={(v) => peso(v)}
                measure="Unit price"
                summary={t('Chart of {{name}} supplier unit price: three months recorded at around {{v2}}, forecast to reach {{v3}} to {{v4}}.', { name: product.name, v2: peso(price.currentPrice), v3: peso(price.estimatedLow), v4: peso(price.estimatedHigh) })}
                height={200}
              />
            </>
          )}
          {cost && (
            <div className="bl-pd__cost">
              <h3 className="bl-dash__forecast-label">{t('Purchasing cost forecast')}</h3>
              <CostForecastCard forecast={cost} />
            </div>
          )}
        </Card>

        {/* ---- Supplier ------------------------------------------------------- */}
        <Card
          fill
          as="h2"
          className="bl-span-4"
          title={t('Supplier')}
          action={
            <Link to="/suppliers" className="bl-viewall">
              {t('View suppliers')}
              <IonIcon icon={chevronForwardOutline} aria-hidden="true" />
            </Link>
          }
        >
          {!supplier ? (
            <p className="bl-support">{t('No supplier linked to this product yet.')}</p>
          ) : (
            <div className="bl-pd__supplier">
              <div className="bl-pd__supplier-main">
                <h3 className="bl-card-title">{supplier.name}</h3>
                <p className="bl-caption">
                  {supplier.contactPerson} · {supplier.phone}
                </p>
                <p className="bl-caption">{supplier.address}</p>
              </div>
              <dl className="bl-pd__supplier-facts">
                <div>
                  <dt>{t('Average price')}</dt>
                  <dd>{peso(supplier.averageUnitPrice)}</dd>
                </div>
                <div>
                  <dt>{t('Reliability')}</dt>
                  <dd>{supplier.reliabilityScore}%</dd>
                </div>
                <div>
                  <dt>{t('Last ordered')}</dt>
                  <dd>{shortDate(supplier.lastOrderedAt)}</dd>
                </div>
              </dl>
            </div>
          )}
        </Card>

        {/* ---- AI recommendation ---------------------------------------------- */}
        <Card
          fill
          as="h2"
          className="bl-span-4"
          title={t('AI recommendation')}
          description={t('Generated from this product\'s recorded data')}
        >
          {insights.length === 0 ? (
            <div className="bl-pd__noinsight">
              <IonIcon icon={cubeOutline} aria-hidden="true" />
              <p className="bl-support">
                {t('No recommendation for this product yet. Insights appear once there is enough sales and purchase history.')}
              </p>
            </div>
          ) : (
            <div className="bl-stack">
              {insights.map((insight) => (
                <AIInsightCard key={insight.id} insight={insight} />
              ))}
            </div>
          )}
        </Card>
      </Bento>

      <Modal
        isOpen={adjustOpen}
        onClose={() => setAdjustOpen(false)}
        title={t('Adjust Stock')}
        icon="stock"
        description={t('Correct {{name}}\'s stock on hand. Recorded as an adjustment in its stock history.', { name: product.name })}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setAdjustOpen(false)} disabled={adjustSaving}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleAdjustStock()} loading={adjustSaving}>
              {adjustSaving ? t('Saving') : t('Adjust Stock')}
            </Button>
          </>
        }
      >
        <form
          className="bl-form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void handleAdjustStock();
          }}
        >
          {adjustError && (
            <p className="bl-form-error bl-form-grid__full" role="alert">
              {adjustError}
            </p>
          )}

          <NumberField
            label={t('Quantity')}
            hint={t('Positive to add stock, negative to remove it. Currently {{v1}} {{unit}}.', { v1: number(product.currentStock), unit: product.unit })}
            placeholder={t('e.g. -3 or 10')}
            required
            min={undefined}
            className="bl-form-grid__full"
            value={adjustQuantity}
            onChange={(e) => setAdjustQuantity(e.target.value)}
          />
          <TextAreaField
            label={t('Notes')}
            hint={t('Optional — why the count changed (e.g. spoilage not logged, recount).')}
            className="bl-form-grid__full"
            value={adjustNotes}
            onChange={(e) => setAdjustNotes(e.target.value)}
          />
        </form>
      </Modal>
    </Workspace>
  );
}

export default ProductDetails;
