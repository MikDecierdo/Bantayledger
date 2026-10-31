/**
 * Fetch wrapper for the Laravel backend (laravel-server/). Locally it runs
 * under XAMPP; online it runs on Render (VITE_API_URL in .env.production).
 *
 * It also makes the app usable offline:
 * - every successful GET is saved on the phone, and when the server can't be
 *   reached the saved copy is shown instead (see services/offline/);
 * - `postOrQueue` saves a sale, expense, purchase or spoiled item on the
 *   phone when there is no internet, to be sent later by the sync loop;
 * - the free Render server sleeps when idle, so a slow first request flags
 *   "waking up" for the offline bar instead of looking broken.
 */

import { currentLanguage } from '../../i18n';
import { t } from '../../i18n';
import { addToOutbox, newOutboxId, type OutboxKind } from '../offline/outbox';
import { storeClear, storeEntries, storeGet, storePut } from '../offline/offlineStore';
import { setOfflineStatus } from '../offline/status';

const DEFAULT_BASE_URL = 'http://localhost/bantayledger-api/public/api';

export const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined) ?? DEFAULT_BASE_URL;

const TOKEN_KEY = 'bantayledger.apiToken';

export function getToken(): string | null {
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null): void {
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else {
    window.localStorage.removeItem(TOKEN_KEY);
    // Saved copies belong to the person who was signed in.
    void storeClear('cache');
  }
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** The server could not be reached at all (no internet, or it timed out). */
export class OfflineError extends ApiError {
  constructor(message = t("You're offline and this hasn't been saved on this phone yet. Connect to the internet and try again.")) {
    super(0, message);
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown | FormData;
  query?: Record<string, string | number | undefined>;
  headers?: Record<string, string>;
}

/** Long enough for the free server to wake from sleep (up to about a minute). */
const WAKE_TIMEOUT_MS = 75_000;
/** With a saved copy to fall back on, don't keep the person waiting as long. */
const CACHED_TIMEOUT_MS = 15_000;
const WAKING_AFTER_MS = 4_000;

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(API_BASE_URL + path);
  if (query) {
    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) url.searchParams.set(key, String(value));
    }
  }
  return url.toString();
}

function cacheKey(path: string, query?: RequestOptions['query']): string {
  const owner = (getToken() ?? 'anon').split('|')[0];
  const qs = query
    ? Object.entries(query)
        .filter(([, v]) => v !== undefined)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([k, v]) => `${k}=${v}`)
        .join('&')
    : '';
  return `${owner}:${path}${qs ? `?${qs}` : ''}`;
}

function isNetworkFailure(err: unknown): boolean {
  return err instanceof TypeError || (err instanceof DOMException && err.name === 'AbortError');
}

interface CachedReply {
  data: unknown;
  savedAt: string;
}

/** Core request function. Throws ApiError on any non-2xx response. */
export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const token = getToken();
  const method = options.method ?? 'GET';
  const isFormData = options.body instanceof FormData;
  const isGet = method === 'GET';

  const key = isGet ? cacheKey(path, options.query) : '';
  const cached = isGet ? await storeGet<CachedReply>('cache', key) : undefined;

  const answerFromSaved = (): T => {
    setOfflineStatus({ showingSaved: true });
    return cached!.data as T;
  };

  // No network at all: answer from the saved copy straight away.
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    setOfflineStatus({ online: false });
    if (cached) return answerFromSaved();
    throw new OfflineError();
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), cached ? CACHED_TIMEOUT_MS : WAKE_TIMEOUT_MS);
  const wakingTimer = window.setTimeout(() => setOfflineStatus({ waking: true }), WAKING_AFTER_MS);

  let res: Response;
  try {
    res = await fetch(buildUrl(path, options.query), {
      method,
      signal: controller.signal,
      headers: {
        // The browser sets the multipart boundary itself — an explicit
        // Content-Type here would be missing it and break the upload.
        ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
        Accept: 'application/json',
        'Accept-Language': currentLanguage(),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
      body: isFormData
        ? (options.body as FormData)
        : options.body !== undefined
          ? JSON.stringify(options.body)
          : undefined,
    });
  } catch (err) {
    if (!isNetworkFailure(err)) throw err;
    setOfflineStatus({ online: false });
    if (cached) return answerFromSaved();
    throw new OfflineError();
  } finally {
    window.clearTimeout(timeout);
    window.clearTimeout(wakingTimer);
    setOfflineStatus({ waking: false });
  }

  setOfflineStatus({ online: true });

  if (res.status === 204) {
    return undefined as T;
  }

  const isJson = res.headers.get('content-type')?.includes('application/json');
  const data = isJson ? await res.json() : undefined;

  if (!res.ok) {
    const message =
      (data && typeof data === 'object' && 'message' in data && String(data.message)) ||
      t('Request failed with status {{status}}.', { status: res.status });
    throw new ApiError(res.status, message);
  }

  if (isGet) {
    setOfflineStatus({ showingSaved: false });
    void storePut('cache', key, { data, savedAt: new Date().toISOString() } satisfies CachedReply);
  }

  return data as T;
}

