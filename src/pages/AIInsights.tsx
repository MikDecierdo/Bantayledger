import { IonIcon } from '@ionic/react';
import { bulbOutline, refreshOutline } from 'ionicons/icons';
import { useMemo, useState } from 'react';
import Button from '../components/common/Button';
import { EmptyState, ErrorState, LoadingState, SkeletonGrid } from '../components/common/States';
import { useToast } from '../components/common/ToastProvider';
import { ChipFilter, ResultCount } from '../components/common/Toolbar';
import AIInsightCard from '../components/dashboard/AIInsightCard';
import PageHeader from '../components/layout/PageHeader';
import { Card } from '../components/layout/Section';
import { Bento, Workspace } from '../components/layout/Workspace';
import { useAuth } from '../context/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { useForecastRefresh } from '../hooks/useForecastRefresh';
import { toUserMessage } from '../lib/errors';
import { dataService } from '../services/dataService';
import { relativeTime } from '../utils/format';
import './AIInsights.css';
import { t } from '../i18n';

type Filter = 'all' | 'trending' | 'event' | 'high' | 'Inventory' | 'Pricing' | 'Purchasing' | 'Sales' | 'Waste';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: t('All insights') },
  { value: 'trending', label: t('Trending') },
  { value: 'event', label: t('Events') },
  { value: 'high', label: t('High impact') },
  { value: 'Inventory', label: t('Inventory') },
  { value: 'Pricing', label: t('Pricing') },
  { value: 'Purchasing', label: t('Purchasing') },
  { value: 'Sales', label: t('Sales') },
  { value: 'Waste', label: t('Spoiled & Damaged') },
];

export function AIInsights() {
  const { activeBusiness } = useAuth();
  // Saved insights show straight away; they are brought up to date in the
  // background and re-read quietly if anything changed.
  const { data, loading, error, reload, refresh } = useAsyncData(() => dataService.getInsights(), [activeBusiness?.id]);
  const updating = useForecastRefresh(activeBusiness?.id, refresh);
  const { showToast } = useToast();
  const [filter, setFilter] = useState<Filter>('all');
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await dataService.refreshForecasts();
      reload();
      showToast(t('Insights updated from your latest records.'));
    } catch (err) {
      showToast(toUserMessage(err, t('Could not refresh insights. Please try again.')), 'error');
    } finally {
      setRefreshing(false);
    }
  };

  const filtered = useMemo(() => {
    const list = data ?? [];
    if (filter === 'all') return list;
    if (filter === 'trending') return list.filter((i) => i.topic === 'trending');
    if (filter === 'event') return list.filter((i) => i.topic === 'event');
    if (filter === 'high') return list.filter((i) => i.impact === 'high');
    return list.filter((i) => i.category === filter);
  }, [data, filter]);

  const header = (
    <PageHeader
      title={t('AI Insights')}
      description={t('Patterns found in your sales, stock and supplier records, with a suggested next step.')}
      actions={
        <Button
          variant="secondary"
          icon={refreshOutline}
          loading={refreshing || updating}
          onClick={() => void handleRefresh()}
        >
          {refreshing || updating ? t('Updating') : t('Refresh')}
        </Button>
      }
    />
  );

  if (loading) {
    return (
      <>
        {header}
        <LoadingState label={t('Loading insights')}>
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
          title={t('Unable to load insights')}
          description={t('We could not generate insights right now. Please try again.')}
          onRetry={reload}
        />
      </>
    );
  }

  const counts = {
    all: data.length,
    trending: data.filter((i) => i.topic === 'trending').length,
    event: data.filter((i) => i.topic === 'event').length,
    high: data.filter((i) => i.impact === 'high').length,
    Inventory: data.filter((i) => i.category === 'Inventory').length,
    Pricing: data.filter((i) => i.category === 'Pricing').length,
    Purchasing: data.filter((i) => i.category === 'Purchasing').length,
    Sales: data.filter((i) => i.category === 'Sales').length,
    Waste: data.filter((i) => i.category === 'Waste').length,
  };

  return (
    <Workspace>
      {header}

      <Bento>
      {/* How insights are produced — stated plainly, not as a chat interface. */}
      <Card className="bl-ai__about bl-span-3" padding="tight">
        <span className="bl-ai__about-icon" aria-hidden="true">
          <IonIcon icon={bulbOutline} />
        </span>
        <div>
          <h2 className="bl-card-title">{t('How these are generated')}</h2>
          <p className="bl-support">
            Insights are calculated from your own recorded sales, stock levels, purchases and
            spoiled or damaged items. Each one explains why it was flagged so you can judge whether it fits what you
            know about your store. They are suggestions, not instructions. They update on their own
            when your records change; Refresh just recalculates right now.
          </p>
        </div>
      </Card>

      <Card
        fill
        className="bl-span-9 bl-ai__panel"
        action={
          <div className="bl-ai__filters">
            <ChipFilter
              label={t('Filter insights by category')}
              value={filter}
              onChange={setFilter}
              options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))}
            />
          </div>
        }
      >
      <ResultCount shown={filtered.length} total={data.length} noun="insights" />

      {data.length === 0 ? (
        <EmptyState
          icon={bulbOutline}
          title={t('No insights yet')}
          description={t('Nothing stands out in your records right now. Insights appear as you record more sales, purchases and stock changes.')}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={bulbOutline}
          title={t('No insights in this category')}
          description={t('Nothing stood out here. Try another category, or check back after more sales are recorded.')}
          actionLabel={t('Show all insights')}
          onAction={() => setFilter('all')}
          compact
        />
      ) : (
        <div className="bl-grid bl-grid--2 bl-ai__grid">
          {filtered.map((insight) => (
            <AIInsightCard key={insight.id} insight={insight} />
          ))}
        </div>
      )}

      {data.length > 0 && (
        <p className="bl-ai__foot bl-caption">
          {t('Last generated {{v1}}.', { v1: relativeTime(data[0].generatedAt) })}
        </p>
      )}
      </Card>
      </Bento>
    </Workspace>
  );
}

export default AIInsights;
