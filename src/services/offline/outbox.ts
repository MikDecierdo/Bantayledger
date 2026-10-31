import { setOfflineStatus } from './status';
import { storeDelete, storeEntries, storeGet, storePut } from './offlineStore';

/** What can be recorded offline. Everything else needs the internet. */
export type OutboxKind = 'sale' | 'expense' | 'purchase' | 'waste';

export interface OutboxItem {
  /** Also the Idempotency-Key, so a repeat send never records twice. */
  id: string;
  kind: OutboxKind;
  /** API path, e.g. /businesses/{id}/sales */
  path: string;
  body: Record<string, unknown>;
  /** Short line for the "Waiting to sync" list, e.g. "Sale · ₱120". */
  summary: string;
  createdAt: string;
  status: 'pending' | 'failed';
  /** The server's reason, when it refused the record. */
  error?: string;
}

export function newOutboxId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID().replace(/-/g, '');
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 12)}`;
}

/** Oldest first: records are sent in the order they were made. */
export async function listOutbox(): Promise<OutboxItem[]> {
  const entries = await storeEntries<OutboxItem>('outbox');
  return entries.map(([, item]) => item).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function refreshOutboxCounts(): Promise<void> {
  const items = await listOutbox();
  setOfflineStatus({
    pending: items.filter((i) => i.status === 'pending').length,
    failed: items.filter((i) => i.status === 'failed').length,
  });
}

export async function addToOutbox(item: OutboxItem): Promise<void> {
  await storePut('outbox', item.id, item);
  await refreshOutboxCounts();
}

export async function updateOutboxItem(id: string, patch: Partial<OutboxItem>): Promise<void> {
  const item = await storeGet<OutboxItem>('outbox', id);
  if (!item) return;
  await storePut('outbox', id, { ...item, ...patch });
  await refreshOutboxCounts();
}

export async function removeFromOutbox(id: string): Promise<void> {
  await storeDelete('outbox', id);
  await refreshOutboxCounts();
}
