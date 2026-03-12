const STORAGE_KEY = 'pendingJoin';

export type PendingJoin = {
  address?: string;
  invite?: string;
};

/**
 * Extracts `?join=` and `?invite=` from the current URL on first load,
 * stores them in sessionStorage for persistence through auth flows,
 * and cleans the URL params from the address bar.
 *
 * Supports three cases:
 *  - `?join=addr` — join by address
 *  - `?join=addr&invite=code` — join by address with invite
 *  - `?invite=code` — resolve invite code via Central to get address
 */
export function useJoinParams(): void {
  // Run synchronously on import/first call — only once
  if (typeof window === 'undefined') return;

  const params = new URLSearchParams(window.location.search);
  const join = params.get('join');
  const invite = params.get('invite');
  if (!join && !invite) return;

  const pending: PendingJoin = {};
  if (join) pending.address = join;
  if (invite) pending.invite = invite;

  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(pending));

  // Clean URL params without triggering navigation
  params.delete('join');
  params.delete('invite');
  const clean = params.toString();
  const newUrl = window.location.pathname + (clean ? `?${clean}` : '') + window.location.hash;
  window.history.replaceState(null, '', newUrl);
}

export function consumePendingJoin(): PendingJoin | null {
  const raw = sessionStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  sessionStorage.removeItem(STORAGE_KEY);
  try {
    return JSON.parse(raw) as PendingJoin;
  } catch {
    return null;
  }
}
