import { useSyncExternalStore } from 'react';

/**
 * Connection and sync state shared by the API client, the sync loop and the
 * offline bar. A tiny store read with useSyncExternalStore.
 */
export interface OfflineStatus {
  /** The browser has a network and the server answered the last request. */
  online: boolean;
  /** A request has been waiting a few seconds: the free server is waking up. */
  waking: boolean;
  /** Something on screen came from the phone's saved copy, not the server. */
  showingSaved: boolean;
  /** Records waiting to be sent. */
  pending: number;
  /** Records the server refused; they need the owner's attention. */
  failed: number;
  syncing: boolean;
}

let state: OfflineStatus = {
  online: typeof navigator === 'undefined' ? true : navigator.onLine,
  waking: false,
  showingSaved: false,
  pending: 0,
  failed: 0,
  syncing: false,
};
const listeners = new Set<() => void>();

export function getOfflineStatus(): OfflineStatus {
  return state;
}

export function setOfflineStatus(patch: Partial<OfflineStatus>): void {
  const next = { ...state, ...patch };
  if ((Object.keys(patch) as (keyof OfflineStatus)[]).every((k) => next[k] === state[k])) return;
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOfflineStatus(): OfflineStatus {
  return useSyncExternalStore(subscribe, getOfflineStatus, getOfflineStatus);
}

/** Fired after synced records reach the server, so open pages reload. */
export const DATA_CHANGED_EVENT = 'bl-data-changed';

export function announceDataChanged(): void {
  window.dispatchEvent(new Event(DATA_CHANGED_EVENT));
}
