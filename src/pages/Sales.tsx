import {
  addOutline,
  cartOutline,
  removeOutline,
  searchOutline,
  trashOutline,
} from 'ionicons/icons';
import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import TrendChart from '../components/charts/TrendChart';
import Button from '../components/common/Button';
import { CurrencyField, DateField, SearchInput, SelectField, TextField } from '../components/common/Field';
import { Modal } from '../components/common/Modal';
import { GCashLogo, PaymentBadges, PesoCashLogo } from '../components/common/PaymentLogos';
import ProductThumbnail from '../components/common/ProductThumbnail';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '../components/common/States';
import Toolbar, {
  ChipFilter,
  ResultCount,
  Segmented,
  ToolbarFilters,
  ToolbarSearch,
} from '../components/common/Toolbar';
import StatCard from '../components/dashboard/StatCard';
import PageHeader from '../components/layout/PageHeader';
import PinnedSummary from '../components/layout/PinnedSummary';
import { Card, Section } from '../components/layout/Section';
import { Bento, MiniStats, Rail, Workspace } from '../components/layout/Workspace';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { alertSuccess } from '../lib/swal';
import { useAsyncData } from '../hooks/useAsyncData';
import { dataService, usesLiveData } from '../services/dataService';
import { salesService } from '../services/api';
import type { Product, Sale } from '../types';
import { number, peso, pesoCompact, shortDate } from '../utils/format';
import './Transactions.css';
import { t } from '../i18n';
import { label } from '../i18n/labels';

type Range = 'week' | 'month';

interface CartLine {
  productId: string;
  name: string;
  unit: string;
  stock: number;
  unitPrice: number;
  quantity: number;
  imageUrl: string | null;
}

type CashChange =
  | { state: 'blank' }
  | { state: 'change' | 'short'; centavos: number };

/**
 * Change owed (or amount still short) for a cash payment. Works in whole
 * centavos so 100 - 79.90 is exactly 20.10, not 20.099999999999994.
 */
function cashChange(received: string, total: number): CashChange {
  if (received.trim() === '') return { state: 'blank' };
  const diff = Math.round(Number(received) * 100) - Math.round(total * 100);
  if (Number.isNaN(diff)) return { state: 'blank' };
  return diff >= 0 ? { state: 'change', centavos: diff } : { state: 'short', centavos: -diff };
}

const CASH_QUICK_AMOUNTS = [50, 100, 200, 500, 1000];

