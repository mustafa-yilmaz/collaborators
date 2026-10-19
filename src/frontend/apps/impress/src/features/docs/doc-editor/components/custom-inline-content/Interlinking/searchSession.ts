/**
 * An open "@" or "Link a doc" search is a node of the page while it is open,
 * so it is saved and shared like the rest of the page. It is shown only in
 * the browser tab that opened it: elsewhere (another person, or the same
 * person after a reload) it shows nothing, and once left behind for a while
 * (the tab was closed with the menu open) it is removed.
 */
/** This browser tab. */
const TAB_ID =
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** A search older than this was left behind. */
export const STALE_SEARCH_MS = 10 * 60 * 1000;

/** The props that mark a new search as opened here, now. */
export const searchOrigin = () => ({
  openedBy: TAB_ID,
  openedAt: String(Date.now()),
});

export const isOwnSearch = (props: { openedBy?: string }) =>
  props.openedBy === TAB_ID;

export const isStaleSearch = (props: { openedAt?: string }) =>
  Date.now() - (Number(props.openedAt) || 0) > STALE_SEARCH_MS;
