import { ApiError } from '../services/api/client';
import { t } from '../i18n';

/** Turns backend errors into something a shop owner can act on. */

/**
 * Maps any thrown value to a user-safe message.
 *
 * @param error    Whatever was caught.
 * @param fallback Wording used when the error is not recognised.
 */
export function toUserMessage(error: unknown, fallback = t('Something went wrong. Please try again.')): string {
  const fallbackText = t(fallback);
  // The Laravel API already returns specific, user-safe messages (stock
  // shortages, duplicate emails, validation errors) — pass them through
  // rather than falling through to the generic fallback below, which would
  // otherwise silently discard them.
  if (error instanceof ApiError) return error.message || fallbackText;

  if (error instanceof Error) {
    const networkMessage = mapNetworkMessage(error.message);
    if (networkMessage) return networkMessage;
  }

  return fallbackText;
}

/** `fetch()` itself throws these (not an HTTP error response) when the request never reached the server. */
function mapNetworkMessage(message: string): string | null {
  const m = message.toLowerCase();

  if (m.includes('failed to fetch') || m.includes('networkerror')) {
    return t('Cannot reach the server. Check your internet connection and try again.');
  }
  return null;
}
