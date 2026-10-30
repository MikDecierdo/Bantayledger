import { addOutline, searchOutline, walletOutline } from 'ionicons/icons';
import { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import BarChart from '../components/charts/BarChart';
import BarList from '../components/charts/BarList';
import Button from '../components/common/Button';
import {
  CurrencyField,
  DateField,
  SearchInput,
  SelectField,
  TextField,
} from '../components/common/Field';
import { Modal } from '../components/common/Modal';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '../components/common/States';
import { Badge } from '../components/common/StatusBadge';
import Toolbar, { ToolbarFilters, ToolbarSearch } from '../components/common/Toolbar';
import StatCard from '../components/dashboard/StatCard';
import PageHeader from '../components/layout/PageHeader';
import PinnedSummary from '../components/layout/PinnedSummary';
import { Card, Section } from '../components/layout/Section';
import { expenseCategories } from '../data/mockExpenses';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { alertSuccess } from '../lib/swal';
import { useAsyncData } from '../hooks/useAsyncData';
import { dataService, usesLiveData } from '../services/dataService';
import { expenseService } from '../services/api';
import { peso, pesoCompact, shortDate } from '../utils/format';
import './Transactions.css';
import { t } from '../i18n';
import { label } from '../i18n/labels';

export function Expenses() {
  const { activeBusiness, user } = useAuth();
  const location = useLocation<{ openAdd?: boolean } | undefined>();

  const { data, loading, error, reload } = useAsyncData(
    () => Promise.all([dataService.getExpenses(), dataService.getExpensesOverview()]),
    [activeBusiness?.id],
  );

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [addOpen, setAddOpen] = useState(false);

  /** Arriving from a Dashboard quick action — open the Add form immediately. */
  useEffect(() => {
    if (location.state?.openAdd) setAddOpen(true);
  }, [location.state]);

  const [form, setForm] = useState({
    date: new Date().toISOString().slice(0, 10),
    category: '',
    description: '',
    amount: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const handleSave = async () => {
    setFormError(null);

    if (!form.category) {
      setFormError(t('Choose a category.'));
      return;
    }
    if (!form.description.trim()) {
      setFormError(t('Enter a short description.'));
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      setFormError(t('Enter an amount greater than zero.'));
      return;
    }

    if (!usesLiveData() || !activeBusiness) {
      setFormError(t('Saving needs an active business. Please sign in again.'));
      return;
    }

    setSaving(true);
    try {
      await expenseService.create(activeBusiness.id, user?.id ?? null, {
        category: form.category as (typeof expenseCategories)[number],
        description: form.description,
        amount: Number(form.amount),
        expenseDate: form.date,
      });
      setAddOpen(false);
      setForm({ ...form, description: '', amount: '' });
      reload();
      await alertSuccess(t('Expense recorded'));
    } catch (err) {
      setFormError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const expenses = data?.[0] ?? [];
  const overview = data?.[1];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return expenses.filter((e) => {
      const matchesQuery =
        !q || e.description.toLowerCase().includes(q) || e.category.toLowerCase().includes(q);
      const matchesCategory = category === 'all' || e.category === category;
      return matchesQuery && matchesCategory;
    });
  }, [expenses, query, category]);

  const filteredTotal = filtered.reduce((sum, e) => sum + e.amount, 0);

  const header = (
    <PageHeader
      title={t('Expenses')}
      description={t('Everything you spend outside of stock — rent, utilities, wages and more.')}
      actions={
        <Button variant="primary" icon={addOutline} onClick={() => setAddOpen(true)}>
          {t('Add Expense')}
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label={t('Loading expenses')}>
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
          title={t('Unable to load expenses')}
          description={t('We could not load your expense records. Please try again.')}
          onRetry={reload}
        />
      </>
    );
  }

  const { summary, byCategory, last6Months } = overview;

  return (
    <>
      {header}

      <PinnedSummary>
        <Section title={t('Expense summary')}>
          <div className="bl-grid bl-grid--kpi">
            <StatCard
              label={t('Month to date')}
              value={peso(summary.monthToDate)}
              changePct={summary.monthChangePct}
              changeLabel={t('vs last month')}
              invertDelta
              emphasis="hero"
              icon={walletOutline}
            />
            <StatCard
              label={t('Today')}
              value={peso(summary.today)}
              changePct={summary.todayChangePct}
              changeLabel={t('vs yesterday')}
              invertDelta
            />
            <StatCard
              label={t('Largest category')}
              value={peso(summary.largestCategoryAmount)}
              emphasis="plain"
              footnote={summary.largestCategory}
            />
            <StatCard
              label={t('Recorded entries')}
              value={String(expenses.length)}
              emphasis="plain"
              footnote={t('this month')}
            />
          </div>
        </Section>
      </PinnedSummary>

      <div className="bl-grid bl-grid--split bl-grid--gap-lg">
        <Section title={t('Expense trend')} description={t('Monthly totals over the last 6 months')}>
          <Card>
            <BarChart
              data={last6Months}
              format={(v) => peso(v)}
              axisFormat={pesoCompact}
              seriesName="Total expenses"
              summary={t('Bar chart of monthly expenses from April to September 2026, between ₱25,600 and ₱28,100, with September at ₱27,470.')}
              height={230}
            />
          </Card>
        </Section>

        <Section title={t('By category')} description={t('Month to date')}>
          <Card>
            <BarList data={byCategory} format={(v) => peso(v)} />
          </Card>
        </Section>
      </div>

      <Section title={t('Recent expenses')}>
        <Toolbar>
          <ToolbarSearch>
            <SearchInput
              label={t('Search expenses by description or category')}
              placeholder={t('Search expenses')}
              value={query}
              onValueChange={setQuery}
            />
          </ToolbarSearch>
          <ToolbarFilters>
            <SelectField
              label={t('Filter by category')}
              hideLabel
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              options={[
                { value: 'all', label: t('All categories') },
                ...expenseCategories.map((c) => ({ value: c, label: label(c) })),
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
                ? t('1 expense of {{total}}', { total: expenses.length })
                : t('{{count}} expenses of {{total}}', { count: filtered.length, total: expenses.length })}
            </p>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={expenses.length === 0 ? walletOutline : searchOutline}
            title={
              expenses.length === 0 ? t('No expenses recorded yet') : t('No expenses match your search')
            }
            description={
              expenses.length === 0
                ? t('Use the button above to add your first expense and see where your money goes each month.') : t('Try a different description or category.')
            }
            actionLabel={expenses.length === 0 ? undefined : t('Clear filters')}
            onAction={
              expenses.length === 0
                ? undefined
                : () => {
                    setQuery('');
                    setCategory('all');
                  }
            }
            compact={expenses.length > 0}
          />
        ) : (
          <>
            <div className="bl-responsive-table">
              <Card padding="none">
                <div className="bl-table-wrap bl-scroll">
                  <table className="bl-table">
                    <caption className="bl-sr-only">{t('Recorded business expenses')}</caption>
                    <thead>
                      <tr>
                        <th scope="col">{t('Date')}</th>
                        <th scope="col">{t('Category')}</th>
                        <th scope="col">{t('Description')}</th>
                        <th scope="col" className="bl-tx__col-secondary">
                          {t('Paid by')}
                        </th>
                        <th scope="col" className="bl-td-num">
                          {t('Amount')}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((expense) => (
                        <tr key={expense.id}>
                          <td>{shortDate(expense.date)}</td>
                          <td>
                            <Badge tone="neutral">{label(expense.category)}</Badge>
                          </td>
                          <td className="bl-table__primary">{expense.description}</td>
                          <td className="bl-tx__col-secondary">{expense.paidBy}</td>
                          <td className="bl-td-num bl-table__primary">{peso(expense.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>

            <ul className="bl-responsive-cards">
              {filtered.map((expense) => (
                <li key={expense.id}>
                  <article className="bl-drow">
                    <div className="bl-drow__top">
                      <div>
                        <span className="bl-drow__title">{expense.description}</span>
                        <span className="bl-drow__meta">
                          {shortDate(expense.date)} · {expense.paidBy}
                        </span>
                      </div>
                      <span className="bl-tx__amount">{peso(expense.amount)}</span>
                    </div>
                    <Badge tone="neutral">{label(expense.category)}</Badge>
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
        title={t('Add Expense')}
        description={t('Record a business expense so your monthly totals stay accurate.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
              {saving ? t('Saving') : t('Save Expense')}
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

          <DateField
            label={t('Date')}
            required
            value={form.date}
            onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
          />
          <SelectField
            label={t('Category')}
            required
            placeholder={t('Select a category')}
            value={form.category}
            onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
            options={expenseCategories.map((c) => ({ value: c, label: label(c) }))}
          />
          <TextField
            label={t('Description')}
            placeholder={t('e.g. Meralco electricity — August billing')}
            required
            textOnly
            className="bl-form-grid__full"
            value={form.description}
            onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
          />
          <CurrencyField
            label={t('Amount')}
            required
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
        </form>
      </Modal>
    </>
  );
}

export default Expenses;
