import { IonIcon } from '@ionic/react';
import {
  businessOutline,
  callOutline,
  cameraOutline,
  chevronForwardOutline,
  createOutline,
  locationOutline,
  logOutOutline,
  mailOutline,
  shieldCheckmarkOutline,
} from 'ionicons/icons';
import { useState } from 'react';
import { Link, useHistory } from 'react-router-dom';
import Button from '../components/common/Button';
import { SelectField, TextAreaField, TextField } from '../components/common/Field';
import { Modal } from '../components/common/Modal';
import { ErrorState, LoadingState, SkeletonCard } from '../components/common/States';
import { Badge } from '../components/common/StatusBadge';
import { useToast } from '../components/common/ToastProvider';
import PageHeader from '../components/layout/PageHeader';
import { Card, Section } from '../components/layout/Section';
import { Bento, Workspace } from '../components/layout/Workspace';
import { moreNav } from '../components/layout/navItems';
import { useAuth } from '../context/AuthContext';
import { toUserMessage } from '../lib/errors';
import { alertError, alertSuccess, confirmLogout } from '../lib/swal';
import { useAsyncData } from '../hooks/useAsyncData';
import { dataService, usesLiveData } from '../services/dataService';
import { businessService, profileService } from '../services/api';
import './Profile.css';
import { t } from '../i18n';

