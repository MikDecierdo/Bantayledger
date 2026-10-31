import { IonIcon } from '@ionic/react';
import { calendarOutline } from 'ionicons/icons';
import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n';
import { toUserMessage } from '../../lib/errors';
import { eventService, type LocalEvent } from '../../services/api/eventService';
import Button from '../common/Button';
import { SelectField, TextField } from '../common/Field';
import Modal, { ConfirmDialog } from '../common/Modal';
import { useToast } from '../common/ToastProvider';
import { Card } from '../layout/Section';

const MONTHS = [
  t('January'), t('February'), t('March'), t('April'), t('May'), t('June'),
  t('July'), t('August'), t('September'), t('October'), t('November'), t('December'),
];
const PREP_OPTIONS = [7, 14, 21, 30, 45];

/** Days in a month; February allows the 29th (leap-year fiestas). */
function daysIn(month: number): number {
  return new Date(2024, month, 0).getDate();
}

/**
 * The store's own yearly events — the barangay fiesta, a town fiesta, a school
 * foundation day. When one is near, AI Insights shows a stock-up list for it.
 * National events (Christmas, Undas, New Year…) are built in. Owner adds and
 * removes; staff see the list.
 */
export function LocalEventsSettings() {
  const { activeBusiness, isManager } = useAuth();
  const { showToast } = useToast();
  const businessId = activeBusiness?.id;

  const [events, setEvents] = useState<LocalEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);
  const [name, setName] = useState('');
  const [month, setMonth] = useState('');
  const [day, setDay] = useState('');
  const [prepDays, setPrepDays] = useState('21');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [removeFor, setRemoveFor] = useState<LocalEvent | null>(null);

  const load = useCallback(async () => {
    if (!businessId) return;
    try {
      setEvents(await eventService.list(businessId));
    } catch {
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const closeAdd = () => {
    setAddOpen(false);
    setName('');
    setMonth('');
    setDay('');
    setPrepDays('21');
    setErrors({});
  };

  const handleAdd = async () => {
    if (!businessId) return;
    const next: Record<string, string> = {};
    if (!name.trim()) next.name = t('Enter a name for the event.');
    if (!month) next.month = t('Choose the month.');
    if (!day) next.day = t('Choose the day.');
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    setSaving(true);
    try {
      await eventService.add(businessId, { name: name.trim(), month: Number(month), day: Number(day), prepDays: Number(prepDays) });
      showToast(t('Event saved. Its stock-up list will appear {{days}} days before.', { days: prepDays }));
      closeAdd();
      await load();
    } catch (error) {
      setErrors({ form: toUserMessage(error, t('Could not save the event. Please try again.')) });
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async () => {
    if (!businessId || !removeFor) return;
    try {
      await eventService.remove(businessId, removeFor.id);
      showToast(t('Event removed.'));
      await load();
    } catch (error) {
      showToast(toUserMessage(error, t('Could not remove the event.')));
    } finally {
      setRemoveFor(null);
    }
  };

  const dayOptions = Array.from({ length: month ? daysIn(Number(month)) : 31 }, (_, i) => ({ value: String(i + 1), label: String(i + 1) }));

  return (
    <>
      <Card className="bl-set__group" padding="none">
        <header className="bl-set__group-head">
          <span className="bl-set__group-icon" aria-hidden="true">
            <IonIcon icon={calendarOutline} />
          </span>
          <div>
            <h2 className="bl-card-title">{t('Local events')}</h2>
            <p className="bl-caption">
              {t('Your barangay fiesta and other local events. Before each one, AI Insights lists what to stock. Christmas, New Year, Undas and other national events are already included.')}
            </p>
          </div>
          {isManager && (
            <Button variant="primary" size="sm" onClick={() => setAddOpen(true)} style={{ marginLeft: 'auto' }}>
              {t('Add event')}
            </Button>
          )}
        </header>
        <div className="bl-set__rows">
          {loading ? (
            <div className="bl-set__row">
              <span className="bl-caption">{t('Loading')}</span>
            </div>
          ) : events.length === 0 ? (
            <div className="bl-set__row">
              <span className="bl-caption">
                {isManager
                  ? t('No local events yet. Add your barangay fiesta so you get a stock-up list before it.')
                  : t('No local events yet.')}
              </span>
            </div>
          ) : (
            events.map((ev) => (
              <div className="bl-set__row" key={ev.id}>
                <div className="bl-set__row-text">
                  <span className="bl-set__row-title">{ev.name}</span>
                  <span className="bl-caption">
                    {t('Every {{month}} {{day}} · list appears {{days}} days before', { month: MONTHS[ev.month - 1], day: ev.day, days: ev.prepDays })}
                  </span>
                </div>
                {isManager && (
                  <div className="bl-set__row-control">
                    <Button variant="ghost" size="sm" onClick={() => setRemoveFor(ev)}>
                      {t('Remove')}
                    </Button>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </Card>

      <Modal
        isOpen={addOpen}
        onClose={closeAdd}
        title={t('Add a local event')}
        icon="form"
        description={t('It repeats every year on the same date.')}
        footer={
          <>
            <Button variant="secondary" onClick={closeAdd}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" loading={saving} onClick={() => void handleAdd()}>
              {t('Save event')}
            </Button>
          </>
        }
      >
        <div className="bl-form-grid">
          {errors.form && (
            <p className="bl-form-error" role="alert">
              {errors.form}
            </p>
          )}
          <TextField
            label={t('Event name')}
            placeholder={t('e.g. Barangay San Roque fiesta')}
            value={name}
            maxLength={80}
            required
            error={errors.name}
            onChange={(e) => setName(e.target.value)}
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.4fr) minmax(0, 1fr)', gap: 12 }}>
            <SelectField
              label={t('Month')}
              value={month}
              required
              placeholder={t('Choose')}
              error={errors.month}
              options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))}
              onChange={(e) => {
                setMonth(e.target.value);
                if (day && Number(day) > daysIn(Number(e.target.value))) setDay('');
              }}
            />
            <SelectField
              label={t('Day')}
              value={day}
              required
              placeholder={t('Choose')}
              error={errors.day}
              options={dayOptions}
              onChange={(e) => setDay(e.target.value)}
            />
          </div>
          <SelectField
            label={t('Show the stock-up list')}
            value={prepDays}
            options={PREP_OPTIONS.map((d) => ({ value: String(d), label: t('{{days}} days before', { days: d }) }))}
            onChange={(e) => setPrepDays(e.target.value)}
          />
        </div>
      </Modal>

      <ConfirmDialog
        isOpen={removeFor !== null}
        title={t('Remove {{name}}?', { name: removeFor?.name ?? '' })}
        message={t('You will no longer get a stock-up list for this event.')}
        confirmLabel={t('Remove')}
        onConfirm={() => void handleRemove()}
        onCancel={() => setRemoveFor(null)}
      />
    </>
  );
}

export default LocalEventsSettings;
