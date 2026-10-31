import { ApiError, OfflineError, apiFetch } from '../api/client';
import { listOutbox, refreshOutboxCounts, removeFromOutbox, updateOutboxItem } from './outbox';
import { announceDataChanged, getOfflineStatus, setOfflineStatus } from './status';

/**
 * Sends records saved on the phone while offline, oldest first.
 *
 * - success (or the server saying it already has it): removed from the phone
 * - the server refuses it (not enough stock, over the profit limit, duplicate
 *   GCash number…): kept as "needs attention" with the server's reason
 * - still no connection, or signed out: stop and try again later
 */
export async function syncOutbox(): Promise<void> {
  const status = getOfflineStatus();
  if (status.syncing) return;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return;

  const items = (await listOutbox()).filter((i) => i.status === 'pending');
  if (items.length === 0) return;

  setOfflineStatus({ syncing: true });
  let sent = 0;
  try {
    for (const item of items) {
      try {
        await apiFetch(item.path, { method: 'POST', body: item.body, headers: { 'Idempotency-Key': item.id } });
        await removeFromOutbox(item.id);
        sent += 1;
      } catch (err) {
        if (err instanceof OfflineError) break;
        if (err instanceof ApiError) {
          // 401: signed out; 409 "still being saved": the server is mid-way. Both: retry later.
          if (err.status === 401 || err.status === 409 || err.status >= 500) break;
          await updateOutboxItem(item.id, { status: 'failed', error: err.message });
          continue;
        }
        break;
      }
    }
  } finally {
    setOfflineStatus({ syncing: false });
    if (sent > 0) announceDataChanged();
  }
}

/** Puts a refused record back in line (after the owner fixed the cause) and tries now. */
export async function retryOutboxItem(id: string): Promise<void> {
  await updateOutboxItem(id, { status: 'pending', error: undefined });
  await syncOutbox();
}

let started = false;

/** Starts syncing: now, whenever the connection returns, and every 30s while records wait. */
export function startOfflineSync(): void {
  if (started) return;
  started = true;

  void refreshOutboxCounts().then(syncOutbox);

  window.addEventListener('online', () => {
    setOfflineStatus({ online: true });
    void syncOutbox();
    announceDataChanged();
  });
  window.addEventListener('offline', () => setOfflineStatus({ online: false }));

  window.setInterval(() => {
    if (getOfflineStatus().pending > 0) void syncOutbox();
  }, 30_000);
}
