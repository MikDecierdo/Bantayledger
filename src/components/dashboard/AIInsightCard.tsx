import { IonIcon } from '@ionic/react';
import { arrowForwardOutline, sparklesOutline } from 'ionicons/icons';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toUserMessage } from '../../lib/errors';
import { insightCategoryLabel } from '../../utils/format';
import { dataService } from '../../services/dataService';
import type { AiInsight } from '../../types';
import Button from '../common/Button';
import { Badge } from '../common/StatusBadge';
import './AIInsightCard.css';
import { t } from '../../i18n';

interface AIInsightCardProps {
  insight: AiInsight;
  /** Dashboard variant: headline and action only. */
  compact?: boolean;
}

const IMPACT_TONE = { high: 'danger', medium: 'warning', low: 'neutral' } as const;
const IMPACT_LABEL = { high: t('High impact'), medium: t('Medium impact'), low: t('Low impact') } as const;

/**
 * Business-intelligence card.
 *
 * Structured as finding → why it matters → recommended action, with the
 * supporting numbers on show. The AI marker is a small labelled chip, not a
 * chat bubble or a glowing panel.
 */
export function AIInsightCard({ insight, compact = false }: AIInsightCardProps) {
  const [explanation, setExplanation] = useState<string | null>(null);
  const [explaining, setExplaining] = useState(false);
  const [explainError, setExplainError] = useState<string | null>(null);

  const explain = async () => {
    setExplaining(true);
    setExplainError(null);
    try {
      const result = await dataService.explainInsight(insight.id);
      setExplanation(result.text);
    } catch (err) {
      setExplainError(toUserMessage(err, t('Could not get an AI explanation. Please try again.')));
    } finally {
      setExplaining(false);
    }
  };

  return (
    <article className={`bl-card bl-insight ${compact ? 'bl-insight--compact' : ''}`}>
      <div className="bl-insight__top">
        <span className="bl-insight__tag">
          <IonIcon icon={sparklesOutline} aria-hidden="true" />
          {t('AI Insight')}
        </span>
        <div className="bl-insight__tags">
          <Badge tone={IMPACT_TONE[insight.impact]}>{IMPACT_LABEL[insight.impact]}</Badge>
          <Badge tone="neutral">{insightCategoryLabel(insight.category)}</Badge>
        </div>
      </div>

      <h3 className="bl-insight__title">{insight.title}</h3>
      <p className="bl-insight__summary">{insight.summary}</p>

      {!compact && (
        <>
          <dl className="bl-insight__reasoning">
            <dt>{t('Why this matters')}</dt>
            <dd>{insight.whyItMatters}</dd>
            <dt>{t('Recommended action')}</dt>
            <dd>{insight.recommendedAction}</dd>
          </dl>

          <div className="bl-insight__data">
            {insight.supportingData.map((item) => (
              <div className="bl-insight__datum" key={item.label}>
                <span className="bl-insight__datum-label">{item.label}</span>
                <span className="bl-insight__datum-value">{item.value}</span>
              </div>
            ))}
          </div>

          {insight.aiEnabled && (
            <div className="bl-insight__ai">
              {explanation === null ? (
                <Button
                  variant="secondary"
                  size="sm"
                  icon={sparklesOutline}
                  loading={explaining}
                  onClick={() => void explain()}
                >
                  {explaining ? t('Asking AI') : t('Explain with AI')}
                </Button>
              ) : (
                <div className="bl-insight__ai-answer" role="region" aria-label={t('AI explanation')}>
                  <span className="bl-insight__ai-label">
                    <IonIcon icon={sparklesOutline} aria-hidden="true" />
                    {t('AI explanation')}
                  </span>
                  <p>{explanation}</p>
                  <span className="bl-caption">
                    {t('Written by an AI model from this product\'s name and weekly sales only. It can be wrong — treat it as a starting point.')}
                  </span>
                </div>
              )}
              {explainError && (
                <p className="bl-form-error" role="alert">
                  {explainError}
                </p>
              )}
            </div>
          )}
        </>
      )}

      <footer className="bl-insight__foot">
        <span className="bl-caption">
          Based on your recorded data · {insight.confidence}% sure
        </span>
        {insight.productId && (
          <Link to={`/inventory/${insight.productId}`} className="bl-insight__action">
            {t('View product')}
            <IonIcon icon={arrowForwardOutline} aria-hidden="true" />
          </Link>
        )}
      </footer>
    </article>
  );
}

export default AIInsightCard;
