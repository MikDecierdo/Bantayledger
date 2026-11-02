import { IonIcon } from '@ionic/react';
import { informationCircleOutline, ribbonOutline } from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n';
import { toUserMessage } from '../../lib/errors';
import { subscriptionService, type SubscriptionState, type SubscriptionTerm } from '../../services/api/subscriptionService';
import { peso, shortDate } from '../../utils/format';
import Button from '../common/Button';
import { TextField } from '../common/Field';
import Modal, { ConfirmDialog } from '../common/Modal';
import { GCashLogo } from '../common/PaymentLogos';
import { Badge } from '../common/StatusBadge';
import { useToast } from '../common/ToastProvider';
import { Card } from '../layout/Section';
import './SubscriptionSettings.css';

const TERM_LABEL: Record<SubscriptionTerm, string> = {
  weekly: t('Weekly'),
  monthly: t('Monthly'),
  yearly: t('Yearly'),
};

const PLANNED_FEATURES = [
  t('Event stock-up lists'),
  t('Staff accounts'),
  t('30-day forecasts'),
  t('Report exports'),
  t('Unlimited products'),
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

/**
 * Demo subscription for the project defense. Typing a full GCash reference
 * number activates Plus; no money moves, nothing is checked with GCash, and
 * the plan is only a label, so every feature stays on for every store.
 */
export function SubscriptionSettings() {
  const { activeBusiness, isManager, refresh } = useAuth();
  const { showToast } = useToast();
  const businessId = activeBusiness?.id;

  const [state, setState] = useState<SubscriptionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState<SubscriptionTerm>('monthly');
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
    <>
      <Card className="bl-set__group" padding="none">
        <header className="bl-set__group-head">
          <span className="bl-set__group-icon" aria-hidden="true">
            <IonIcon icon={ribbonOutline} />
          </span>
          <div>
            <h2 className="bl-card-title">{t('Your plan')}</h2>
            <p className="bl-caption">{t('Your store plan and GCash payments.')}</p>
          </div>
          {isManager && state && (
            <Button variant="primary" size="sm" onClick={() => setOpen(true)} style={{ marginLeft: 'auto' }}>
              {onPlus ? t('Extend') : t('Upgrade to Plus')}
            </Button>
          )}
        </header>

        <p className="bl-sub__note" role="note">
          <IonIcon icon={informationCircleOutline} aria-hidden="true" />
          {t('Demo for project defense: no real payment is taken, and every feature stays available on every plan.')}
        </p>

        <div className="bl-set__rows">
          {loading ? (
            <div className="bl-set__row">
              <span className="bl-caption">{t('Loading')}</span>
            </div>
          ) : !state ? (
            <div className="bl-set__row">
              <span className="bl-caption">{t('Could not load your plan. Please try again.')}</span>
            </div>
          ) : (
            <>
              <div className="bl-set__row">
                <div className="bl-set__row-text">
                  <span className="bl-set__row-title">{t('Current plan')}</span>
                  <span className="bl-caption">
                    {onPlus && state.expiresAt
                      ? t('Active until {{date}}', { date: shortDate(state.expiresAt) })
                      : t('No active subscription')}
                    {onPlus && currentPayment ? ` · ${t('Ref {{reference}}', { reference: currentPayment.reference })}` : ''}
                  </span>
                </div>
                <div className="bl-set__row-control" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <Badge tone={onPlus ? 'success' : 'neutral'}>{onPlus ? t('Plus') : t('Free')}</Badge>
                  {isManager && onPlus && (
                    <Button variant="ghost" size="sm" onClick={() => setConfirmFree(true)}>
                      {t('Go back to Free')}
                    </Button>
                  )}
                </div>
              </div>

              <div className="bl-set__row">
                <div className="bl-set__row-text">
                  <span className="bl-set__row-title">{t('Plus prices')}</span>
                  <span className="bl-caption">
                    {state.terms.map((o) => `${TERM_LABEL[o.term]} ${peso(o.amount)}`).join(' · ')}
                  </span>
                </div>
              </div>

              <div className="bl-set__row">
                <div className="bl-set__row-text">
                  <span className="bl-set__row-title">{t('Planned for Plus')}</span>
                  <span className="bl-caption">{PLANNED_FEATURES.join(' · ')}</span>
                </div>
              </div>

              {state.history.length > 0 && (
                <div className="bl-set__row bl-sub__history-row">
                  <span className="bl-set__row-title">{t('Payment history')}</span>
                  <ul className="bl-sub__history">
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
                </div>
              )}
            </>
          )}
        </div>
      </Card>

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
          <div className="bl-sub__terms" role="radiogroup" aria-label={t('Choose a plan length')}>
            {state?.terms.map((o) => (
              <button
                key={o.term}
                type="button"
                role="radio"
                aria-checked={term === o.term}
                className={`bl-sub__term ${term === o.term ? 'bl-sub__term--on' : ''}`}
                onClick={() => setTerm(o.term)}
              >
                <span>{TERM_LABEL[o.term]}</span>
                <strong>{peso(o.amount)}</strong>
              </button>
            ))}
          </div>

          <div className="bl-sub__pay">
            <SampleQr />
            <div className="bl-sub__pay-text">
              <GCashLogo size={30} />
              <p>{t('Amount: {{amount}}', { amount: selected ? peso(selected.amount) : '' })}</p>
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
    </>
  );
}

export default SubscriptionSettings;