export function Profile() {
  const { showToast } = useToast();
  const history = useHistory();
  const { activeBusiness, user, signOut, refresh } = useAuth();
  const { data, loading, error, reload } = useAsyncData(
    () => dataService.getProfile(),
    [activeBusiness?.id],
  );
  const [editOpen, setEditOpen] = useState(false);

  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    businessName: '',
    businessType: '',
    address: '',
  });
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  /** Fills the form from what is on screen, then opens the dialog. */
  const openEdit = () => {
    if (data) {
      setForm({
        fullName: data.ownerName,
        email: data.email,
        phone: data.phone,
        businessName: data.businessName,
        businessType: data.businessType,
        address: data.address,
      });
    }
    setFormError(null);
    setEditOpen(true);
  };

  const handleSave = async () => {
    setFormError(null);

    if (!form.fullName.trim()) {
      setFormError(t('Enter your name.'));
      return;
    }

    if (!usesLiveData() || !user) {
      setFormError(t('Saving needs an active business. Please sign in again.'));
      return;
    }

    setSaving(true);
    try {
      // The email address belongs to the auth account and is not editable here.
      await profileService.update(user.id, {
        fullName: form.fullName,
        phone: form.phone,
      });

      if (activeBusiness) {
        await businessService.update(activeBusiness.id, {
          name: form.businessName,
          businessType: form.businessType,
          address: form.address,
        });
      }

      setEditOpen(false);
      reload();
      // AuthContext keeps its own cached copy of profile/business, which is
      // what the sidebar and mobile header actually display — without this,
      // an edit looks like it silently did nothing everywhere but this page.
      await refresh();
      await alertSuccess(t('Profile updated'));
    } catch (err) {
      setFormError(toUserMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    if (!(await confirmLogout())) return;

    try {
      await signOut();
      history.replace('/login');
    } catch (err) {
      await alertError(t('Could not sign you out'), toUserMessage(err));
    }
  };

  if (loading) {
    return (
      <LoadingState label={t('Loading your profile')}>
        <SkeletonCard lines={3} height={200} />
      </LoadingState>
    );
  }

  if (error || !data) {
    return (
      <ErrorState
        title={t('Unable to load your profile')}
        description={t('We could not load your account details. Please try again.')}
        onRetry={reload}
      />
    );
  }

  return (
    <Workspace>
      <PageHeader
        title={t('Profile')}
        description={t('Your account details and the business this app is tracking.')}
        actions={
          <Button variant="primary" icon={createOutline} onClick={openEdit}>
            {t('Edit Profile')}
          </Button>
        }
      />

      {/* ---- Identity card --------------------------------------------------- */}
      <Card className="bl-prof__hero">
        <div className="bl-prof__avatar-wrap">
          <span className="bl-avatar bl-avatar--lg bl-avatar--solid" aria-hidden="true">
            {data.initials}
          </span>
          <button
            type="button"
            className="bl-prof__avatar-btn"
            onClick={() => showToast(t('Photo upload is not available in this preview.'), 'info')}
            aria-label={t('Change profile photo')}
          >
            <IonIcon icon={cameraOutline} aria-hidden="true" />
          </button>
        </div>

        <div className="bl-prof__identity">
          <h2 className="bl-prof__name">{data.ownerName}</h2>
          <p className="bl-support">{data.role}</p>
          <div className="bl-row bl-prof__badges">
            <Badge tone="brand" icon={businessOutline}>
              {data.businessName}
            </Badge>
            <Badge tone="neutral">{t('Member since {{memberSince}}', { memberSince: data.memberSince })}</Badge>
          </div>
        </div>
      </Card>

      {/* ---- Details --------------------------------------------------------- */}
      <Bento rows="auto" className="bl-prof__grid">
          <Card as="h2" className="bl-span-4" title={t('Profile information')}>
            <dl className="bl-prof__list">
              <div>
                <dt>
                  <IonIcon icon={mailOutline} aria-hidden="true" />
                  {t('Email')}
                </dt>
                <dd>{data.email}</dd>
              </div>
              <div>
                <dt>
                  <IonIcon icon={callOutline} aria-hidden="true" />
                  {t('Phone')}
                </dt>
                <dd>{data.phone}</dd>
              </div>
              <div>
                <dt>
                  <IonIcon icon={shieldCheckmarkOutline} aria-hidden="true" />
                  {t('Role')}
                </dt>
                <dd>{data.role}</dd>
              </div>
            </dl>
          </Card>

          <Card as="h2" className="bl-span-4" title={t('Business information')}>
            <dl className="bl-prof__list">
              <div>
                <dt>
                  <IonIcon icon={businessOutline} aria-hidden="true" />
                  {t('Business name')}
                </dt>
                <dd>{data.businessName}</dd>
              </div>
              <div>
                <dt>
                  <IonIcon icon={businessOutline} aria-hidden="true" />
                  {t('Business type')}
                </dt>
                <dd>{data.businessType}</dd>
              </div>
              <div>
                <dt>
                  <IonIcon icon={locationOutline} aria-hidden="true" />
                  {t('Address')}
                </dt>
                <dd>{data.address}</dd>
              </div>
            </dl>
          </Card>

          <Card as="h2" padding="none" className="bl-span-4 bl-prof__account" title={t('Account')}>
          <ul className="bl-prof__nav">
            <li>
              <Link to="/settings" className="bl-prof__nav-item">
                <IonIcon icon={shieldCheckmarkOutline} className="bl-prof__nav-icon" aria-hidden="true" />
                <span>{t('Settings and security')}</span>
                <IonIcon icon={chevronForwardOutline} className="bl-prof__nav-chev" aria-hidden="true" />
              </Link>
            </li>
            <li>
              <button
                type="button"
                className="bl-prof__nav-item bl-prof__nav-item--danger"
                onClick={() => void handleLogout()}
              >
                <IonIcon icon={logOutOutline} className="bl-prof__nav-icon" aria-hidden="true" />
                <span>{t('Logout')}</span>
                <IonIcon icon={chevronForwardOutline} className="bl-prof__nav-chev" aria-hidden="true" />
              </button>
            </li>
          </ul>
          </Card>
      </Bento>

      {/* ---- Mobile-only navigation to the rest of the app ------------------- */}
      <Section
        title={t('More')}
        description={t('Pages not shown in the bottom bar')}
        className="bl-only-mobile"
      >
        <Card padding="none">
          <ul className="bl-prof__nav">
            {moreNav.map((item) => (
              <li key={item.href}>
                <Link to={item.href} className="bl-prof__nav-item">
                  <IonIcon icon={item.icon} className="bl-prof__nav-icon" aria-hidden="true" />
                  <span>{item.label}</span>
                  <IonIcon icon={chevronForwardOutline} className="bl-prof__nav-chev" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      </Section>

      <Modal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
        title={t('Edit Profile')}
        icon="profile"
        description={t('Update your details and business information.')}
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)} disabled={saving}>
              {t('Cancel')}
            </Button>
            <Button variant="primary" onClick={() => void handleSave()} loading={saving}>
              {saving ? t('Saving') : t('Save Changes')}
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

          <fieldset className="bl-fieldset bl-form-grid__full">
            <legend className="bl-fieldset__legend">{t('Your details')}</legend>
            <div className="bl-form-grid bl-form-grid--2">
              <TextField
                label={t('Full name')}
                required
                className="bl-form-grid__full"
                value={form.fullName}
                onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
              />
              <TextField
                label={t('Email')}
                type="email"
                inputMode="email"
                value={form.email}
                disabled
                hint={t('Changing your sign-in email is not available yet.')}
              />
              <TextField
                label={t('Phone')}
                type="tel"
                inputMode="tel"
                value={form.phone}
                onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
              />
            </div>
          </fieldset>

          <fieldset className="bl-fieldset bl-form-grid__full">
            <legend className="bl-fieldset__legend">{t('Business')}</legend>
            <div className="bl-form-grid bl-form-grid--2">
              <TextField
                label={t('Business name')}
                required
                className="bl-form-grid__full"
                value={form.businessName}
                onChange={(e) => setForm((f) => ({ ...f, businessName: e.target.value }))}
              />
              <SelectField
                label={t('Business type')}
                className="bl-form-grid__full"
                value={form.businessType}
                onChange={(e) => setForm((f) => ({ ...f, businessType: e.target.value }))}
                options={[
                  { value: 'Sari-sari Store / Mini Grocery', label: t('Sari-sari Store / Mini Grocery') },
                  { value: 'Grocery', label: t('Grocery') },
                  { value: 'Bakery', label: t('Bakery') },
                  { value: 'Carinderia', label: t('Carinderia') },
                  { value: 'Hardware', label: t('Hardware') },
                ]}
              />
              <TextAreaField
                label={t('Address')}
                className="bl-form-grid__full"
                value={form.address}
                onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
              />
            </div>
          </fieldset>
        </form>
      </Modal>
    </Workspace>
  );
}

export default Profile;
