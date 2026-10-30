/**
 * The business and user the app is currently acting as.
 *
 * Pages call `dataService.getProducts()` with no arguments — that is the shape
 * the approved frontend was built against. The services underneath need a
 * business id, so `AuthProvider` publishes the active business here and
 * `dataService` reads it. This keeps every page component unchanged.
 *
 * This is a convenience for the client, never a security boundary: the
 * business id is also sent as a filter on each query, and Row Level Security
 * independently rejects anything outside the caller's memberships.
 */

export interface ActiveContext {
  businessId: string | null;
  userId: string | null;
}

let current: ActiveContext = { businessId: null, userId: null };

export function setActiveContext(next: ActiveContext): void {
  current = next;
}

export function getActiveContext(): ActiveContext {
  return current;
}

/**
 * The business id, or null when the user is signed out or has no business
 * yet. Callers treat null as "fall back to sample data".
 */
export function getActiveBusinessId(): string | null {
  return current.businessId;
}

export function getActiveUserId(): string | null {
  return current.userId;
}
