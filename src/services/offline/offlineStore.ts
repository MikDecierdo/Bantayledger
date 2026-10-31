/**
 * On-device storage for offline use (IndexedDB, no extra library).
 *
 * - `cache`: the last good reply of every GET (per signed-in token), so pages
 *   still show data when there is no internet.
 * - `outbox`: sales, expenses, purchases and spoiled items recorded while
 *   offline, waiting to be sent (see outbox.ts / sync.ts).
 *
 * If IndexedDB is unavailable (private mode, very old WebView) everything
 * falls back to memory: the app keeps working, it just forgets on reload.
 */

const DB_NAME = 'bantayledger-offline';
const DB_VERSION = 1;
export type StoreName = 'cache' | 'outbox';

let dbPromise: Promise<IDBDatabase | null> | null = null;
const memory: Record<StoreName, Map<string, unknown>> = { cache: new Map(), outbox: new Map() };

function openDb(): Promise<IDBDatabase | null> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('cache')) db.createObjectStore('cache');
        if (!db.objectStoreNames.contains('outbox')) db.createObjectStore('outbox');
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

function run<T>(store: StoreName, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | undefined> {
  return openDb().then(
    (db) =>
      new Promise<T | undefined>((resolve) => {
        if (!db) {
          resolve(undefined);
          return;
        }
        try {
          const req = fn(db.transaction(store, mode).objectStore(store));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => resolve(undefined);
        } catch {
          resolve(undefined);
        }
      }),
  );
}

export async function storeGet<T>(store: StoreName, key: string): Promise<T | undefined> {
  const db = await openDb();
  if (!db) return memory[store].get(key) as T | undefined;
  return run<T>(store, 'readonly', (s) => s.get(key) as IDBRequest<T>);
}

export async function storePut(store: StoreName, key: string, value: unknown): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory[store].set(key, value);
    return;
  }
  await run(store, 'readwrite', (s) => s.put(value, key));
}

export async function storeDelete(store: StoreName, key: string): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory[store].delete(key);
    return;
  }
  await run(store, 'readwrite', (s) => s.delete(key));
}

/** Every [key, value] pair in a store. */
export async function storeEntries<T>(store: StoreName): Promise<[string, T][]> {
  const db = await openDb();
  if (!db) return [...memory[store].entries()] as [string, T][];
  const [keys, values] = await Promise.all([
    run<IDBValidKey[]>(store, 'readonly', (s) => s.getAllKeys()),
    run<T[]>(store, 'readonly', (s) => s.getAll() as IDBRequest<T[]>),
  ]);
  return (keys ?? []).map((k, i) => [String(k), (values ?? [])[i] as T]);
}

export async function storeClear(store: StoreName): Promise<void> {
  const db = await openDb();
  if (!db) {
    memory[store].clear();
    return;
  }
  await run(store, 'readwrite', (s) => s.clear());
}
