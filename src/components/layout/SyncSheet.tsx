import { useEffect, useState } from 'react';
import Button from '../common/Button';
import { ConfirmDialog, Modal } from '../common/Modal';
import { listOutbox, removeFromOutbox, type OutboxItem } from '../../services/offline/outbox';
import { useOfflineStatus } from '../../services/offline/status';
import { retryOutboxItem, syncOutbox } from '../../services/offline/sync';
import { relativeTime } from '../../utils/format';
import './OfflineBar.css';
import { t } from '../../i18n';

interface SyncSheetProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Records saved on this phone while offline: waiting ones go out by
 * themselves; ones the server refused show its reason with Retry / Delete.
 */
export function SyncSheet({ isOpen, onClose }: SyncSheetProps) {
  const status = useOfflineStatus();
  const [items, setItems] = useState<OutboxItem[]>([]);
  const [deleting, setDeleting] = useState<OutboxItem | null>(null);

  // Re-read the list whenever the counts move (a record synced, failed, was added).
  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    void listOutbox().then((list) => {
      if (!cancelled) setItems(list);
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, status.pending, status.failed]);

  return (
    <>
      <Modal
        isOpen={isOpen}
        onClose={onClose}
        title={t('Waiting to sync')}
        description={t('Records saved on this phone while there was no internet.')}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={onClose}>
              {t('Close')}
            </Button>
            <Button
              variant="primary"
              onClick={() => void syncOutbox()}
              loading={status.syncing}
              disabled={!status.online || status.pending === 0}
            >
              {status.syncing ? t('Sending') : t('Send now')}
            </Button>
          </>
        }
      >
        {items.length === 0 ? (
          <p className="bl-support">{t('Everything is synced.')}</p>
        ) : (
          <ul className="bl-sync__list">
            {items.map((item) => (
              <li key={item.id} className={`bl-sync__item ${item.status === 'failed' ? 'bl-sync__item--failed' : ''}`}>
                <div className="bl-sync__row">
                  <span className="bl-sync__summary">{item.summary}</span>
                  <span className="bl-caption">{relativeTime(item.createdAt)}</span>
                </div>
                {item.status === 'failed' ? (
                  <>
                    <p className="bl-sync__error">{item.error}</p>
                    <div className="bl-sync__actions">
                      <Button variant="ghost" size="sm" onClick={() => setDeleting(item)}>
                        {t('Delete')}
                      </Button>
                      <Button variant="secondary" size="sm" disabled={!status.online} onClick={() => void retryOutboxItem(item.id)}>
                        {t('Retry')}
                      </Button>
                    </div>
                  </>
                ) : (
                  <span className="bl-caption">{t('Waiting to send')}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={deleting !== null}
        title={t('Delete this record?')}
        message={t('It was never saved to your business records. Deleting it removes it from this phone for good.')}
        confirmLabel={t('Delete')}
        onConfirm={() => {
          if (deleting) void removeFromOutbox(deleting.id);
          setDeleting(null);
        }}
        onCancel={() => setDeleting(null)}
      />
    </>
  );
}

export default SyncSheet;
