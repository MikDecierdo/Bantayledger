import { IonIcon } from '@ionic/react';
import {
  businessOutline,
  chevronForwardOutline,
  informationCircleOutline,
  lockClosedOutline,
  notificationsOutline,
  personOutline,
  peopleOutline,
  phonePortraitOutline,
} from 'ionicons/icons';
import { useState, type ReactNode } from 'react';
import Button from '../components/common/Button';
import { SelectField, Switch, TextField } from '../components/common/Field';
import { ConfirmDialog } from '../components/common/Modal';
import { useToast } from '../components/common/ToastProvider';
import PageHeader from '../components/layout/PageHeader';
import { Card } from '../components/layout/Section';
import { Bento, Workspace } from '../components/layout/Workspace';
import { useFitMode } from '../hooks/useBreakpoint';
import { useAuth } from '../context/AuthContext';
import { useAsyncData } from '../hooks/useAsyncData';
import { dataService } from '../services/dataService';
import './Settings.css';
import { t } from '../i18n';
import LanguageSelect from '../components/common/LanguageSelect';
import TeamSettings from '../components/settings/TeamSettings';

/** One settings row: label, supporting text and a control on the right. */
function SettingRow({
  title,
  description,
  control,
}: {
  title: string;
  description?: string;
  control: ReactNode;
}) {
  return (
    <div className="bl-set__row">
      <div className="bl-set__row-text">
        <span className="bl-set__row-title">{title}</span>
        {description && <span className="bl-caption">{description}</span>}
      </div>
      <div className="bl-set__row-control">{control}</div>
    </div>
  );
}

function SettingGroup({
  icon,
  title,
  description,
  children,
}: {
  icon: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Card className="bl-set__group" padding="none">
      <header className="bl-set__group-head">
        <span className="bl-set__group-icon" aria-hidden="true">
          <IonIcon icon={icon} />
        </span>
        <div>
          <h2 className="bl-card-title">{title}</h2>
          <p className="bl-caption">{description}</p>
        </div>
      </header>
      <div className="bl-set__rows">{children}</div>
    </Card>
  );
}

