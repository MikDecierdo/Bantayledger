import { addOutline, bagOutline, checkmarkOutline, createOutline, searchOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import BarChart from '../components/charts/BarChart';
import Button from '../components/common/Button';
import {
  CurrencyField,
  DateField,
  NumberField,
  SearchInput,
  SelectField,
} from '../components/common/Field';
import { Modal } from '../components/common/Modal';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '../components/common/States';
import { Badge } from '../components/common/StatusBadge';
import Toolbar, { ToolbarFilters, ToolbarSearch } from '../components/common/Toolbar';
import StatCard from '../components/dashboard/StatCard';
import PageHeader from '../components/layout/PageHeader';
import PinnedSummary from '../components/layout/PinnedSummary';
import { Card, Section } from '../components/layout/Section';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { alertError, alertSuccess, confirmAction } from '../lib/swal';
import { useAsyncData } from '../hooks/useAsyncData';
import { dataService, usesLiveData } from '../services/dataService';
import { businessService, purchaseService } from '../services/api';
import type { Purchase } from '../types';
import { number, peso, pesoCompact, shortDate } from '../utils/format';
import './Transactions.css';
import { t } from '../i18n';

const STATUS_TONE = { received: 'success', pending: 'warning', cancelled: 'neutral' } as const;

export function Purchases() {
  const { activeBusiness, user, refresh } = useAuth();
  const location = useLocation<{ openAdd?: boolean; presetProductId?: string } | undefined>();

  const { data, loading, error, reload } = useAsyncData(
    () => Promise.all([dataService.getPurchases(), dataService.getPurchasesOverview()]),
    [activeBusiness?.id],
  );

  const { data: products } = useAsyncData(() => dataService.getProducts(), [activeBusiness?.id]);
  const { data: suppliers } = useAsyncData(() => dataService.getSuppliers(), [activeBusiness?.id]);

  const [query, setQuery] = useState('');
  const [supplier, setSupplier] = useState('all');
  const [addOpen, setAddOpen] = useState(false);

  const budget =
    activeBusiness?.monthly_purchase_budget != null ? Number(activeBusiness.monthly_purchase_budget) : null;

  const [budgetOpen, setBudgetOpen] = useState(false);
  const [budgetValue, setBudgetValue] = useState('');
  const [budgetSaving, setBudgetSaving] = useState(false);
  const [budgetError, setBudgetError] = useState<string | null>(null);

  const openBudgetModal = () => {
    setBudgetValue(budget !== null ? String(budget) : '');
    setBudgetError(null);
    setBudgetOpen(true);
  };

  const handleSaveBudget = async () => {
    setBudgetError(null);

    if (!activeBusiness) {
      setBudgetError(t('Setting a budget needs an active business. Please sign in again.'));
      return;
    }

    // An empty field clears the budget rather than failing validation —
    // "no limit set" is a valid, common choice, not an error.
    const nextBudget = budgetValue.trim() === '' ? null : Number(budgetValue);
    if (nextBudget !== null && (Number.isNaN(nextBudget) || nextBudget < 0)) {
      setBudgetError(t('Enter a budget of zero or more, or leave it blank to remove the limit.'));
      return;
    }

    setBudgetSaving(true);
    try {
      await businessService.update(activeBusiness.id, { monthlyPurchaseBudget: nextBudget });
      await refresh();
      setBudgetOpen(false);
      await alertSuccess(nextBudget === null ? t('Budget removed') : t('Budget updated'));
    } catch (err) {
      setBudgetError(toUserMessage(err));
    } finally {
      setBudgetSaving(false);
    }
  };

  const [form, setForm] = useState({
    supplierId: '',
    productId: '',
    quantity: '',
    unitCost: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'received',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /** Prefills the unit cost from what the product usually costs. */
  const chooseProduct = (productId: string) => {
    const product = (products ?? []).find((p) => p.id === productId);
    setForm((f) => ({
      ...f,
      productId,
      unitCost: product ? String(product.costPrice) : f.unitCost,
    }));
  };

  /**
   * Arriving from a Dashboard quick action or a product's "Record Purchase"
   * button — open the Add form immediately, and preselect the product if one
   * was named. Waits for `products` so `chooseProduct` can prefill unit cost.
   */
  useEffect(() => {
    if (!location.state?.openAdd) return;

    setAddOpen(true);
    if (location.state.presetProductId && products) {
      chooseProduct(location.state.presetProductId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, products]);

  const handleMarkReceived = async (purchase: Purchase) => {
    if (!usesLiveData() || !activeBusiness) {
      setFormError(t('Updating a purchase needs an active business. Please sign in again.'));
      return;
    }

    const confirmed = await confirmAction({
      title: t('Mark {{reference}} as received?', { reference: purchase.reference }),
      text: t('{{v1}} {{unit}} of {{productName}} will be added to stock.', { v1: number(purchase.quantity), unit: purchase.unit, productName: purchase.productName }),
      confirmLabel: t('Mark Received'),
      tone: 'primary',
    });
    if (!confirmed) return;

    try {
      await purchaseService.setStatus(activeBusiness.id, purchase.purchaseId, 'received');
      reload();
      await alertSuccess(t('Purchase received'), t('Stock has been increased to match.'));
    } catch (err) {
      await alertError(t('Could not update this purchase'), toUserMessage(err));
    }
  };

  const handleSave = async () => {
    setFormError(null);

    if (!form.productId) {
      setFormError(t('Choose a product.'));
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      setFormError(t('Enter a quantity greater than zero.'));
      return;
    }

    if (!usesLiveData() || !activeBusiness) {
      setFormError(t('Recording a purchase needs an active business. Please sign in again.'));
      return;
    }

    setSaving(true);
    try {
      // A 'received' purchase adds to stock immediately; a 'pending' one does
      // so later, when its status changes.
      await purchaseService.create(activeBusiness.id, user?.id ?? null, {
        supplierId: form.supplierId || null,
        items: [
          {
            productId: form.productId,
            quantity: Number(form.quantity),
            unitCost: Number(form.unitCost) || 0,
          },
        ],
        status: form.status as 'received' | 'pending',
        purchaseDate: form.date,
      });
      setAddOpen(false);
      setForm({ ...form, productId: '', quantity: '', unitCost: '' });
      reload();
      await alertSuccess(t('Purchase recorded'),
        form.status === 'received'
          ? t('Stock has been increased to match.') : t('It will add to stock once you mark it received.'),
      );
    } catch (err) {
      setFormError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const purchases = data?.[0] ?? [];
  const overview = data?.[1];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return purchases.filter((p) => {
      const matchesQuery =
        !q ||
        p.reference.toLowerCase().includes(q) ||
        p.productName.toLowerCase().includes(q) ||
        p.supplierName.toLowerCase().includes(q);
      const matchesSupplier = supplier === 'all' || p.supplierId === supplier;
      return matchesQuery && matchesSupplier;
    });
  }, [purchases, query, supplier]);

  const filteredTotal = filtered.reduce((sum, p) => sum + p.totalCost, 0);

  const header = (
    <PageHeader
      title={t('Purchases')}
      description={t('Stock you have bought in, with unit costs and what each order totalled.')}
      actions={
        <Button variant="primary" icon={addOutline} onClick={() => setAddOpen(true)}>
          {t('Add Purchase')}
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label={t('Loading purchases')}>
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
          title={t('Unable to load purchases')}
          description={t('We could not load your purchase records. Please try again.')}
          onRetry={reload}
        />
      </>
    );
  }

  const { summary, last6Months } = overview;

  return (
    <>
      {header}

      <PinnedSummary>
        <Section title={t('Purchase summary')}>
          <div className="bl-grid bl-grid--kpi">
            <StatCard
              label={t('Month to date')}
              value={peso(summary.monthToDate)}
              changePct={summary.monthChangePct}
              changeLabel={t('vs last month')}
              invertDelta
              emphasis="hero"
              icon={bagOutline}
            />
            <StatCard
              label={t('Pending orders')}
              value={String(summary.pendingOrders)}
              emphasis="plain"
              footnote={t('{{v1}} awaiting delivery', { v1: peso(summary.pendingValue) })}
            />
            <StatCard
              label={t('Average order')}
              value={peso(summary.averageOrderValue)}
              emphasis="plain"
              footnote={t('across recent purchases')}
            />
            <StatCard
              label={t('Suppliers used')}
              value={String(summary.suppliersUsed)}
              emphasis="plain"
              footnote={t('in the last 30 days')}
            />
          </div>
        </Section>
      </PinnedSummary>

      <Section
        title={t('Monthly supplies budget')}
        description={t('An overall cap on what you buy in each month — a heads-up, not a hard stop.')}
      >
        <Card>
          <div className="bl-row bl-row--between bl-tx__budget">
            <div>
              {budget === null ? (
                <p className="bl-support">{t('No budget set yet.')}</p>
              ) : (
                <p className="bl-support">
                  <strong className="bl-table__primary">{peso(summary.monthToDate)}</strong> spent of{' '}
                  <strong className="bl-table__primary">{peso(budget)}</strong>{' '}{t('this month')}
                </p>
              )}
            </div>
            <div className="bl-row bl-tx__budget-actions">
              {budget !== null && (
                <Badge tone={summary.monthToDate >= budget ? 'danger' : summary.monthToDate >= budget * 0.8 ? 'warning' : 'success'}>
                  {summary.monthToDate >= budget
                    ? t('Over budget')
                    : summary.monthToDate >= budget * 0.8
                      ? t('Approaching limit') : t('On track')}
                </Badge>
              )}
              <Button variant="secondary" size="sm" icon={createOutline} onClick={openBudgetModal}>
                {budget === null ? t('Set budget') : t('Edit')}
              </Button>
            </div>
          </div>

          {budget !== null && summary.monthToDate >= budget && (
            <p className="bl-form-error" role="alert">
              {t('You\'ve reached your {{v1}} monthly supplies budget — {{v2}} spent so far this month.', { v1: peso(budget), v2: peso(summary.monthToDate) })}
            </p>
          )}
        </Card>
      </Section>

      <Section title={t('Purchasing spend')} description={t('Monthly totals over the last 6 months')}>
        <Card>
          <BarChart
            data={last6Months}
            format={(v) => peso(v)}
            axisFormat={pesoCompact}
            seriesName="Purchasing spend"
            summary={t('Bar chart of monthly purchasing spend from April to September 2026, rising from ₱61,200 in April to ₱72,150 in August, with September at ₱18,566 so far.')}
            height={220}
          />
        </Card>
      </Section>

      <Section title={t('Recent purchases')}>
        <Toolbar>
          <ToolbarSearch>
            <SearchInput
              label={t('Search purchases by reference, product or supplier')}
              placeholder={t('Search purchases')}
              value={query}
              onValueChange={setQuery}
            />
          </ToolbarSearch>
          <ToolbarFilters>
            <SelectField
              label={t('Filter by supplier')}
              hideLabel
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
              options={[
                { value: 'all', label: t('All suppliers') },
                ...(suppliers ?? []).map((s) => ({ value: s.id, label: s.name })),
              ]}
            />
          </ToolbarFilters>
        </Toolbar>

        {filtered.length > 0 && (
          <div className="bl-tx__totals">
            <div>
              <span className="bl-label">{t('Total shown')}</span>
              <p className="bl-tx__totals-value">{peso(filteredTotal)}</p>
            </div>
            <p className="bl-caption">
              {filtered.length === 1
                ? t('1 purchase of {{total}}', { total: purchases.length })
                : t('{{count}} purchases of {{total}}', { count: filtered.length, total: purchases.length })}
            </p>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={purchases.length === 0 ? bagOutline : searchOutline}
            title={
              purchases.length === 0 ? t('No purchases recorded yet') : t('No purchases match your search')
            }
            description={
              purchases.length === 0
                ? t('Use the button above to record a purchase and track what you spend on stock.') : t('Try a different reference, product or supplier.')
            }
            actionLabel={purchases.length === 0 ? undefined : t('Clear filters')}
            onAction={
              purchases.length === 0
                ? undefined
                : () => {
                    setQuery('');
                    setSupplier('all');
                  }
            }
            compact={purchases.length > 0}
          />
        ) : (
          <>
            <div className="bl-responsive-table">
              <Card padding="none">
                <div className="bl-table-wrap bl-scroll">
                  <table className="bl-table">
                    <caption className="bl-sr-only">{t('Recorded purchase orders')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('Reference')}</th>
                        <th scope="col">{t('Supplier')}</th>
                        <th scope="col">{t('Product')}</th>
                        <th scope="col" className="bl-td-num">
                          {t('Quantity')}
                        </th>
                        <th scope="col" className="bl-td-num">
                          {t('Price per piece')}
                        </th>
                        <th scope="col" className="bl-td-num">
                          {t('Total')}
                        </th>
                        <th scope="col" className="bl-tx__col-secondary">
                          {t('Date')}
                        </th>
                        <th scope="col" className="bl-tx__col-status">
                          {t('Status')}
                        </th>
                        <th scope="col" className="bl-td-actions bl-tx__col-action">
                          <span className="bl-sr-only">{t('Actions')}</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((purchase) => (
                        <tr key={purchase.id}>
                          <td className="bl-table__primary">{purchase.reference}</td>
                          <td>{purchase.supplierName}</td>
                          <td>{purchase.productName}</td>
                          <td className="bl-td-num">
                            {number(purchase.quantity)} {purchase.unit}
                          </td>
                          <td className="bl-td-num">{peso(purchase.unitCost)}</td>
                          <td className="bl-td-num bl-table__primary">{peso(purchase.totalCost)}</td>
                          <td className="bl-tx__col-secondary">{shortDate(purchase.date)}</td>
                          <td className="bl-tx__col-status">
                            <Badge tone={STATUS_TONE[purchase.status]}>
                              {purchase.status === 'received'
                                ? t('Received')
                                : purchase.status === 'pending'
                                  ? t('Pending') : t('Cancelled')}
                            </Badge>
                          </td>
                          <td className="bl-td-actions bl-tx__col-action">
                            {purchase.status === 'pending' && (
                              <Button
                                variant="ghost"
                                size="sm"
                                icon={checkmarkOutline}
                                aria-label={t('Mark {{reference}} as received', { reference: purchase.reference })}
                                onClick={() => void handleMarkReceived(purchase)}
                              />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <ul className="bl-responsive-cards">
              {filtered.map((purchase) => (
                <li key={purchase.id}>
                  <article className="bl-drow">
                    <div className="bl-drow__top">
                      <div>
                        <span className="bl-drow__title">{purchase.productName}</span>
                        <span className="bl-drow__meta">
                          {purchase.reference} · {purchase.supplierName}
                        </span>
                      </div>
                      <Badge tone={STATUS_TONE[purchase.status]}>
                        {purchase.status === 'received'
                          ? t('Received')
                          : purchase.status === 'pending'
                            ? t('Pending') : t('Cancelled')}
                      </Badge>
                    </div>

                    <dl className="bl-drow__grid bl-drow__grid--3">
                      <div className="bl-drow__cell">
                        <dt>{t('Quantity')}</dt>
                        <dd>
                          {number(purchase.quantity)} {purchase.unit}
                        </dd>
                      </div>
                      <div className="bl-drow__cell">
                        <dt>{t('Price per piece')}</dt>
                        <dd>{peso(purchase.unitCost)}</dd>
                      </div>
                      <div className="bl-drow__cell">
                        <dt>{t('Total')}</dt>
                        <dd>{peso(purchase.totalCost)}</dd>
                      </div>
                    </dl>

                    <p className="bl-caption bl-tx__date">{shortDate(purchase.date)}</p>

                    {purchase.status === 'pending' && (
                      <Button
                        variant="secondary"
                        size="sm"
                        icon={checkmarkOutline}
                        onClick={() => void handleMarkReceived(purchase)}
                      >
                        {t('Mark Received')}
                      </Button>
                    )}
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
      </Section>

      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('Add Purchase')}
        description={t('Record stock bought in so cost forecasts stay accurate.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
              {saving ? t('Saving') : t('Add Purchase')}
            </Button>
          </>
        }
      >
        <form
          className="bl-form-grid bl-form-grid--2"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSave();
          }}
        >
          {formError && (
            <p className="bl-form-error bl-form-grid__full" role="alert">
              {formError}
            </p>
          )}

          <SelectField
            label={t('Supplier')}
            placeholder={t('Select a supplier')}
            value={form.supplierId}
            onChange={(e) => setForm((f) => ({ ...f, supplierId: e.target.value }))}
            options={(suppliers ?? []).map((s) => ({ value: s.id, label: s.name }))}
          />
          <SelectField
            label={t('Product')}
            required
            placeholder={t('Select a product')}
            value={form.productId}
            onChange={(e) => chooseProduct(e.target.value)}
            options={(products ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
          <NumberField
            label={t('Quantity')}
            placeholder="0"
            required
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          <CurrencyField
            label={t('Price per piece')}
            required
            value={form.unitCost}
            onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
          />
          <DateField
            label={t('Purchase date')}
            required
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <SelectField
            label={t('Status')}
            required
            value={form.status}
            onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
            options={[
              { value: 'received', label: t('Received') },
              { value: 'pending', label: t('Pending') },
            ]}
          />
          <p className="bl-caption bl-form-grid__full">
            {t('Price per piece is what you paid for each one. Only a Received order adds to stock.')}
          </p>
        </form>
      </Modal>

      <Modal
        isOpen={budgetOpen}
        onClose={() => setBudgetOpen(false)}
        title={t('Monthly supplies budget')}
        description={t('A heads-up when you\'re close to or over it — recording a purchase is never blocked.')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setBudgetOpen(false)} disabled={budgetSaving}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleSaveBudget()} loading={budgetSaving}>
              {budgetSaving ? t('Saving') : t('Save')}
            </Button>
          </>
        }
      >
        <form
          className="bl-form-grid"
          onSubmit={(e) => {
            e.preventDefault();
            void handleSaveBudget();
          }}
        >
          {budgetError && (
            <p className="bl-form-error bl-form-grid__full" role="alert">
              {budgetError}
            </p>
          )}

          <CurrencyField
            label={t('Monthly budget')}
            hint={t('Leave blank to remove the limit.')}
            className="bl-form-grid__full"
            value={budgetValue}
            onChange={(e) => setBudgetValue(e.target.value)}
          />
        </form>
      </Modal>
    </>
  );
}

export default Purchases;