export const api = {
  get: <T>(path: string, query?: RequestOptions['query']) => apiFetch<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'POST', body }),
  postForm: <T>(path: string, formData: FormData) => apiFetch<T>(path, { method: 'POST', body: formData }),
  patch: <T>(path: string, body?: unknown) => apiFetch<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => apiFetch<T>(path, { method: 'DELETE' }),
};

/* ---- Recording offline ------------------------------------------------------ */

export interface QueueMeta {
  kind: OutboxKind;
  /** Short line for the "Waiting to sync" list. */
  summary: string;
  businessId: string;
  /** Stock that leaves the shelf (sales, spoiled items), to keep the saved product list honest. */
  stockOut?: { productId: string; quantity: number }[];
}

/** `queued: true` means it was saved on this phone and will be sent later. */
export type SaveResult<T> = { queued: false; data: T } | { queued: true };

/**
 * Sends a record now, or — with no internet — saves it on the phone for the
 * sync loop. Either way it carries an Idempotency-Key, so a reply lost on a
 * bad connection never turns into a double sale when it is sent again.
 */
export async function postOrQueue<T>(path: string, body: Record<string, unknown>, meta: QueueMeta): Promise<SaveResult<T>> {
  const id = newOutboxId();

  const queue = async (): Promise<SaveResult<T>> => {
    await addToOutbox({
      id,
      kind: meta.kind,
      path,
      // An offline sale keeps the time it was actually made.
      body: meta.kind === 'sale' ? { ...body, recordedAt: new Date().toISOString() } : body,
      summary: meta.summary,
      createdAt: new Date().toISOString(),
      status: 'pending',
    });
    if (meta.stockOut?.length) await lowerSavedStock(meta.businessId, meta.stockOut);
    return { queued: true };
  };

  if (typeof navigator !== 'undefined' && !navigator.onLine) return queue();

  try {
    const data = await apiFetch<T>(path, { method: 'POST', body, headers: { 'Idempotency-Key': id } });
    return { queued: false, data };
  } catch (err) {
    if (err instanceof OfflineError) return queue();
    throw err;
  }
}

/** Lowers stock in the saved product lists for records still waiting to sync. */
async function lowerSavedStock(businessId: string, lines: { productId: string; quantity: number }[]): Promise<void> {
  const byProduct = new Map<string, number>();
  for (const l of lines) byProduct.set(l.productId, (byProduct.get(l.productId) ?? 0) + Number(l.quantity));

  const adjust = (p: unknown) => {
    if (!p || typeof p !== 'object') return p;
    const row = p as { id?: string; currentStock?: number };
    const qty = row.id ? byProduct.get(row.id) : undefined;
    return qty && typeof row.currentStock === 'number' ? { ...row, currentStock: Math.max(0, row.currentStock - qty) } : p;
  };

  for (const [key, entry] of await storeEntries<CachedReply>('cache')) {
    if (!key.includes(`/businesses/${businessId}/products`)) continue;
    const data = Array.isArray(entry.data) ? entry.data.map(adjust) : adjust(entry.data);
    await storePut('cache', key, { ...entry, data });
  }
}
