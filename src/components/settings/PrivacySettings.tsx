import { IonIcon } from '@ionic/react';
import { shieldCheckmarkOutline } from 'ionicons/icons';
import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { t } from '../../i18n';
import { toUserMessage } from '../../lib/errors';
import { api } from '../../services/api/client';
import Button from '../common/Button';
import { TextField } from '../common/Field';
import Modal from '../common/Modal';
import { useToast } from '../common/ToastProvider';
import { Card } from '../layout/Section';

/** Saves a text file the same way report exports are saved. */
function saveTextFile(fileName: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Settings → Your data: the rights promised in the Privacy Policy. Anyone can
 * download their data or delete their own account, without having to ask.
 */
export function PrivacySettings() {
  const { businesses, deleteAccount, user } = useAuth();
  const { showToast } = useToast();
  const [downloading, setDownloading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Stores this person owns go with the account; other stores keep their records.
  const ownsStore = businesses.some((b) => b.owner_user_id === user?.id);

  const download = async () => {
    setDownloading(true);
    try {
      const data = await api.get<unknown>('/account/export');
      saveTextFile(`bantayledger-my-data-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 2));
      showToast(t('Your data has been downloaded.'));
    } catch (err) {
      showToast(toUserMessage(err, t('Could not download your data. Please try again.')), 'error');
    } finally {
      setDownloading(false);
    }
  };

  const closeConfirm = () => {
    if (deleting) return;
    setConfirming(false);
    setPassword('');
    setError(null);
  };

  const handleDelete = async (e: FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError(t('Enter your password.'));
      return;
    }
    setError(null);
    setDeleting(true);
    try {
      // On success this signs out, and the app leaves this page.
      await deleteAccount(password);
      showToast(t('Your account has been deleted.'));
    } catch (err) {
      setError(toUserMessage(err, t('Could not delete your account. Please try again.')));
      setDeleting(false);
    }
  };

  return (
    <Card className="bl-set__group" padding="none">
      <header className="bl-set__group-head">
        <span className="bl-set__group-icon" aria-hidden="true">
          <IonIcon icon={shieldCheckmarkOutline} />
        </span>
        <div>
          <h2 className="bl-card-title">{t('Your data')}</h2>
          <p className="bl-caption">{t('Download or delete your information, and read our policies.')}</p>
        </div>
      </header>

      <div className="bl-set__rows">
        <div className="bl-set__row">
          <div className="bl-set__row-text">
            <span className="bl-set__row-title">{t('Download my data')}</span>
            <span className="bl-caption">
              {ownsStore
                ? t('A file with your account details and all the records of the stores you own.')
                : t('A file with your account details. The owner keeps the store\'s records.')}
            </span>
          </div>
          <div className="bl-set__row-control">
            <Button variant="secondary" size="sm" loading={downloading} onClick={() => void download()}>
              {t('Download')}
            </Button>
          </div>
        </div>

        <div className="bl-set__row">
          <div className="bl-set__row-text">
            <span className="bl-set__row-title">{t('Policies')}</span>
            <span className="bl-caption bl-set__links">
              <Link to="/privacy">{t('Privacy Policy')}</Link>
              <Link to="/terms">{t('Terms of Service')}</Link>
              <Link to="/refunds">{t('Refund Policy')}</Link>
              <Link to="/cookies">{t('Cookie Policy')}</Link>
            </span>
          </div>
        </div>

        <div className="bl-set__row">
          <div className="bl-set__row-text">
            <span className="bl-set__row-title">{t('Delete my account')}</span>
            <span className="bl-caption">{t('This cannot be undone. We suggest downloading your data first.')}</span>
          </div>
          <div className="bl-set__row-control">
            <Button variant="danger" size="sm" onClick={() => setConfirming(true)}>
              {t('Delete account')}
            </Button>
          </div>
        </div>
      </div>

      <Modal
        isOpen={confirming}
        onClose={closeConfirm}
        title={t('Delete your account?')}
        size="sm"
        icon="warning"
        tone="danger"
        footer={
          <>
            <Button variant="secondary" onClick={closeConfirm} disabled={deleting}>
              {t('Cancel')}
            </Button>
            <Button variant="danger" type="submit" form="bl-delete-account" loading={deleting}>
              {t('Delete account')}
            </Button>
          </>
        }
      >
        <form id="bl-delete-account" className="bl-form-grid" onSubmit={(e) => void handleDelete(e)} noValidate>
          <p className="bl-support">
            {ownsStore
              ? t('This permanently deletes your account, the stores you own and all their records, photos and staff logins. It cannot be undone.')
              : t('This permanently deletes your account. The records you entered stay with the store, without your name.')}
          </p>
          <TextField
            label={t('Password')}
            type="password"
            autoComplete="current-password"
            value={password}
            error={error ?? undefined}
            required
            onChange={(e) => setPassword(e.target.value)}
          />
        </form>
      </Modal>
    </Card>
  );
}

export default PrivacySettings;
