import { IonIcon } from '@ionic/react';
import { arrowForwardOutline, listOutline, lockClosedOutline, searchOutline } from 'ionicons/icons';
import { useEffect, useState } from 'react';
import Button from '../components/common/Button';
import { DateField, SearchInput } from '../components/common/Field';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '../components/common/States';
import { Badge } from '../components/common/StatusBadge';
import Toolbar, { ChipFilter, ToolbarSearch } from '../components/common/Toolbar';
import PageHeader from '../components/layout/PageHeader';
import { Card } from '../components/layout/Section';
import { Bento, Workspace } from '../components/layout/Workspace';
import { useAuth } from '../context/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { toUserMessage } from '../lib/errors';
import { intlLocale, t } from '../i18n';
import { label } from '../i18n/labels';
import { activityService, type ActivityCategory, type ActivityEntry, type ActivityPage } from '../services/api/activityService';
import { number, peso, shortDate, wasteReasonLabel } from '../utils/format';
import './ActivityLog.css';

/** What each logged action is called on screen. */
const ACTION_LABELS: Record<string, string> = {
  selling_price_changed: t('Selling price changed'),
  cost_price_changed: t('Cost price changed'),
  cost_price_purchase: t('Cost price updated by a purchase'),
  price_at_sale: t('Sold at a different price'),
  selling_price_set: t('Product added: selling price'),
  cost_price_set: t('Product added: cost price'),
  selling_price_removed: t('Product removed: selling price'),
  cost_price_removed: t('Product removed: cost price'),
  stock_sale: t('Sold'),
  stock_purchase: t('Purchase received'),
  stock_waste: t('Spoiled or damaged'),
  stock_adjustment: t('Stock adjusted'),
  stock_opening: t('Opening stock'),
  stock_reversal_sale: t('Sale deleted, stock returned'),
  stock_reversal_purchase: t('Purchase undone, stock removed'),
  stock_reversal_waste: t('Spoiled record deleted, stock returned'),
  stock_removed: t('Product removed: stock'),
  expense_added: t('Expense added'),
  expense_deleted: t('Expense deleted'),
  sale_recorded: t('Sale recorded'),
  sale_deleted: t('Sale deleted'),
  purchase_recorded: t('Purchase recorded'),
  purchase_status: t('Purchase status changed'),
  purchase_deleted: t('Purchase deleted'),
  product_added: t('Product added'),
  product_renamed: t('Product renamed'),
  product_details_changed: t('Product details changed'),
  product_removed: t('Product removed'),
  product_photo_changed: t('Product photo changed'),
  product_photo_removed: t('Product photo removed'),
  staff_added: t('Staff member added'),
  staff_password_reset: t('Staff password reset'),
  staff_removed: t('Staff member removed'),
  store_created: t('Store created'),
  store_details_changed: t('Store details changed'),
  category_added: t('Category added'),
  category_removed: t('Category removed'),
  supplier_added: t('Supplier added'),
  supplier_changed: t('Supplier details changed'),
  supplier_removed: t('Supplier removed'),
  event_added: t('Event added'),
  event_removed: t('Event removed'),
  plan_started: t('Plus plan started'),
  plan_cancelled: t('Plus plan cancelled'),
  signed_in: t('Signed in'),
  signed_out: t('Signed out'),
};

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  sale: t('Sale'),
  purchase: t('Purchase'),
  price: t('Price'),
  stock: t('Stock'),
  expense: t('Expense'),
  product: t('Product'),
  staff: t('Staff'),
  store: t('Store'),
  account: t('Sign-in'),
};

const CATEGORY_TONES = {
  sale: 'success',
  purchase: 'brand',
  price: 'info',
  stock: 'neutral',
  expense: 'warning',
  product: 'brand',
  staff: 'danger',
  store: 'neutral',
  account: 'info',
} as const;

/** The names of the details an edit can change, as the server sends them. */
const FIELD_LABELS: Record<string, string> = {
  category: t('category'),
  supplier: t('supplier'),
  unit: t('unit'),
  sku: t('SKU'),
  minimum_stock: t('minimum stock'),
  maximum_stock: t('maximum stock'),
  reorder_quantity: t('reorder quantity'),
  is_active: t('shown in sales'),
  size_of: t('size group'),
  name: t('name'),
  business_type: t('type of business'),
  address: t('address'),
  phone: t('phone'),
  email: t('email'),
  purchase_budget: t('monthly purchase budget'),
  contact_person: t('contact person'),
  location: t('map location'),
  status: t('status'),
};

const PAYMENT_LABELS: Record<string, string> = {
  Cash: t('Cash'),
  GCash: t('GCash'),
  Mixed: t('Cash + GCash'),
  Card: t('Card'),
  Other: t('Other'),
};

const PURCHASE_STATUS_LABELS: Record<string, string> = {
  received: t('Received'),
  pending: t('Pending'),
  cancelled: t('Cancelled'),
};

const TERM_LABELS: Record<string, string> = {
  weekly: t('Weekly'),
  monthly: t('Monthly'),
  yearly: t('Yearly'),
};

