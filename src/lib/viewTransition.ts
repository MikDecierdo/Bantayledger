import type { MouseEvent } from 'react';
import { flushSync } from 'react-dom';

type Navigator = { push: (path: string) => void };

type DocumentWithTransitions = Document & {
  startViewTransition?: (update: () => void) => unknown;
};

function canAnimate(): boolean {
  if (typeof document === 'undefined') return false;
  if (typeof (document as DocumentWithTransitions).startViewTransition !== 'function') return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Navigates, animating between the old and new page with the browser's View
 * Transitions where available (otherwise it just navigates).
 */
export function navigateWithTransition(history: Navigator, path: string): void {
  if (!canAnimate()) {
    history.push(path);
    return;
  }
  (document as DocumentWithTransitions).startViewTransition?.(() => {
    flushSync(() => history.push(path));
  });
}

/**
 * Click handler for a <Link>: plain left-clicks animate; modified clicks
 * (new tab, etc.) keep their normal behaviour.
 */
export function transitionClick(history: Navigator, path: string) {
  return (e: MouseEvent<HTMLAnchorElement>) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigateWithTransition(history, path);
  };
}
