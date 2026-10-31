import { addOutline, searchOutline, trashOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useHistory, useLocation } from 'react-router-dom';
import BarChart from '../components/charts/BarChart';
import BarList from '../components/charts/BarList';
import Button from '../components/common/Button';
import {
  DateField,
  NumberField,
  SearchInput,
  SelectField,
  TextAreaField,
} from '../components/common/Field';
import { Modal } from '../components/common/Modal';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '../components/common/States';
import { Badge } from '../components/common/StatusBadge';
import Toolbar, { ToolbarFilters, ToolbarSearch } from '../components/common/Toolbar';
import StatCard from '../components/dashboard/StatCard';
import PageHeader from '../components/layout/PageHeader';
import PinnedSummary from '../components/layout/PinnedSummary';
import { Card, Section } from '../components/layout/Section';
import { Bento, Rail, Workspace } from '../components/layout/Workspace';
import { wasteReasons } from '../data/mockWaste';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { alertSuccess } from '../lib/swal';
import { useAsyncData } from '../hooks/useAsyncData';
import { dataService, usesLiveData } from '../services/dataService';
import { wasteService } from '../services/api';
import { number, peso, pesoCompact, shortDate, wasteReasonLabel } from '../utils/format';
import './Transactions.css';
import { t } from '../i18n';

const REASON_TONE = {
  Expired: 'danger',
  Damaged: 'warning',
  Spoiled: 'danger',
  Spillage: 'warning',
  'Customer Return': 'neutral',
} as const;