function timeOf(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleTimeString(intlLocale(), { hour: 'numeric', minute: '2-digit' });
}

/** Prices and expenses show centavos and stock shows its unit, because a log must be exact. */
function valueText(entry: ActivityEntry, value: number): string {
  if (entry.category === 'stock') {
    const qty = number(value, 3);
    return entry.unit ? `${qty} ${entry.unit}` : qty;
  }
  return peso(value, true);
}

function Change({ entry }: { entry: ActivityEntry }) {
  const { oldValue, newValue } = entry;
  return (
    <span className="bl-activity__change">
      {oldValue !== null && <span className={newValue !== null ? 'bl-activity__old' : undefined}>{valueText(entry, oldValue)}</span>}
      {oldValue !== null && newValue !== null && <IonIcon icon={arrowForwardOutline} aria-label={t('changed to')} />}
      {newValue !== null && <strong>{valueText(entry, newValue)}</strong>}
    </span>
  );
}

/** A month and day saved as "MM-DD", e.g. "Dec 25". */
function monthDay(code: string): string {
  const [month, day] = code.split('-').map(Number);
  if (!month || !day) return code;
  return new Date(2024, month - 1, day).toLocaleDateString(intlLocale(), { month: 'short', day: 'numeric' });
}

/** Changed-detail codes ("unit,sku") as words, in the app's language. */
function fieldsText(codes: string): string {
  const names = codes.split(',').filter(Boolean).map((code) => FIELD_LABELS[code] ?? code);
  return names.length ? `${t('Changed')}: ${names.join(', ')}` : '';
}

/** A record's own date, shown when the entry is about a dated record. */
function withDate(text: string, entry: ActivityEntry): string {
  return entry.recordDate ? [text, shortDate(entry.recordDate)].filter(Boolean).join(' · ') : text;
}

/** The details: the reason, payment, status, what changed, or a typed note. */
function reasonOf(entry: ActivityEntry): string {
  const notes = entry.notes ?? '';
  switch (entry.action) {
    case 'expense_added':
    case 'expense_deleted':
      return withDate(notes ? label(notes) : '', entry);
    case 'stock_waste':
      return notes ? wasteReasonLabel(notes) : '';
    case 'sale_recorded':
    case 'sale_deleted':
      return withDate(PAYMENT_LABELS[notes] ?? notes, entry);
    case 'purchase_recorded':
    case 'purchase_deleted':
      return withDate(PURCHASE_STATUS_LABELS[notes] ?? notes, entry);
    case 'purchase_status': {
      const [from, to] = notes.split('>');
      return `${PURCHASE_STATUS_LABELS[from] ?? from} → ${PURCHASE_STATUS_LABELS[to] ?? to}`;
    }
    case 'product_renamed':
      return t('Was: {{name}}', { name: notes });
    case 'product_details_changed':
    case 'store_details_changed':
    case 'supplier_changed':
      return fieldsText(notes);
    case 'event_added':
    case 'event_removed':
      return notes ? monthDay(notes) : '';
    case 'plan_started':
      return TERM_LABELS[notes] ?? notes;
    default:
      return notes;
  }
}

