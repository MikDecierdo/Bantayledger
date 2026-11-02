import { IonIcon } from '@ionic/react';
import {
  analyticsOutline,
  barChartOutline,
  bulbOutline,
  calendarOutline,
  closeOutline,
  cloudOfflineOutline,
  cubeOutline,
  documentTextOutline,
  informationCircleOutline,
  notificationsOutline,
  peopleOutline,
  phonePortraitOutline,
  receiptOutline,
  sparkles,
  sparklesOutline,
  trendingUpOutline,
} from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { useHistory } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n';
import { toUserMessage } from '../../lib/errors';
import { subscriptionService, type SubscriptionState, type SubscriptionTerm } from '../../services/api/subscriptionService';
import { peso, shortDate } from '../../utils/format';
import Button from '../common/Button';
import { TextField } from '../common/Field';
import Modal, { ConfirmDialog } from '../common/Modal';
import { GCashLogo } from '../common/PaymentLogos';
import { useToast } from '../common/ToastProvider';
import './SubscriptionSettings.css';

const TERM_LABEL: Record<SubscriptionTerm, string> = {
  weekly: t('Weekly'),
  monthly: t('Monthly'),
  yearly: t('Yearly'),
};

const TERM_UNIT: Record<SubscriptionTerm, string> = {
  weekly: t('/ week'),
  monthly: t('/ month'),
  yearly: t('/ year'),
};

const FREE_BENEFITS = [
  { icon: receiptOutline, text: t('Record sales, purchases and expenses') },
  { icon: cloudOfflineOutline, text: t('Works without internet') },
  { icon: phonePortraitOutline, text: t('Android, Windows and iPhone') },
  { icon: notificationsOutline, text: t('Low-stock alerts and dashboard') },
  { icon: cubeOutline, text: t('Up to 75 products') },
  { icon: barChartOutline, text: t('Reports for the last 3 months') },
];

const PLUS_BENEFITS = [
  { icon: cubeOutline, text: t('Unlimited products') },
  { icon: peopleOutline, text: t('Staff accounts') },
  { icon: calendarOutline, text: t('Event stock-up lists with Order buttons') },
  { icon: trendingUpOutline, text: t('Forecasts up to 30 days') },
  { icon: analyticsOutline, text: t('Supplier price and cost warnings') },
  { icon: bulbOutline, text: t('Full AI Insights') },
  { icon: sparklesOutline, text: t('Explain with AI') },
  { icon: documentTextOutline, text: t('Full report history and exports') },
];

const REFERENCE_LENGTH = 13;

/**
 * A decorative block for the demo payment screen. It has no finder squares
 * and is not a QR code, so a phone can't scan it into anything.
 */
function SampleQr() {
  const cells: { x: number; y: number }[] = [];
  for (let y = 0; y < 15; y += 1) {
    for (let x = 0; x < 15; x += 1) {
      if ((x * 7 + y * 11 + x * y) % 3 === 0) cells.push({ x, y });
    }
  }
  return (
    <div className="bl-sub__qr">
      <svg viewBox="0 0 15 15" width="112" height="112" aria-hidden="true" focusable="false">
        {cells.map((c) => (
          <rect key={`${c.x}-${c.y}`} x={c.x} y={c.y} width="1" height="1" fill="currentColor" />
        ))}
      </svg>
      <span className="bl-sub__qr-tag">{t('Sample only, do not scan')}</span>
    </div>
  );
}

