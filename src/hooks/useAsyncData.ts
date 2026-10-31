import { useCallback, useEffect, useRef, useState } from 'react';
import { t } from '../i18n';
import { DATA_CHANGED_EVENT } from '../services/offline/status';

export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: Error | null;
  reload: () => void;
  /** Re-reads without showing the loading state; the current data stays on screen. */
  refresh: () => Promise<void>;
}

/**
 * Runs an async loader and tracks loading/error state so pages can render
 * skeletons and error states consistently. `deps` behaves like useEffect deps.
 */
export function useAsyncData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const [nonce, setNonce] = useState(0);
  const mounted = useRef(true);
  const latestLoader = useRef(loader);

  useEffect(() => {
    latestLoader.current = loader;
  });

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    loader()
      .then((result) => {
        if (cancelled || !mounted.current) return;
        setData(result);
      })
      .catch((err: unknown) => {
        if (cancelled || !mounted.current) return;
        setError(err instanceof Error ? err : new Error(t('Something went wrong')));
      })
      .finally(() => {
        if (cancelled || !mounted.current) return;
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);

  const refresh = useCallback(async () => {
    try {
      const result = await latestLoader.current();
      if (mounted.current) setData(result);
    } catch {
      // Keep showing what is already there.
    }
  }, []);

  // Records saved offline just reached the server (or the connection came
  // back): fetch fresh numbers.
  useEffect(() => {
    window.addEventListener(DATA_CHANGED_EVENT, reload);
    return () => window.removeEventListener(DATA_CHANGED_EVENT, reload);
  }, [reload]);

  return { data, loading, error, reload, refresh };
}