export function Waste() {
  const { activeBusiness, user } = useAuth();

  const { data, loading, error, reload } = useAsyncData(
    () => Promise.all([dataService.getWaste(), dataService.getWasteOverview()]),
    [activeBusiness?.id],
  );

  // Products populate the picker and are needed to value the loss.
  const { data: products } = useAsyncData(() => dataService.getProducts(), [activeBusiness?.id]);

  const [query, setQuery] = useState('');
  const [reason, setReason] = useState('all');
  const [addOpen, setAddOpen] = useState(false);

  // The phone Quick add sheet navigates here with `openAdd` to open the form.
  const history = useHistory();
  const location = useLocation<{ openAdd?: boolean } | undefined>();
  const openAddForm = () => setAddOpen(true);
  useEffect(() => {
    if (!location.state?.openAdd) return;
    openAddForm();
    history.replace({ pathname: location.pathname, state: undefined });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  const [form, setForm] = useState({
    productId: '',
    quantity: '',
    reason: '',
    date: new Date().toISOString().slice(0, 10),
    notes: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);

    if (!form.productId) {
      setFormError(t('Choose the product that was lost.'));
      return;
    }
    if (!form.quantity || Number(form.quantity) <= 0) {
      setFormError(t('Enter a quantity greater than zero.'));
      return;
    }
    if (!form.reason) {
      setFormError(t('Choose a reason.'));
      return;
    }

    if (!usesLiveData() || !activeBusiness) {
      setFormError(t('Saving needs an active business. Please sign in again.'));
      return;
    }

    setSaving(true);
    try {
      // Removes stock through the inventory ledger, so writing off more than
      // is on hand is refused by the database.
      const result = await wasteService.create(activeBusiness.id, user?.id ?? null, {
        productId: form.productId,
        quantity: Number(form.quantity),
        reason: form.reason as (typeof wasteReasons)[number],
        wasteDate: form.date,
        notes: form.notes || undefined,
      });
      setAddOpen(false);
      setForm({ ...form, productId: '', quantity: '', notes: '' });
      reload();
      if (result.queued) {
        await alertSuccess(t('Saved on this phone'), t('There is no internet right now. It will be sent automatically when you are back online.'));
      } else {
        await alertSuccess(t('Item recorded'), t('The spoiled or damaged stock has been taken out of your inventory.'));
      }
    } catch (err) {
      setFormError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const records = data?.[0] ?? [];
  const overview = data?.[1];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return records.filter((r) => {
      const matchesQuery = !q || r.productName.toLowerCase().includes(q);
      const matchesReason = reason === 'all' || r.reason === reason;
      return matchesQuery && matchesReason;
    });
  }, [records, query, reason]);

  const filteredTotal = filtered.reduce((sum, r) => sum + r.estimatedCost, 0);

  const header = (
    <PageHeader
      title={t('Spoiled & Damaged')}
      description={t('Items that expired, spoiled or got damaged, and what they cost you.')}
      actions={
        <Button variant="primary" icon={addOutline} onClick={openAddForm} data-quickadd>
          {t('Add Spoiled/Damaged Item')}
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label={t('Loading spoiled and damaged items')}>
          <SkeletonRows rows={5} />
        </LoadingState>
      </>
    );
  }

  if (error || !data || !overview) {
    return (
      <>
        {header}
        <ErrorState
          title={t('Unable to load spoiled and damaged items')}
          description={t('We could not load your spoiled and damaged items. Please try again.')}
          onRetry={reload}
        />
      </>
    );
  }

  const { summary, byReason, last6Months } = overview;

  return (
    <Workspace>
      {header}

      <PinnedSummary>
        <Section title={t('Spoiled & Damaged summary')}>
          <div className="bl-grid bl-grid--kpi">
            <StatCard
              label={t('Month to date')}
              value={peso(summary.monthToDate)}
              changePct={summary.monthChangePct}
              changeLabel={t('vs last month')}
              invertDelta
              emphasis="hero"
              icon={trashOutline}
            />
            <StatCard
              label={t('Items lost')}
              value={String(summary.itemsLost)}
              emphasis="plain"
              footnote={t('units written off this month')}
            />
            <StatCard
              label={t('Most common reason')}
              value={wasteReasonLabel(summary.topReason)}
              emphasis="plain"
              footnote={
                byReason[0] ? t('{{v1}} lost to this cause', { v1: peso(byReason[0].value) }) : t('Nothing recorded yet')
              }
            />
            <StatCard
              label={t('Loss rate')}
              value={`${summary.wasteRatePct}%`}
              emphasis="plain"
              footnote={t('of stock value, month to date')}
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
          title={t('Spoiled & damaged items')}
          action={
        <Toolbar>
          <ToolbarSearch>
            <SearchInput
              label={t('Search spoiled and damaged items by product')}
              placeholder={t('Search items')}
              value={query}
              onValueChange={setQuery}
            />
          </ToolbarSearch>
          <ToolbarFilters>
            <SelectField
              label={t('Filter by reason')}
              hideLabel
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              options={[
                { value: 'all', label: t('All reasons') },
                ...wasteReasons.map((r) => ({ value: r, label: wasteReasonLabel(r) })),
              ]}
            />
          </ToolbarFilters>
        </Toolbar>
          }
        >
        {filtered.length > 0 && (
          <div className="bl-tx__totals">
            <div>
              <span className="bl-label">{t('Estimated cost shown')}</span>
              <p className="bl-tx__totals-value">{peso(filteredTotal)}</p>
            </div>
            <p className="bl-caption">
              {filtered.length === 1
                ? t('1 record of {{total}}', { total: records.length })
                : t('{{count}} records of {{total}}', { count: filtered.length, total: records.length })}
            </p>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={records.length === 0 ? trashOutline : searchOutline}
            title={records.length === 0 ? t('No spoiled or damaged items yet') : t('No records match your search')}
            description={
              records.length === 0
                ? t('Nothing has been recorded yet. Use the button above when stock expires, spoils or gets damaged, so you can spot patterns over time.') : t('Try a different product or reason.')
            }
            actionLabel={records.length === 0 ? undefined : t('Clear filters')}
            onAction={
              records.length === 0
                ? undefined
                : () => {
                    setQuery('');
                    setReason('all');
                  }
            }
            compact={records.length > 0}
          />
        ) : (
          <>
            <div className="bl-responsive-table">
              <Card padding="none">
                <div className="bl-table-wrap bl-scroll">
                  <table className="bl-table">
                    <caption className="bl-sr-only">{t('Recorded spoiled and damaged items')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('Date')}</th>
                        <th scope="col">{t('Product')}</th>
                        <th scope="col" className="bl-td-num">
                          {t('Quantity')}
                        </th>
                        <th scope="col">{t('Reason')}</th>
                        <th scope="col" className="bl-tx__col-secondary">
                          {t('Recorded by')}
                        </th>
                        <th scope="col" className="bl-td-num">
                          {t('Estimated cost')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((record) => (
                        <tr key={record.id}>
                          <td>{shortDate(record.date)}</td>
                          <td className="bl-table__primary">{record.productName}</td>
                          <td className="bl-td-num">
                            {number(record.quantity)}
                            <div className="bl-table__sub">{record.unit}</div>
                          </td>
                          <td>
                            <Badge tone={REASON_TONE[record.reason]}>{wasteReasonLabel(record.reason)}</Badge>
                          </td>
                          <td className="bl-tx__col-secondary">{record.recordedBy}</td>
                          <td className="bl-td-num bl-table__primary">
                            {peso(record.estimatedCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <ul className="bl-responsive-cards">
              {filtered.map((record) => (
                <li key={record.id}>
                  <article className="bl-drow">
                    <div className="bl-drow__top">
                      <div>
                        <span className="bl-drow__title">{record.productName}</span>
                        <span className="bl-drow__meta">
                          {shortDate(record.date)} · {record.recordedBy}
                        </span>
                      </div>
                      <span className="bl-tx__amount">{peso(record.estimatedCost)}</span>
                    </div>

                    <dl className="bl-drow__grid">
                      <div className="bl-drow__cell">
                        <dt>{t('Quantity')}</dt>
                        <dd>
                          {number(record.quantity)} {record.unit}
                        </dd>
                      </div>
                      <div className="bl-drow__cell">
                        <dt>{t('Reason')}</dt>
                        <dd>
                          <Badge tone={REASON_TONE[record.reason]}>{wasteReasonLabel(record.reason)}</Badge>
                        </dd>
                      </div>
                    </dl>
                  </article>
                </li>
              ))}
            </ul>
          </>
        )}
        </Card>

        <Rail className="bl-span-4 bl-first-small">
          <Card fill title={t('Losses over time')} description={t('Estimated cost over the last 6 months')}>
            <BarChart
              data={last6Months}
              format={(v) => peso(v)}
              axisFormat={pesoCompact}
              seriesName="Cost of losses"
              summary={t('Bar chart of monthly cost of spoiled and damaged items from April to September 2026, peaking at ₱710 in June and falling to ₱303 in September.')}
              height={200}
              fill
            />
          </Card>
          <Card fill title={t('By reason')} description={t('Month to date')}>
            <BarList data={byReason} format={(v) => peso(v)} />
          </Card>
        </Rail>
      </Bento>

      <Modal
        isOpen={addOpen}
        onClose={() => setAddOpen(false)}
        title={t('Record Spoiled/Damaged Item')}
        icon="waste"
        description={t('Record stock that can no longer be sold so losses are visible.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
              {saving ? t('Saving') : t('Save Record')}
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
            label={t('Product')}
            required
            placeholder={t('Select a product')}
            className="bl-form-grid__full"
            value={form.productId}
            onChange={(e) => setForm((f) => ({ ...f, productId: e.target.value }))}
            options={(products ?? []).map((p) => ({ value: p.id, label: p.name }))}
          />
          <NumberField
            label={t('Quantity')}
            placeholder="0"
            required
            value={form.quantity}
            onChange={(e) => setForm((f) => ({ ...f, quantity: e.target.value }))}
          />
          <SelectField
            label={t('Reason')}
            required
            placeholder={t('Select a reason')}
            value={form.reason}
            onChange={(e) => setForm((f) => ({ ...f, reason: e.target.value }))}
            options={wasteReasons.map((r) => ({ value: r, label: wasteReasonLabel(r) }))}
          />
          <DateField
            label={t('Date')}
            required
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <TextAreaField
            label={t('Notes')}
            placeholder={t('Anything worth remembering about this loss')}
            textOnly
            className="bl-form-grid__full"
            value={form.notes}
            onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
          />
        </form>
      </Modal>
    </Workspace>
  );
}

export default Waste;
