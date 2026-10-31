import { Browser } from '@capacitor/browser';
import { useCallback, useEffect, useState } from 'react';
import Button from '../common/Button';
import { Modal } from '../common/Modal';
import { useToast } from '../common/ToastProvider';
import { APP_VERSION, checkForUpdate, isDesktopApp, isSnoozed, snoozeUpdate, type UpdateInfo } from '../../lib/updates';
import { t } from '../../i18n';

/** Settings → "Check for updates" fires this; the prompt answers. */
export const CHECK_UPDATE_EVENT = 'bl-check-update';

interface DesktopBridge {
  onUpdate?: (cb: (info: { state: string; version: string; notes?: string }) => void) => () => void;
  installUpdate?: () => Promise<void>;
  checkForUpdates?: () => Promise<string | null>;
}

function desktopBridge(): DesktopBridge | undefined {
  return (window as { bantayledgerDesktop?: DesktopBridge }).bantayledgerDesktop;
}

/**
 * "A new version is available" sheet for the installed apps.
 * - Android: checks the latest release; "Update now" downloads the new APK in
 *   the phone's browser (installing it keeps all data).
 * - Windows: the app downloads updates by itself; this offers "Restart to update".
 * The website never shows it (it is always the newest version).
 */
export function UpdatePrompt() {
  const { showToast } = useToast();
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [readyOnDesktop, setReadyOnDesktop] = useState(false);

  const runCheck = useCallback(
    async (manual: boolean) => {
      if (manual && !navigator.onLine) {
        showToast(t('Connect to the internet to check for updates.'));
        return;
      }
      if (isDesktopApp()) {
        if (!manual) return;
        const next = await desktopBridge()?.checkForUpdates?.();
        showToast(next ? t('Downloading version {{version}}… You will be asked to restart when it is ready.', { version: next }) : t('You have the latest version ({{version}}).', { version: APP_VERSION }));
        return;
      }
      const found = await checkForUpdate(manual);
      if (found && (manual || !isSnoozed(found.version))) setUpdate(found);
      else if (manual) showToast(t('You have the latest version ({{version}}).', { version: APP_VERSION }));
    },
    [showToast],
  );

  // Shortly after launch, whenever the app comes back to the screen, and on request.
  useEffect(() => {
    const first = window.setTimeout(() => void runCheck(false), 3000);
    const onVisible = () => {
      if (document.visibilityState === 'visible') void runCheck(false);
    };
    const onManual = () => void runCheck(true);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener(CHECK_UPDATE_EVENT, onManual);
    return () => {
      window.clearTimeout(first);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener(CHECK_UPDATE_EVENT, onManual);
    };
  }, [runCheck]);

  // Windows: the updater says when the new version has downloaded.
  useEffect(() => {
    const off = desktopBridge()?.onUpdate?.((info) => {
      if (info.state !== 'ready') return;
      setReadyOnDesktop(true);
      setUpdate({ version: info.version, notes: info.notes ?? '', downloadUrl: '' });
    });
    return () => off?.();
  }, []);

  if (!update) return null;

  const later = () => {
    snoozeUpdate(update.version);
    setUpdate(null);
  };

  const updateNow = async () => {
    if (readyOnDesktop) {
      await desktopBridge()?.installUpdate?.();
      return;
    }
    await Browser.open({ url: update.downloadUrl });
    showToast(t('When the download finishes, open it and tap Install. Your records stay as they are.'));
    setUpdate(null);
  };

  return (
    <Modal
      isOpen
      onClose={later}
      title={readyOnDesktop ? t('Update ready') : t('New version available')}
      description={t('Version {{next}} · you have {{current}}', { next: update.version, current: APP_VERSION })}
      icon="form"
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={later}>
            {t('Later')}
          </Button>
          <Button variant="primary" onClick={() => void updateNow()}>
            {readyOnDesktop ? t('Restart to update') : t('Update now')}
          </Button>
        </>
      }
    >
      <p className="bl-support">
        {readyOnDesktop
          ? t('The new version has downloaded. Restart BantayLedger to start using it. Your records stay as they are.')
          : t('Download the new version and install it over this one. Your records stay as they are.')}
      </p>
      {update.notes && (
        <p className="bl-caption" style={{ marginTop: 12, whiteSpace: 'pre-line' }}>
          {update.notes}
        </p>
      )}
    </Modal>
  );
}

export default UpdatePrompt;
