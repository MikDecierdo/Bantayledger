/**
 * Slide-Up Reveal: a page slides up only when it replaces a loading skeleton.
 *
 * `LoadingState` notes when it goes away and `Workspace` checks on mount. React
 * runs the removed skeleton's cleanup before the new page's effect in the same
 * update, so a short time window tells the two cases apart. Pages opened with
 * no skeleton, and skeletons inside a card, don't trigger it.
 */
const SAME_UPDATE_MS = 100;

let skeletonEndedAt = -Infinity;

export function noteSkeletonEnded(): void {
  skeletonEndedAt = performance.now();
}

export function skeletonJustEnded(): boolean {
  const justEnded = performance.now() - skeletonEndedAt < SAME_UPDATE_MS;
  skeletonEndedAt = -Infinity;
  return justEnded;
}