export function ActivityLog() {
  const { activeBusiness, isManager } = useAuth();
  const [category, setCategory] = useState<'all' | ActivityCategory>('all');
  const [typed, setTyped] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [more, setMore] = useState<{ base: ActivityPage | null; items: ActivityEntry[]; next: number | null }>({
    base: null,
    items: [],
    next: null,
  });
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  // Search once typing pauses, not on every letter.
  useEffect(() => {
    const timer = window.setTimeout(() => setQuery(typed.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [typed]);

  const filters = {
    category: category === 'all' ? undefined : category,
    q: query,
    from,
    to,
  };

  const { data, loading, error, reload } = useAsyncData(
    () => (activeBusiness && isManager
      ? activityService.list(activeBusiness.id, filters)
      : Promise.resolve({ items: [], nextBefore: null })),
    [activeBusiness?.id, isManager, category, query, from, to],
  );

  // Pages added by "Load more" belong to the first page they followed. When the
  // filters bring a new first page, they're dropped in the same render, so old
  // rows never mix into new results.
  const current = more.base === data ? more : { base: data, items: [], next: data?.nextBefore ?? null };

  // A failed "Load more" doesn't follow you to new results.
  useEffect(() => setMoreError(null), [data]);

  const loadMore = async () => {
    if (!activeBusiness || current.next === null) return;
    const base = data;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await activityService.list(activeBusiness.id, { ...filters, before: current.next });
      // Ignore a page that arrives after the filters have changed.
      setMore((m) => {
        const now = m.base === base ? m : { base, items: [], next: null };
        return { base, items: [...now.items, ...page.items], next: page.nextBefore };
      });
    } catch (err) {
      setMoreError(toUserMessage(err));
    } finally {
      setLoadingMore(false);
    }
  };

  const clearFilters = () => {
    setCategory('all');
    setTyped('');
    setQuery('');
    setFrom('');
    setTo('');
  };

  const header = (
    <PageHeader
      title={t('Activity log')}
      description={t('Everything that happens in your store: who did it, when, and what changed. Entries can\'t be edited or deleted.')}
    />
  );

  if (!isManager) {
    return (
      <>
        {header}
        <EmptyState
          icon={lockClosedOutline}
          title={t('Only the store owner can see the activity log')}
          description={t('Ask the owner of this store if you need to check a change.')}
        />
      </>
    );
  }

  if (loading && !data) {
    return (
      <>
        {header}
        <LoadingState label={t('Loading activity log')}>
          <SkeletonRows rows={6} />
        </LoadingState>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <ErrorState
          title={t('Unable to load the activity log')}
          description={t('We could not load the activity log. Please try again.')}
          onRetry={reload}
        />
      </>
    );
  }

  const entries = [...data.items, ...current.items];
  const filtering = category !== 'all' || Boolean(query || from || to);

  return (
    <Workspace>
      {header}

      <Bento>
        <Card
          fill
          padding="none"
          as="h2"
          className="bl-span-12"
          title={t('All activity')}
          action={
            <Toolbar>
              <ToolbarSearch>
                <SearchInput
                  label={t('Search by item, person or note')}
                  placeholder={t('Search item, person or note')}
                  value={typed}
                  onValueChange={setTyped}
                />
              </ToolbarSearch>
            </Toolbar>
          }
        >
          <div className="bl-activity__chips">
            <ChipFilter
              label={t('Filter by type')}
              value={category}
              onChange={setCategory}
              options={[
                { value: 'all', label: t('All') },
                { value: 'sale', label: t('Sales') },
                { value: 'purchase', label: t('Purchases') },
                { value: 'price', label: t('Prices') },
                { value: 'stock', label: t('Stock') },
                { value: 'expense', label: t('Expenses') },
                { value: 'product', label: t('Products') },
                { value: 'staff', label: t('Staff') },
                { value: 'store', label: t('Store settings') },
                { value: 'account', label: t('Sign-ins') },
              ]}
            />
            <div className="bl-activity__dates">
              <DateField label={t('From')} className="bl-activity__date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} />
              <DateField label={t('To')} className="bl-activity__date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {entries.length === 0 ? (
            <EmptyState
              icon={filtering ? searchOutline : listOutline}
              title={filtering ? t('No activity matches your search') : t('Nothing logged yet')}
              description={
                filtering
                  ? t('Try a different word, type or date.')
                  : t('Sales, purchases, price and stock changes, expenses, staff changes and sign-ins will appear here as they happen.')
              }
              actionLabel={filtering ? t('Clear filters') : undefined}
              onAction={filtering ? clearFilters : undefined}
              compact={filtering}
            />
          ) : (
            <>
              <div className="bl-responsive-table">
                <div className="bl-table-wrap bl-scroll">
                  <table className="bl-table">
                    <caption className="bl-sr-only">{t('Everything that happened in the store, newest first')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('When')}</th>
                        <th scope="col">{t('Who')}</th>
                        <th scope="col">{t('What happened')}</th>
                        <th scope="col">{t('Item')}</th>
                        <th scope="col">{t('Change')}</th>
                        <th scope="col">{t('Details')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {entries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="bl-activity__when">
                            {shortDate(entry.at)}
                            <span className="bl-caption">{timeOf(entry.at)}</span>
                          </td>
                          <td>{entry.actor ?? t('Deleted account')}</td>
                          <td>
                            <Badge tone={CATEGORY_TONES[entry.category]}>{CATEGORY_LABELS[entry.category]}</Badge>
                            <span className="bl-activity__action">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                          </td>
                          <td className="bl-table__primary">{entry.subject}</td>
                          <td><Change entry={entry} /></td>
                          <td className="bl-activity__details">{reasonOf(entry)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <ul className="bl-responsive-cards">
                {entries.map((entry) => (
                  <li key={entry.id}>
                    <article className="bl-drow">
                      <div className="bl-drow__top">
                        <div>
                          <span className="bl-drow__title">{entry.subject}</span>
                          <span className="bl-drow__meta">
                            {shortDate(entry.at)} {timeOf(entry.at)} · {entry.actor ?? t('Deleted account')}
                          </span>
                        </div>
                        <Badge tone={CATEGORY_TONES[entry.category]}>{CATEGORY_LABELS[entry.category]}</Badge>
                      </div>
                      <span className="bl-activity__action">{ACTION_LABELS[entry.action] ?? entry.action}</span>
                      <Change entry={entry} />
                      {reasonOf(entry) && <span className="bl-caption">{reasonOf(entry)}</span>}
                    </article>
                  </li>
                ))}
              </ul>

              {moreError && (
                <p className="bl-form-error bl-activity__moreerror" role="alert">
                  {moreError}
                </p>
              )}
              {current.next !== null && (
                <div className="bl-activity__more">
                  <Button variant="secondary" onClick={() => void loadMore()} loading={loadingMore}>
                    {t('Load more')}
                  </Button>
                </div>
              )}
            </>
          )}
        </Card>
      </Bento>
    </Workspace>
  );
}

export default ActivityLog;