export function Settings() {
  const { showToast } = useToast();
  const { activeBusiness } = useAuth();

  // The signed-in user's own details, not a bundled sample.
  const { data: profile } = useAsyncData(() => dataService.getProfile(), [activeBusiness?.id]);
  const businessProfile = profile;

  const [lowStock, setLowStock] = useState(true);
  const [priceAlerts, setPriceAlerts] = useState(true);
  const [dailySummary, setDailySummary] = useState(false);
  const [forecastAlerts, setForecastAlerts] = useState(true);
  const [compactRows, setCompactRows] = useState(false);
  const [showCents, setShowCents] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const save = () => showToast(t('Changes saved.'));

  // Desktop fit mode shows one group at a time beside a list of groups, so
  // the page fits the screen; elsewhere every group is listed in turn.
  const fit = useFitMode();
  type GroupId = 'account' | 'business' | 'notifications' | 'display' | 'team' | 'security' | 'about';
  const [group, setGroup] = useState<GroupId>('account');
  const groups: { id: GroupId; icon: string; title: string }[] = [
    { id: 'account', icon: personOutline, title: t('Account') },
    { id: 'business', icon: businessOutline, title: t('Business settings') },
    { id: 'notifications', icon: notificationsOutline, title: t('Notification settings') },
    { id: 'display', icon: phonePortraitOutline, title: t('Display settings') },
    { id: 'team', icon: peopleOutline, title: t('Team') },
    { id: 'security', icon: lockClosedOutline, title: t('Security') },
    { id: 'about', icon: informationCircleOutline, title: t('About') },
  ];
  const show = (id: GroupId) => !fit || group === id;

  return (
    <Workspace>
      <PageHeader
        title={t('Settings')}
        description={t('Control how BantayLedger AI behaves, alerts you and displays your numbers.')}
        actions={
          <Button variant="primary" onClick={save}>
            {t('Save Changes')}
          </Button>
        }
      />

      <Bento className="bl-set__bento">
      {fit && (
        <Card padding="none" className="bl-span-3 bl-set__nav">
          <nav aria-label={t('Settings')}>
            <ul>
              {groups.map((g) => (
                <li key={g.id}>
                  <button
                    type="button"
                    className={`bl-set__navitem ${group === g.id ? 'bl-set__navitem--active' : ''}`}
                    aria-current={group === g.id ? 'true' : undefined}
                    onClick={() => setGroup(g.id)}
                  >
                    <IonIcon icon={g.icon} aria-hidden="true" />
                    <span>{g.title}</span>
                    <IonIcon icon={chevronForwardOutline} className="bl-set__navchev" aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </nav>
        </Card>
      )}
      <div className="bl-set__layout bl-span-9 bl-scroll">
        {show('account') && (
        <SettingGroup
          icon={personOutline}
          title={t('Account')}
          description={t('Your sign-in details and personal information.')}
        >
          <SettingRow
            title={t('Name')}
            description={businessProfile?.ownerName ?? '—'}
            control={
              <Button variant="ghost" size="sm" icon={chevronForwardOutline} iconPosition="end" onClick={save}>
                {t('Edit')}
              </Button>
            }
          />
          <SettingRow
            title={t('Email')}
            description={businessProfile?.email ?? '—'}
            control={
              <Button variant="ghost" size="sm" icon={chevronForwardOutline} iconPosition="end" onClick={save}>
                {t('Change')}
              </Button>
            }
          />
          <SettingRow
            title={t('Phone')}
            description={businessProfile?.phone || '—'}
            control={
              <Button variant="ghost" size="sm" icon={chevronForwardOutline} iconPosition="end" onClick={save}>
                {t('Change')}
              </Button>
            }
          />
        </SettingGroup>
        )}

        {show('business') && (
        <SettingGroup
          icon={businessOutline}
          title={t('Business settings')}
          description={t('How your store and its stock rules are configured.')}
        >
          <SettingRow
            title={t('Business name')}
            control={
              <TextField
                label={t('Business name')}
                hideLabel
                key={businessProfile?.businessName ?? ''}
                defaultValue={businessProfile?.businessName ?? ''}
              />
            }
          />
          <SettingRow
            title={t('Currency')}
            description={t('Used across all figures and reports.')}
            control={
              <SelectField
                label={t('Currency')}
                hideLabel
                defaultValue="PHP"
                options={[{ value: 'PHP', label: t('Philippine Peso (₱)') }]}
              />
            }
          />
          <SettingRow
            title={t('Usual order cover')}
            description={t('How many days of stock an order should cover.')}
            control={
              <SelectField
                label={t('Usual order cover')}
                hideLabel
                defaultValue="7"
                options={[
                  { value: '3', label: t('3 days') },
                  { value: '7', label: t('7 days') },
                  { value: '14', label: t('14 days') },
                  { value: '30', label: t('30 days') },
                ]}
              />
            }
          />
          <SettingRow
            title={t('Week starts on')}
            control={
              <SelectField
                label={t('Week starts on')}
                hideLabel
                defaultValue="monday"
                options={[
                  { value: 'sunday', label: t('Sunday') },
                  { value: 'monday', label: t('Monday') },
                ]}
              />
            }
          />
        </SettingGroup>
        )}

        {show('notifications') && (
        <SettingGroup
          icon={notificationsOutline}
          title={t('Notification settings')}
          description={t('Choose which signals are worth interrupting you for.')}
        >
          <SettingRow
            title={t('Low stock alerts')}
            description={t('Notify when a product falls below its minimum.')}
            control={<Switch checked={lowStock} onChange={setLowStock} label={t('Low stock alerts')} />}
          />
          <SettingRow
            title={t('Supplier price alerts')}
            description={t('Notify when a supplier price moves more than 5%.')}
            control={
              <Switch checked={priceAlerts} onChange={setPriceAlerts} label={t('Supplier price alerts')} />
            }
          />
          <SettingRow
            title={t('Forecast alerts')}
            description={t('Notify when expected sales are more than the stock you have.')}
            control={
              <Switch checked={forecastAlerts} onChange={setForecastAlerts} label={t('Forecast alerts')} />
            }
          />
          <SettingRow
            title={t('Daily summary')}
            description={t('A short end-of-day recap of sales and expenses.')}
            control={
              <Switch checked={dailySummary} onChange={setDailySummary} label={t('Daily summary')} />
            }
          />
        </SettingGroup>
        )}

        {show('display') && (
        <SettingGroup
          icon={phonePortraitOutline}
          title={t('Display settings')}
          description={t('How information is laid out and formatted.')}
        >
          <SettingRow
            title={t('Language')}
            description={t('Choose the language used across the app. The page reloads when you change it.')}
            control={<LanguageSelect />}
          />
          <SettingRow
            title={t('Compact tables')}
            description={t('Fit more rows on screen by reducing row height.')}
            control={
              <Switch checked={compactRows} onChange={setCompactRows} label={t('Compact tables')} />
            }
          />
          <SettingRow
            title={t('Show centavos')}
            description={t('Display amounts with two decimal places.')}
            control={<Switch checked={showCents} onChange={setShowCents} label={t('Show centavos')} />}
          />
          <SettingRow
            title={t('Date format')}
            control={
              <SelectField
                label={t('Date format')}
                hideLabel
                defaultValue="dmy"
                options={[
                  { value: 'dmy', label: t('3 Sep 2026') },
                  { value: 'mdy', label: t('Sep 3, 2026') },
                  { value: 'iso', label: '2026-09-03' },
                ]}
              />
            }
          />
        </SettingGroup>

        )}
        {show('team') && <TeamSettings />}

        {show('security') && (
        <SettingGroup
          icon={lockClosedOutline}
          title={t('Security')}
          description={t('Keep your business records protected.')}
        >
          <SettingRow
            title={t('Password')}
            description={t('Last changed 4 months ago.')}
            control={
              <Button variant="secondary" size="sm" onClick={save}>
                {t('Change password')}
              </Button>
            }
          />
          <SettingRow
            title={t('Two-factor authentication')}
            description={t('Add a second step when signing in.')}
            control={
              <Button variant="secondary" size="sm" onClick={save}>
                {t('Set up')}
              </Button>
            }
          />
          <SettingRow
            title={t('Sign out of all devices')}
            description={t('Ends every active session except this one.')}
            control={
              <Button variant="secondary" size="sm" onClick={() => setSignOutOpen(true)}>
                {t('Sign out')}
              </Button>
            }
          />
        </SettingGroup>
        )}

        {show('about') && (
        <SettingGroup
          icon={informationCircleOutline}
          title={t('About')}
          description={t('Version and support information.')}
        >
          <SettingRow title={t('Version')} description={t('1.0.0 — frontend preview')} control={null} />
          <SettingRow
            title={t('Data source')}
            description={t('Sample data. No records leave this device.')}
            control={null}
          />
          <SettingRow
            title={t('Help and support')}
            control={
              <Button variant="ghost" size="sm" icon={chevronForwardOutline} iconPosition="end" onClick={save}>
                {t('Open')}
              </Button>
            }
          />
        </SettingGroup>
        )}
      </div>
      </Bento>

      <ConfirmDialog
        isOpen={signOutOpen}
        title={t('Sign out of all devices?')}
        message="Every other signed-in device will need to sign in again. This device stays signed in."
        confirmLabel={t('Sign out')}
        onConfirm={() => {
          setSignOutOpen(false);
          showToast(t('Signed out of all other devices.'));
        }}
        onCancel={() => setSignOutOpen(false)}
      />
    </Workspace>
  );
}

export default Settings;
