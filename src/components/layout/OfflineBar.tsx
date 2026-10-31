import { IonIcon } from '@ionic/react';
import { alertCircleOutline, cloudOfflineOutline, cloudUploadOutline, hourglassOutline } from 'ionicons/icons';
import { useState } from 'react';
import { useOfflineStatus } from '../../services/offline/status';
import SyncSheet from './SyncSheet';
import './OfflineBar.css';
import { t } from '../../i18n';

/**
 * Slim line under the top bar that appears only when something is off:
 * no internet (showing what's saved on the phone), the free server waking
 * up, records waiting to be sent, or records the server refused. Tapping it
 * opens "Waiting to sync" when there are records to look at.
 */
export function OfflineBar() {
  const status = useOfflineStatus();
  const [open, setOpen] = useState(false);

  let tone: 'warn' | 'info' | 'danger' = 'info';
  let icon = cloudUploadOutline;
  let text = '';

  if (status.failed > 0) {
    tone = 'danger';
    icon = alertCircleOutline;
    text = status.failed === 1
      ? t('1 saved record needs your attention')
      : t('{{count}} saved records need your attention', { count: status.failed });
  } else if (!status.online) {
    tone = 'warn';
    icon = cloudOfflineOutline;
    text = status.pending > 0
      ? t('No internet. Showing what is saved on this phone · {{count}} waiting to send', { count: status.pending })
      : t('No internet. Showing what is saved on this phone.');
  } else if (status.waking) {
    icon = hourglassOutline;
    text = t('Connecting to the server… this can take up to a minute.');
  } else if (status.pending > 0 || status.syncing) {
    text = t('Sending {{count}} saved records…', { count: status.pending });
  }

  const hasRecords = status.pending > 0 || status.failed > 0;

  return (
    <>
      {text && (
        <button
          type="button"
          className={`bl-offbar bl-offbar--${tone}`}
          onClick={() => hasRecords && setOpen(true)}
          aria-live="polite"
          disabled={!hasRecords}
        >
          <IonIcon icon={icon} aria-hidden="true" />
          <span className="bl-offbar__text">{text}</span>
          {hasRecords && <span className="bl-offbar__link">{t('View')}</span>}
        </button>
      )}
      <SyncSheet isOpen={open} onClose={() => setOpen(false)} />
    </>
  );
}

export default OfflineBar;
