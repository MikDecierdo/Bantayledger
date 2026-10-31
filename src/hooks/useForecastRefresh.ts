import { useEffect, useRef, useState } from 'react';
import { dataService } from '../services/dataService';

/**
 * Brings forecasts and insights up to date in the background, once per
 * business. The page shows what is already saved straight away; when the
 * server actually regenerates (records changed, or it's a new day) `onUpdated`
 * runs so the page can quietly re-read. Returns true while that's in progress.
 */
export function useForecastRefresh(businessId: string | undefined, onUpdated: () => unknown): boolean {
  const [doneFor, setDoneFor] = useState<string | null>(null);
  const callback = useRef(onUpdated);

  useEffect(() => {
    callback.current = onUpdated;
  });

  useEffect(() => {
    if (!businessId) return;
    let cancelled = false;
    dataService
      .refreshForecasts(true)
      .then(async (result) => {
        // Even if this effect was replaced meanwhile, new results exist now;
        // the page's quiet re-read does nothing once it has closed.
        if (result?.refreshed) await callback.current();
      })
      .catch(() => undefined) // the saved results are still on screen
      .finally(() => {
        if (!cancelled) setDoneFor(businessId);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  return !!businessId && doneFor !== businessId;
}
