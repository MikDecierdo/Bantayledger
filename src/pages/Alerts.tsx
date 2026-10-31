import { checkmarkDoneOutline, notificationsOffOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import Button from '../components/common/Button';
import { EmptyState, ErrorState, LoadingState, SkeletonRows } from '../components/common/States';
import { useToast } from '../components/common/ToastProvider';
import { ChipFilter, ResultCount } from '../components/common/Toolbar';
import AlertCard from '../components/dashboard/AlertCard';
import PageHeader from '../components/layout/PageHeader';
import PinnedSummary from '../components/layout/PinnedSummary';
import { Card } from '../components/layout/Section';
import { Bento, Workspace } from '../components/layout/Workspace';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { alertError, confirmAction } from '../lib/swal';
import { useAsyncData } from '../hooks/useAsyncData';
import { dataService, usesLiveData } from '../services/dataService';
import { alertService } from '../services/api';
import type { Severity } from '../types';
import './Alerts.css';
import { t } from '../i18n';

type Filter = 'all' | 'unread' | Severity;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: t('All') },
  { value: 'unread', label: t('Unread') },
  { value: 'critical', label: t('Urgent') },
  { value: 'warning', label: t('Warning') },
  { value: 'info', label: t('Information') },
];

export function Alerts() {
  const { showToast } = useToast();
  const { activeBusiness, isManager } = useAuth();
  const { data, loading, error, reload } = useAsyncData(
    () => dataService.getAlerts(),
    [activeBusiness?.id],
  );
  const [filter, setFilter] = useState<Filter>('all');
  const [dismissed, setDismissed] = useState<string[]>([]);

  const handleMarkAllRead = async () => {
    if (!usesLiveData() || !activeBusiness) {
      showToast(t('All alerts marked as read.'));
      return;
    }

    const confirmed = await confirmAction({
      title: t('Mark every alert as read?'),
      text: t('They stay in the list, but none will be flagged as needing attention.'),
      confirmLabel: t('Mark all read'),
      tone: 'primary',
    });
    if (!confirmed) return;

    try {
      await alertService.markAllRead(activeBusiness.id);
      showToast(t('All alerts marked as read.'));
      reload();
    } catch (err) {
      await alertError(t('Could not update your alerts'), toUserMessage(err));
    }
  };

  const handleDismiss = async (alertId: string) => {
    if (!isManager) {
      await alertError(t('Only an owner or admin can dismiss alerts'));
      return;
    }

    const confirmed = await confirmAction({
      title: t('Dismiss this alert?'),
      text: t('It will be removed from your alerts. The stock or pricing situation behind it is unchanged.'),
      confirmLabel: t('Dismiss'),
    });
    if (!confirmed) return;

    // Hide it straight away; the list is re-read afterwards.
    setDismissed((d) => [...d, alertId]);

    if (!usesLiveData() || !activeBusiness) {
      showToast(t('Alert dismissed.'));
      return;
    }

    try {
      await alertService.remove(activeBusiness.id, alertId);
      showToast(t('Alert dismissed.'));
    } catch (err) {
      setDismissed((d) => d.filter((id) => id !== alertId));
      await alertError(t('Could not dismiss this alert'), toUserMessage(err));
    }
  };

  const visible = useMemo(
    () => (data ?? []).filter((a) => !dismissed.includes(a.id)),
    [data, dismissed],
  );

  const filtered = useMemo(() => {
    if (filter === 'all') return visible;
    if (filter === 'unread') return visible.filter((a) => !a.read);
    return visible.filter((a) => a.severity === filter);
  }, [visible, filter]);

  const header = (
    <PageHeader
      title={t('Alerts')}
      description={t('Stock, pricing and expense signals that may need a decision soon.')}
      actions={
        <Button
          variant="secondary"
          icon={checkmarkDoneOutline}
          onClick={() => void handleMarkAllRead()}
        >
          {t('Mark all read')}
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label={t('Loading alerts')}>
          <SkeletonRows rows={5} />
        </LoadingState>
      </>
    );
  }

  if (error || !data) {
    return (
      <>
        {header}
        <ErrorState
          title={t('Unable to load alerts')}
          description={t('We could not reach your alerts. Please try again.')}
          onRetry={reload}
        />
      </>
    );
  }

  const counts = {
    all: visible.length,
    unread: visible.filter((a) => !a.read).length,
    critical: visible.filter((a) => a.severity === 'critical').length,
    warning: visible.filter((a) => a.severity === 'warning').length,
    info: visible.filter((a) => a.severity === 'info').length,
  };

  return (
    <Workspace>
      {header}

      {/* Severity totals, each labelled — never color alone. */}
      <PinnedSummary>
        <div className="bl-grid bl-grid--3 bl-alerts__summary">
          <Card className="bl-alerts__sum bl-alerts__sum--critical" padding="tight">
            <span className="bl-label">{t('High priority')}</span>
            <p className="bl-alerts__sum-value">{counts.critical}</p>
            <p className="bl-caption">{t('May affect sales within days')}</p>
          </Card>
          <Card className="bl-alerts__sum bl-alerts__sum--warning" padding="tight">
            <span className="bl-label">{t('Medium priority')}</span>
            <p className="bl-alerts__sum-value">{counts.warning}</p>
            <p className="bl-caption">{t('Worth reviewing this week')}</p>
          </Card>
          <Card className="bl-alerts__sum bl-alerts__sum--info" padding="tight">
            <span className="bl-label">{t('Watch')}</span>
            <p className="bl-alerts__sum-value">{counts.info}</p>
            <p className="bl-caption">{t('Keep an eye on these')}</p>
          </Card>
        </div>
      </PinnedSummary>

      <Bento>
      <Card
        fill
        className="bl-alerts__panel"
        action={
          <div className="bl-alerts__filters">
            <ChipFilter
              label={t('Filter alerts by priority')}
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
            />
          </div>
        }
      >
      <ResultCount shown={filtered.length} total={visible.length} noun="alerts" />

      {filtered.length === 0 ? (
        <EmptyState
          icon={notificationsOffOutline}
          title={visible.length === 0 ? t('You are all caught up') : t('No alerts in this filter')}
          description={
            visible.length === 0
              ? t('Nothing needs your attention right now. We will notify you when something changes.') : t('Try a different priority to see more alerts.')
          }
          actionLabel={visible.length === 0 ? undefined : t('Show all alerts')}
          onAction={visible.length === 0 ? undefined : () => setFilter('all')}
          compact={visible.length > 0}
        />
      ) : (
        <ul className="bl-alerts__list">
          {filtered.map((alert) => (
            <li key={alert.id} className="bl-alerts__item">
              <AlertCard alert={alert} />
              <div className="bl-alerts__item-actions">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void handleDismiss(alert.id)}
                >
                  {t('Dismiss')}
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
      </Card>
      </Bento>
    </Workspace>
  );
}

export default Alerts;