function Benefits({ items, plus }: { items: { icon: string; text: string }[]; plus?: boolean }) {
  return (
    <ul className={`bl-plan__benefits ${plus ? 'bl-plan__benefits--plus' : ''}`}>
      {items.map((b) => (
        <li key={b.text}>
          <IonIcon icon={b.icon} aria-hidden="true" />
          <span>{b.text}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Demo subscription for the project defense: compare Free and Plus, then a
 * typed GCash reference number activates Plus. No money moves, nothing is
 * checked with GCash, and the plan is only a label, so every feature stays on
 * for every store. Owners can change the plan; staff see it only.
 */
export function SubscriptionSettings() {
  const { activeBusiness, isManager, refresh } = useAuth();
  const { showToast } = useToast();
  const history = useHistory();
  const businessId = activeBusiness?.id;

  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [term, setTerm] = useState<SubscriptionTerm>('monthly');
  const [open, setOpen] = useState(false);
  const [reference, setReference] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmFree, setConfirmFree] = useState(false);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      setState(await subscriptionService.get(businessId));
    } catch {
      setState(null);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeModal = () => {
    setOpen(false);
    setReference('');
    setError(null);
  };

  const activate = async () => {
    if (!businessId) return;
    if (reference.length !== REFERENCE_LENGTH) {
      setError(t('Enter the full 13-digit GCash reference number.'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const next = await subscriptionService.activate(businessId, term, reference);
      setState(next);
      closeModal();
      await refresh();
      showToast(t('Plus is active until {{date}}.', { date: next.expiresAt ? shortDate(next.expiresAt) : '' }));
    } catch (err) {
      setError(toUserMessage(err, t('Could not activate Plus. Please try again.')));
    } finally {
      setSaving(false);
    }
  };

  const goFree = async () => {
    if (!businessId) return;
    try {
      setState(await subscriptionService.cancel(businessId));
      await refresh();
      showToast(t('This store is back on the Free plan.'));
    } catch (err) {
      showToast(toUserMessage(err, t('Could not change the plan. Please try again.')), 'error');
    } finally {
      setConfirmFree(false);
    }
  };

  const onPlus = state?.plan === 'plus';
  const selected = state?.terms.find((option) => option.term === term);
  const currentPayment = state?.history.find((h) => !h.cancelled && new Date(h.expiresAt) > new Date());

  return (
    <div className="bl-plans">
      <button type="button" className="bl-plans__close" aria-label={t('Close')} onClick={() => history.goBack()}>
        <IonIcon icon={closeOutline} aria-hidden="true" />
      </button>

      <h2 className="bl-plans__title">{onPlus ? t('Your plan') : t('Upgrade your plan')}</h2>

      {loading ? (
        <p className="bl-caption bl-plans__status">{t('Loading')}</p>
      ) : !state ? (
        <p className="bl-caption bl-plans__status">{t('Could not load your plan. Please try again.')}</p>
      ) : (
        <>
          <div className="bl-plans__terms" role="radiogroup" aria-label={t('Choose a plan length')}>
            {state.terms.map((o) => (
              <button
                key={o.term}
                type="button"
                role="radio"
                aria-checked={term === o.term}
                className={`bl-plans__term ${term === o.term ? 'bl-plans__term--on' : ''}`}
                onClick={() => setTerm(o.term)}
              >
                {TERM_LABEL[o.term]}
              </button>
            ))}
          </div>

          <div className="bl-plans__cards">
            <article className="bl-plan">
              <p className="bl-plan__name">{t('Free')}</p>
              <h3 className="bl-plan__headline">{t('Run your store')}</h3>
              <p className="bl-plan__lead">{t('Everything you need to record your day.')}</p>
              {onPlus && isManager ? (
                <button type="button" className="bl-plan__cta bl-plan__cta--outline" onClick={() => setConfirmFree(true)}>
                  {t('Go back to Free')}
                </button>
              ) : (
                <span className="bl-plan__cta bl-plan__cta--current">{onPlus ? t('Free') : t('Your current plan')}</span>
              )}
              <p className="bl-plan__price">
                <strong>{peso(0)}</strong> {t('/ month')}
              </p>
              <Benefits items={FREE_BENEFITS} />
            </article>

            <article className="bl-plan bl-plan--plus">
              <div className="bl-plan__top">
                <p className="bl-plan__name">{t('Plus')}</p>
                <span className="bl-plan__badge">{onPlus ? t('Your plan') : t('Recommended')}</span>
              </div>
              <h3 className="bl-plan__headline">{t('Grow your store')}</h3>
              <p className="bl-plan__lead">{t('Know what to stock, for every season and event.')}</p>
              {isManager ? (
                <button type="button" className="bl-plan__cta bl-plan__cta--primary" onClick={() => setOpen(true)}>
                  <IonIcon icon={sparkles} aria-hidden="true" />
                  {onPlus ? t('Extend Plus') : t('Upgrade to Plus')}
                </button>
              ) : (
                <span className="bl-plan__cta bl-plan__cta--current">
                  {onPlus ? t('Your current plan') : t('Ask the owner to upgrade')}
                </span>
              )}
              <p className="bl-plan__price">
                <strong>{selected ? peso(selected.amount) : ''}</strong> {TERM_UNIT[term]}
              </p>
              {onPlus && state.expiresAt && (
                <p className="bl-plan__active">
                  {t('Active until {{date}}', { date: shortDate(state.expiresAt) })}
                  {currentPayment ? ` · ${t('Ref {{reference}}', { reference: currentPayment.reference })}` : ''}
                </p>
              )}
              <Benefits items={PLUS_BENEFITS} plus />
            </article>
          </div>

          <p className="bl-plans__note" role="note">
            <IonIcon icon={informationCircleOutline} aria-hidden="true" />
            {t('Demo for project defense: no real payment is taken. The limits shown are planned; for now, every store keeps every feature.')}
          </p>

          {state.history.length > 0 && (
            <section className="bl-plans__history">
              <h3>{t('Payment history')}</h3>
              <ul>
                {state.history.map((h) => (
                  <li key={h.id}>
                    <span>
                      {TERM_LABEL[h.term]} · {peso(h.amount)}
                      {h.cancelled ? ` · ${t('Ended early')}` : ''}
                    </span>
                    <span className="bl-caption">
                      {shortDate(h.paidAt)} · {h.reference}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}

      <Modal
        isOpen={open}
        onClose={closeModal}
        title={onPlus ? t('Extend Plus') : t('Upgrade to Plus')}
        icon="budget"
        description={t('Demo for project defense: no real payment is taken.')}
        footer={
          <>
            <Button variant="secondary" onClick={closeModal}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void activate()}>
              {t('Activate')}
            </Button>
          </>
        }
      >
        <div className="bl-form-grid">
          <div className="bl-sub__pay">
            <SampleQr />
            <div className="bl-sub__pay-text">
              <GCashLogo size={30} />
              <p>
                {t('Amount: {{amount}}', { amount: selected ? peso(selected.amount) : '' })} {TERM_UNIT[term]}
              </p>
              <p className="bl-caption">{t('Type the reference number of the sample payment below.')}</p>
            </div>
          </div>

          <TextField
            label={t('GCash reference number')}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0000000000000"
            value={reference}
            maxLength={REFERENCE_LENGTH}
            required
            error={error ?? undefined}
            hint={t('{{count}} of 13 digits', { count: reference.length })}
            onChange={(e) => setReference(e.target.value.replace(/\D/g, '').slice(0, REFERENCE_LENGTH))}
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={confirmFree}
        title={t('Go back to the Free plan?')}
        message={t('The Plus label is removed from this store. Your records and features do not change.')}
        confirmLabel={t('Go back to Free')}
        onConfirm={() => void goFree()}
        onCancel={() => setConfirmFree(false)}
      />
    </div>
  );
}

export default SubscriptionSettings;
