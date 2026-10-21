/**
 * A visit to Collaborators: from opening it to leaving it. Notes closed during
 * a visit (e.g. the welcome on the dashboard) come back at the next one.
 *
 * Leaving is noticed without signing out: a visit ends when Collaborators
 * was not open in any tab of the browser for VISIT_GAP_MS (every open tab
 * keeps it alive), or at sign-out. Kept in the browser (localStorage, shared
 * by its tabs); when it can't be, every page load is a new visit.
 */

const KEY = 'collaborators-visit';
export const VISIT_GAP_MS = 30 * 60 * 1000;
const HEARTBEAT_MS = 60 * 1000;

interface VisitState {
  lastActive: number;
  hidden: string[];
}

const read = (): VisitState | null => {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as VisitState) : null;
  } catch {
    return null;
  }
};

const write = (state: VisitState) => {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Private mode or storage off: nothing outlives the page
  }
};

/** The current visit, or null when the last one ended. */
const currentVisit = (now: number) => {
  const state = read();
  return state && now - state.lastActive <= VISIT_GAP_MS ? state : null;
};

/** Mark the visit as still going on (and start one if the last ended). */
export const touchVisit = (now = Date.now()) => {
  const state = currentVisit(now);
  write({ lastActive: now, hidden: state?.hidden ?? [] });
};

/** Whether a note was closed during this visit. */
export const isHiddenThisVisit = (note: string, now = Date.now()) =>
  !!currentVisit(now)?.hidden.includes(note);

/** Close a note until the next visit. */
export const hideForThisVisit = (note: string, now = Date.now()) => {
  const hidden = currentVisit(now)?.hidden ?? [];
  write({
    lastActive: now,
    hidden: hidden.includes(note) ? hidden : [...hidden, note],
  });
};

/** Signing out ends the visit. */
export const endVisit = () => {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // nothing kept anyway
  }
};

/**
 * Keep the visit alive while Collaborators is open and looked at, in any
 * page; returns the cleanup.
 */
export const watchVisit = () => {
  const touch = () => {
    if (document.visibilityState === 'visible') {
      touchVisit();
    }
  };
  touch();
  const timer = window.setInterval(touch, HEARTBEAT_MS);
  document.addEventListener('visibilitychange', touch);
  // Leaving counts from the last moment the page was open
  const leave = () => touchVisit();
  window.addEventListener('pagehide', leave);
  return () => {
    window.clearInterval(timer);
    document.removeEventListener('visibilitychange', touch);
    window.removeEventListener('pagehide', leave);
  };
};