/** How the customer pays: all cash, all GCash, or part of each. */
type PaymentMode = 'Cash' | 'GCash' | 'Split';

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function Sales() {
  const { activeBusiness, user } = useAuth();
  const location = useLocation<{ openAdd?: boolean } | undefined>();

  const { data, loading, error, reload } = useAsyncData(
    () => Promise.all([dataService.getSales(), dataService.getSalesOverview()]),
    [activeBusiness?.id],
  );

  const {
    data: products,
    reload: reloadProducts,
  } = useAsyncData(() => dataService.getProducts(), [activeBusiness?.id]);

  const [query, setQuery] = useState('');
  const [payment, setPayment] = useState('all');
  const [range, setRange] = useState<Range>('week');
  const [addOpen, setAddOpen] = useState(false);
  const [viewSale, setViewSale] = useState<Sale | null>(null);

  /** Arriving from a Dashboard quick action — open the Add form immediately. */
  useEffect(() => {
    if (location.state?.openAdd) setAddOpen(true);
  }, [location.state]);

  const [cart, setCart] = useState<CartLine[]>([]);
  const [saleDate, setSaleDate] = useState(todayIso());
  const [paymentMode, setPaymentMode] = useState<PaymentMode>('Cash');
  const [paymentReference, setPaymentReference] = useState('');
  const [gcashAmount, setGcashAmount] = useState('');
  const [cashReceived, setCashReceived] = useState('');
  const [tileQuery, setTileQuery] = useState('');
  const [tileCategory, setTileCategory] = useState('all');
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const resetCart = () => {
    setCart([]);
    setTileQuery('');
    setTileCategory('all');
    setSaleDate(todayIso());
    setPaymentMode('Cash');
    setPaymentReference('');
    setGcashAmount('');
    setCashReceived('');
    setFormError(null);
  };

  const choosePaymentMode = (mode: PaymentMode) => {
    setPaymentMode(mode);
    // Only a GCash payment has a reference; don't carry a stale one over.
    if (mode === 'Cash') {
      setPaymentReference('');
      setGcashAmount('');
    }
    if (mode === 'GCash') {
      setCashReceived('');
      setGcashAmount('');
    }
  };

  const closeAddModal = () => {
    setAddOpen(false);
    resetCart();
  };

  /** Taps a tile: adds the product or increments its existing line. Stock
   *  is soft-capped here for UX — the backend still rejects an actual
   *  oversell, this just stops staff from tapping past it in the first place. */
  const addToCart = (product: Product) => {
    // Small tactile tick on phones; a no-op where unsupported.
    if (typeof navigator !== 'undefined') navigator.vibrate?.(8);
    setCart((lines) => {
      const existing = lines.find((l) => l.productId === product.id);
      if (existing) {
        if (existing.quantity >= product.currentStock) return lines;
        return lines.map((l) =>
          l.productId === product.id ? { ...l, quantity: l.quantity + 1 } : l,
        );
      }
      if (product.currentStock <= 0) return lines;
      return [
        ...lines,
        {
          productId: product.id,
          name: product.name,
          unit: product.unit,
          stock: product.currentStock,
          unitPrice: product.sellingPrice,
          quantity: 1,
          imageUrl: product.imageUrl,
        },
      ];
    });
  };

  const incrementLine = (productId: string) => {
    setCart((lines) =>
      lines.map((l) =>
        l.productId === productId && l.quantity < l.stock ? { ...l, quantity: l.quantity + 1 } : l,
      ),
    );
  };

  const decrementLine = (productId: string) => {
    setCart((lines) =>
      lines.map((l) =>
        l.productId === productId ? { ...l, quantity: Math.max(1, l.quantity - 1) } : l,
      ),
    );
  };

  const setLinePrice = (productId: string, value: string) => {
    setCart((lines) =>
      lines.map((l) => (l.productId === productId ? { ...l, unitPrice: Number(value) || 0 } : l)),
    );
  };

  const removeLine = (productId: string) => {
    setCart((lines) => lines.filter((l) => l.productId !== productId));
  };

  const cartTotal = cart.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
  // Split payment: the GCash part is typed, the cash part is whatever is left.
  const gcashPart = paymentMode === 'Split' ? Math.round(Number(gcashAmount || 0) * 100) / 100 : 0;
  const cashPart = paymentMode === 'Split' ? Math.round((cartTotal - gcashPart) * 100) / 100 : cartTotal;
  const splitValid = gcashPart > 0 && cashPart > 0;
  const cash = cashChange(cashReceived, cashPart);

  const cartQtyFor = (productId: string) => cart.find((l) => l.productId === productId)?.quantity ?? 0;

  const tileCategories = useMemo(
    () => Array.from(new Set((products ?? []).filter((p) => p.isActive).map((p) => p.category))),
    [products],
  );

  const tiles = useMemo(() => {
    const q = tileQuery.trim().toLowerCase();
    return (products ?? []).filter((p) => {
      if (!p.isActive) return false;
      const matchesQuery = !q || p.name.toLowerCase().includes(q);
      const matchesCategory = tileCategory === 'all' || p.category === tileCategory;
      return matchesQuery && matchesCategory;
    });
  }, [products, tileQuery, tileCategory]);

  const handleCheckout = async () => {
    setFormError(null);

    if (cart.length === 0) {
      setFormError(t('Tap a product to add it to the cart.'));
      return;
    }

    if (paymentMode === 'Split' && !splitValid) {
      setFormError(t('Enter how much was paid by GCash. It must be more than zero and less than the total.'));
      return;
    }

    if (paymentMode !== 'Cash' && !/^\d{4}$/.test(paymentReference)) {
      setFormError(t('Enter the last 4 digits of the GCash reference number.'));
      return;
    }

    if (!usesLiveData() || !activeBusiness) {
      setFormError(t('Recording a sale needs an active business. Please sign in again.'));
      return;
    }

    setSaving(true);
    try {
      // The inventory ledger refuses the write if any line would oversell.
      await salesService.create(activeBusiness.id, user?.id ?? null, {
        items: cart.map((l) => ({
          productId: l.productId,
          quantity: l.quantity,
          unitPrice: l.unitPrice,
        })),
        ...(paymentMode === 'Split'
          ? {
              payments: [
                { method: 'GCash' as const, amount: gcashPart, reference: paymentReference },
                { method: 'Cash' as const, amount: cashPart },
              ],
            }
          : {
              paymentMethod: paymentMode,
              paymentReference: paymentMode === 'GCash' ? paymentReference : undefined,
            }),
        saleDate,
      });
      const changeNote =
        paymentMode !== 'GCash' && cash.state === 'change' && cash.centavos > 0
          ? ` ${t('Change to give: {{amount}}.', { amount: peso(cash.centavos / 100) })}`
          : '';
      closeAddModal();
      reload();
      await alertSuccess(t('Sale recorded'), t('Stock has been updated to match.{{changeNote}}', { changeNote }));
    } catch (err) {
      // Keep the cart intact — staff shouldn't have to re-build it — but
      // refresh stock numbers in case the failure was an oversell caused by
      // another device selling the same product in the meantime.
      setFormError(toUserMessage(err));
      reloadProducts();
    } finally {
      setSaving(false);
    }
  };

  const sales = data?.[0] ?? [];
  const overview = data?.[1];


  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sales.filter((sale) => {
      const matchesQuery =
        !q ||
        sale.reference.toLowerCase().includes(q) ||
        sale.payments.some((p) => (p.reference ?? '').includes(q)) ||
        sale.cashier.toLowerCase().includes(q) ||
        sale.items.some((i) => i.productName.toLowerCase().includes(q));
      const matchesPayment = payment === 'all' || sale.payments.some((p) => p.method === payment);
      return matchesQuery && matchesPayment;
    });
  }, [sales, query, payment]);

  const header = (
    <PageHeader
      title={t('Sales')}
      description={t('Every recorded sale, with today\'s totals and how the week is tracking.')}
      actions={
        <Button variant="primary" icon={addOutline} onClick={() => setAddOpen(true)}>
          {t('Add Sale')}
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label={t('Loading sales')}>
          <SkeletonRows rows={6} />
        </LoadingState>
      </>
    );
  }

  if (error || !data || !overview) {
    return (
      <>
        {header}
        <ErrorState
          title={t('Unable to load sales')}
          description={t('We could not load your sales records. Please try again.')}
          onRetry={reload}
        />
      </>
    );
  }

  const { summary, last7Days, last6Months } = overview;
  const chartData = range === 'week' ? last7Days : last6Months;

  return (
    <Workspace>
      {header}

      <PinnedSummary>
        <Section title={t('Sales summary')}>
          <div className="bl-grid bl-grid--kpi">
            <StatCard
              label={t('Today')}
              value={peso(summary.today)}
              changePct={summary.todayChangePct}
              changeLabel={t('vs yesterday')}
              emphasis="hero"
              icon={cartOutline}
              spark={last7Days.map((d) => d.value)}
            />
            <StatCard
              label={t('Cash today')}
              logo={<PesoCashLogo />}
              accent="cash"
              value={peso(summary.todayCash)}
              emphasis="plain"
              footnote={t('{{transactionsToday}} transactions today', { transactionsToday: summary.transactionsToday })}
            />
            <StatCard
              label={t('GCash today')}
              logo={<GCashLogo />}
              accent="gcash"
              value={peso(summary.todayGCash)}
              emphasis="plain"
              footnote={t('{{transactionsToday}} transactions today', { transactionsToday: summary.transactionsToday })}
            />
            <StatCard
              label={t('This week')}
              value={peso(summary.week)}
              changePct={summary.weekChangePct}
              changeLabel={t('vs last week')}
            />
            <StatCard
              label={t('This month')}
              value={peso(summary.month)}
              changePct={summary.monthChangePct}
              changeLabel={t('vs last month')}
            />
          </div>
        </Section>
      </PinnedSummary>

      <Bento>
        <Card
          fill
          padding="none"
          as="h2"
          className="bl-span-8"
          title={t('Transactions')}
          description={t('Most recent first')}
          action={
        <Toolbar>
          <ToolbarSearch>
            <SearchInput
              label={t('Search sales by reference, GCash number, product or cashier')}
              placeholder={t('Search sales')}
              value={query}
              onValueChange={setQuery}
            />
          </ToolbarSearch>
          <ToolbarFilters>
            <SelectField
              label={t('Filter by payment method')}
              hideLabel
              value={payment}
              onChange={(e) => setPayment(e.target.value)}
              options={[
                { value: 'all', label: t('All payments') },
                { value: 'Cash', label: label('Cash') },
                { value: 'GCash', label: label('GCash') },
              ]}
            />
          </ToolbarFilters>
        </Toolbar>
          }
        >
        <ResultCount shown={filtered.length} total={sales.length} noun="sales" />

        {filtered.length === 0 ? (
          <EmptyState
            icon={sales.length === 0 ? cartOutline : searchOutline}
            title={sales.length === 0 ? t('No sales recorded yet') : t('No sales match your search')}
            description={
              sales.length === 0
                ? t('Use the button above to record your first sale and start tracking daily revenue.') : t('Try a different reference, product or payment method.')
            }
            actionLabel={sales.length === 0 ? undefined : t('Clear filters')}
            onAction={
              sales.length === 0
                ? undefined
                : () => {
                    setQuery('');
                    setPayment('all');
                  }
            }
            compact={sales.length > 0}
          />
        ) : (
          <>
            <div className="bl-responsive-table">
              <Card padding="none">
                <div className="bl-table-wrap bl-scroll">
                  <table className="bl-table">
                    <caption className="bl-sr-only">{t('Recorded sales transactions')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('Reference')}</th>
                        <th scope="col">{t('Date')}</th>
                        <th scope="col">{t('Items')}</th>
                        <th scope="col" className="bl-tx__col-cashier">
                          {t('Cashier')}
                        </th>
                        <th scope="col">{t('Payment')}</th>
                        <th scope="col" className="bl-td-num">
                          {t('Total')}
                        </th>
                        <th scope="col" className="bl-td-num bl-tx__col-action">
                          <span className="bl-sr-only">{t('Action')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((sale) => (
                        <tr key={sale.id}>
                          <td className="bl-table__primary">{sale.reference}</td>
                          <td>
                            {shortDate(sale.date)}
                            <div className="bl-table__sub">{sale.time}</div>
                          </td>
                          <td>
                            {sale.items[0]?.productName ?? t('Sale')}
                            {sale.items.length > 1 && (
                              <div className="bl-table__sub">
                                +{sale.items.length - 1} more item
                                {sale.items.length > 2 ? 's' : ''}
                              </div>
                            )}
                          </td>
                          <td className="bl-tx__col-cashier">{sale.cashier}</td>
                          <td>
                            <PaymentBadges payments={sale.payments} />
                          </td>
                          <td className="bl-td-num bl-table__primary">{peso(sale.total)}</td>
                          <td className="bl-td-num bl-tx__col-action">
                            <Button
                              variant="secondary"
                              size="sm"
                              aria-label={t('View sale {{reference}}', { reference: sale.reference })}
                              onClick={() => setViewSale(sale)}
                            >
                              {t('View')}
                            </Button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <ul className="bl-responsive-cards">
              {filtered.map((sale) => (
                <li key={sale.id}>
                  <article className="bl-drow">
                    <div className="bl-drow__top">
                      <div>
                        <span className="bl-drow__title">{sale.items[0]?.productName ?? t('Sale')}</span>
                        <span className="bl-drow__meta">
                          {sale.reference} · {shortDate(sale.date)} {sale.time}
                        </span>
                      </div>
                      <span className="bl-tx__amount">{peso(sale.total)}</span>
                    </div>

                    {sale.items.length > 1 && (
                      <ul className="bl-tx__items">
                        {sale.items.map((item) => (
                          <li key={item.productId}>
                            <span className="bl-truncate">{item.productName}</span>
                            <span className="bl-num">
                              {item.quantity} × {peso(item.unitPrice)}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}

                    <dl className="bl-drow__grid">
                      <div className="bl-drow__cell">
                        <dt>{t('Payment')}</dt>
                        <dd>
                          <PaymentBadges payments={sale.payments} />
                        </dd>
                      </div>
                      <div className="bl-drow__cell">
                        <dt>{t('Cashier')}</dt>
                        <dd className="bl-tx__soft">{sale.cashier}</dd>
                      </div>
                    </dl>
                    <Button
                      variant="secondary"
                      size="sm"
                      aria-label={t('View sale {{reference}}', { reference: sale.reference })}
                      onClick={() => setViewSale(sale)}
                    >
                      {t('View')}
                    </Button>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
        </Card>

        <Rail className="bl-span-4 bl-first-small">
          <Card
            className="bl-rail__fixed"
            title={t('Capital and profit')}
            description={t('Capital is what you paid for the goods you sold. Profit is what is left after the capital.')}
          >
            <MiniStats
              items={[
                { label: t('Capital this month'), value: peso(summary.capitalMonth), foot: t('Cost of goods sold') },
                {
                  label: t('Profit this month'),
                  value: peso(summary.profitMonth),
                  foot: t('Sales minus capital'),
                  tone: summary.profitMonth > 0 ? 'brand' : undefined,
                },
                { label: t('Capital today'), value: peso(summary.capitalToday) },
                {
                  label: t('Profit today'),
                  value: peso(summary.profitToday),
                  foot: t('Profit this week: {{amount}}', { amount: peso(summary.profitWeek) }),
                },
              ]}
            />
          </Card>

          <Card
            fill
            title={t('Sales trend')}
            action={
              <Segmented
                label={t('Sales trend range')}
                value={range}
                onChange={setRange}
                options={[
                  { value: 'week', label: t('Last 7 days') },
                  { value: 'month', label: t('Last 6 months') },
                ]}
              />
            }
          >
            <TrendChart
              data={chartData}
              format={(v) => peso(v)}
              axisFormat={pesoCompact}
              seriesName="Total sales"
              summary={
                range === 'week'
                  ? t('Line chart of total sales over the last seven days, ranging from ₱3,410 on Monday to ₱5,240 on Saturday.') : t('Line chart of total monthly sales from April to September 2026, ranging from ₱96,400 to ₱110,320.')
              }
              height={180}
              fill
            />
          </Card>
        </Rail>
      </Bento>

      <Modal
        isOpen={viewSale !== null}
        onClose={() => setViewSale(null)}
        title={t('Sale details')}
        icon="sale"
        description={viewSale ? `${viewSale.reference} · ${shortDate(viewSale.date)} ${viewSale.time}` : ''}
        size="md"
        footer={
          <Button variant="secondary" onClick={() => setViewSale(null)}>
            {t('Close')}
          </Button>
        }
      >
        {viewSale && (
          <div className="bl-saleview">
            <div className="bl-saleview__summary">
              <div>
                <span className="bl-label">{t('Sales')}</span>
                <strong>{peso(viewSale.total)}</strong>
              </div>
              <div>
                <span className="bl-label">{t('Capital')}</span>
                <strong>{peso(viewSale.capital)}</strong>
              </div>
              <div className={viewSale.profit < 0 ? 'bl-saleview__loss' : 'bl-saleview__gain'}>
                <span className="bl-label">{t('Profit')}</span>
                <strong>{peso(viewSale.profit)}</strong>
                <span className="bl-caption">
                  {t('Margin {{pct}}%', {
                    pct: viewSale.total > 0 ? Math.round((viewSale.profit / viewSale.total) * 1000) / 10 : 0,
                  })}
                </span>
              </div>
            </div>

            <section className="bl-modal__section">
              <h3 className="bl-modal__section-title">
                {viewSale.payments.length > 1 ? t('Paid with cash and GCash') : t('Paid with')}
              </h3>
              <PaymentBadges payments={viewSale.payments} variant="row" showAmounts />
              <p className="bl-caption">
                {t('Cashier')}: {viewSale.cashier}
              </p>
            </section>

            <ul className="bl-saleview__items" aria-label={t('Capital and profit per product')}>
              {viewSale.items.map((item) => {
                const lineProfit = item.quantity * (item.unitPrice - item.unitCost);
                return (
                  <li key={item.productId} className="bl-saleview__item">
                    <span className="bl-saleview__name">{item.productName}</span>
                    <dl className="bl-saleview__figures">
                      <div>
                        <dt>{t('Qty')} × {t('Price')}</dt>
                        <dd>
                          {number(item.quantity)} × {peso(item.unitPrice)}
                        </dd>
                      </div>
                      <div>
                        <dt>{t('Capital')}</dt>
                        <dd>
                          {peso(item.quantity * item.unitCost)}
                          <span className="bl-caption">{t('{{cost}} each', { cost: peso(item.unitCost) })}</span>
                        </dd>
                      </div>
                      <div className={lineProfit < 0 ? 'bl-saleview__loss' : 'bl-saleview__gain'}>
                        <dt>{t('Profit')}</dt>
                        <dd>{peso(lineProfit)}</dd>
                      </div>
                    </dl>
                  </li>
                );
              })}
            </ul>

          </div>
        )}
      </Modal>

      <Modal
        isOpen={addOpen}
        onClose={closeAddModal}
        title={t('Add Sale')}
        icon="cart"
        description={t('Tap products to add them to the cart, then check out as one sale.')}
        size="xl"
        footer={
          <>
            <div className="bl-cart__total">
              <span className="bl-label">{t('Total')}</span>
              <strong>{peso(cartTotal)}</strong>
            </div>
            <Button variant="secondary" onClick={closeAddModal} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void handleCheckout()}
              loading={saving}
              disabled={cart.length === 0}
            >
              {saving ? t('Recording') : t('Checkout')}
            </Button>
          </>
        }
      >
        {formError && (
          <p className="bl-form-error" role="alert">
            {formError}
          </p>
        )}

        <div className="bl-pos__layout">
          <div className="bl-pos__main">
            <div className="bl-pos__picker">
              <SearchInput
                label={t('Search products')}
                placeholder={t('Search products')}
                value={tileQuery}
                onValueChange={setTileQuery}
              />
              {tileCategories.length > 1 && (
                <ChipFilter
                  label={t('Filter by category')}
                  value={tileCategory}
                  onChange={setTileCategory}
                  options={[
                    { value: 'all', label: t('All') },
                    ...tileCategories.map((c) => ({ value: c, label: c })),
                  ]}
                />
              )}

              {tiles.length === 0 ? (
                <EmptyState
                  icon={searchOutline}
                  title={t('No products match your search')}
                  description={t('Try a different name or category.')}
                  compact
                />
              ) : (
                <div className="bl-grid--tiles bl-scroll">
                  {tiles.map((product) => {
                    const inCart = cartQtyFor(product.id);
                    const outOfStock = product.currentStock <= 0;
                    const atLimit = inCart > 0 && inCart >= product.currentStock;

                    return (
                      <button
                        key={product.id}
                        type="button"
                        className={`bl-card bl-card--interactive bl-tile${inCart > 0 ? ' bl-tile--picked' : ''}`}
                        disabled={outOfStock || atLimit}
                        onClick={() => addToCart(product)}
                      >
                        <ProductThumbnail src={product.imageUrl} name={product.name} size="md" />
                        <span className="bl-tile__name">{product.name}</span>
                        <span className="bl-tile__price">{peso(product.sellingPrice)}</span>
                        <span className={`bl-tile__stock ${outOfStock ? 'bl-tile__stock--out' : ''}`}>
                          {outOfStock
                            ? t('Out of stock')
                            : atLimit
                              ? t('No more stock')
                              : `${number(product.currentStock)} ${product.unit}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

          </div>
          <aside className="bl-pos__side" aria-label={t('Sale details')}>
            <h3 className="bl-pos__side-title">
              Cart
              {cart.length > 0 && (
                <span className="bl-pos__side-count">
                  {` · ${t('{{count}} items', { count: cart.reduce((n, l) => n + l.quantity, 0) })}`}
                </span>
              )}
            </h3>
            <div className="bl-cart bl-scroll" aria-label={t('Cart')}>
              {cart.length === 0 ? (
                <p className="bl-caption bl-cart__empty">{t('No items yet — tap a product to add it.')}</p>
              ) : (
                cart.map((line) => (
                  <div key={line.productId} className="bl-cart__row">
                    <ProductThumbnail src={line.imageUrl} name={line.name} size="sm" />
                    <div className="bl-cart__info">
                      <span className="bl-cart__name">{line.name}</span>
                      <span className="bl-cart__unit">{line.unit}</span>
                    </div>
                    <CurrencyField
                      label={t('Price for {{name}}', { name: line.name })}
                      hideLabel
                      className="bl-cart__price"
                      value={String(line.unitPrice)}
                      onChange={(e) => setLinePrice(line.productId, e.target.value)}
                    />
                    <div className="bl-cart__stepper">
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={removeOutline}
                        aria-label={t('Decrease quantity of {{name}}', { name: line.name })}
                        onClick={() => decrementLine(line.productId)}
                      />
                      <span className="bl-cart__qty">{line.quantity}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={addOutline}
                        aria-label={t('Increase quantity of {{name}}', { name: line.name })}
                        disabled={line.quantity >= line.stock}
                        onClick={() => incrementLine(line.productId)}
                      />
                    </div>
                    <span className="bl-cart__subtotal">{peso(line.unitPrice * line.quantity)}</span>
                    <Button
                      variant="ghost"
                      size="sm"
                      icon={trashOutline}
                      aria-label={t('Remove {{name}} from cart', { name: line.name })}
                      onClick={() => removeLine(line.productId)}
                    />
                  </div>
                ))
              )}
            </div>
            <h3 className="bl-pos__side-title">{t('Sale details')}</h3>
            <div className="bl-pos__side-fields">
              <DateField label={t('Date')} required value={saleDate} onChange={(e) => setSaleDate(e.target.value)} />
              <div className="bl-paychoice" role="radiogroup" aria-label={t('How did the customer pay?')}>
                <span className="bl-label">{t('How did the customer pay?')}</span>
                <div className="bl-paychoice__grid">
                  {(
                    [
                      { mode: 'Cash', text: t('Cash'), logo: <PesoCashLogo size={26} /> },
                      { mode: 'GCash', text: t('GCash'), logo: <GCashLogo size={26} /> },
                      {
                        mode: 'Split',
                        text: t('Cash + GCash'),
                        logo: (
                          <span className="bl-paychoice__duo">
                            <PesoCashLogo size={20} />
                            <GCashLogo size={20} />
                          </span>
                        ),
                      },
                    ] as { mode: PaymentMode; text: string; logo: ReactNode }[]
                  ).map((opt) => (
                    <button
                      key={opt.mode}
                      type="button"
                      role="radio"
                      aria-checked={paymentMode === opt.mode}
                      className={`bl-paychoice__btn${paymentMode === opt.mode ? ' is-on' : ''}`}
                      onClick={() => choosePaymentMode(opt.mode)}
                    >
                      <span className="bl-paychoice__logo">{opt.logo}</span>
                      <span>{opt.text}</span>
                    </button>
                  ))}
                </div>
              </div>
              {paymentMode === 'Split' && (
                <div className="bl-paysplit">
                  <CurrencyField
                    label={t('Paid by GCash')}
                    required
                    value={gcashAmount}
                    onChange={(e) => setGcashAmount(e.target.value)}
                    error={gcashAmount !== '' && !splitValid ? t('Must be more than zero and less than the total.') : undefined}
                  />
                  <p className="bl-paysplit__sum" role="status" aria-live="polite">
                    {splitValid
                      ? t('Total {{total}} = {{cash}} cash + {{gcash}} GCash', {
                          total: peso(cartTotal),
                          cash: peso(cashPart),
                          gcash: peso(gcashPart),
                        })
                      : t('Total {{total}}. Type the GCash part; the rest is paid in cash.', { total: peso(cartTotal) })}
                  </p>
                </div>
              )}
              {paymentMode !== 'Cash' && (
                <TextField
                  label={t('GCash reference (last 4 digits)')}
                  required
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="1234"
                  hint={t('Last 4 digits of the reference number in the customer\'s GCash receipt')}
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value.replace(/\D/g, '').slice(0, 4))}
                />
              )}
              {paymentMode !== 'GCash' && (
                <div className="bl-pos__cash">
                  <CurrencyField
                    label={t('Cash received')}
                    placeholder="0.00"
                    value={cashReceived}
                    onChange={(e) => setCashReceived(e.target.value)}
                  />
                  <div className="bl-pos__cash-chips" role="group" aria-label={t('Quick cash amounts')}>
                    <button
                      type="button"
                      className="bl-pos__chip"
                      disabled={cashPart <= 0}
                      onClick={() => setCashReceived(cashPart.toFixed(2))}
                    >
                      {t('Exact')}
                    </button>
                    {CASH_QUICK_AMOUNTS.map((amount) => (
                      <button
                        key={amount}
                        type="button"
                        className="bl-pos__chip"
                        onClick={() => setCashReceived(String(amount))}
                      >
                        {peso(amount)}
                      </button>
                    ))}
                  </div>
                  <div
                    className={`bl-pos__change bl-pos__change--${cash.state}`}
                    role="status"
                    aria-live="polite"
                  >
                    {cash.state === 'blank' && (
                      <span>{t('Enter the cash received to see the change.')}</span>
                    )}
                    {cash.state === 'change' && (
                      <>
                        <span>{t('Change')}</span>
                        <strong>{peso(cash.centavos / 100)}</strong>
                      </>
                    )}
                    {cash.state === 'short' && (
                      <>
                        <span>{t('Still short')}</span>
                        <strong>{peso(cash.centavos / 100)}</strong>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>
          </aside>
        </div>
      </Modal>
    </Workspace>
  );
}

export default Sales;
