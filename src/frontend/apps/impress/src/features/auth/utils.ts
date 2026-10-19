import { forgetLeftPanel } from '@/features/left-panel/stores/useLeftPanelStore';
import { safeLocalStorage, safeSessionStorage } from '@/utils/storages';

import {
  HOME_URL,
  LOGIN_URL,
  LOGOUT_URL,
  PATH_AUTH_SESSION_STORAGE,
  SIGNIN_URL,
  SILENT_LOGIN_RETRY,
} from './conf';

/**
 * Get the stored auth URL from session storage (per-tab)
 */
export const getAuthUrl = () => {
  const path_auth = safeSessionStorage.getItem(PATH_AUTH_SESSION_STORAGE);
  if (path_auth) {
    safeSessionStorage.removeItem(PATH_AUTH_SESSION_STORAGE);
    return path_auth;
  }
};

/**
 * Store the current path in session storage (per-tab) if it's not the
 * homepage or root, so we can redirect the user to this path after login.
 * Using sessionStorage ensures each tab independently tracks its own URL.
 */
export const setAuthUrl = () => {
  if (
    window.location.pathname !== '/' &&
    window.location.pathname !== `${HOME_URL}/`
  ) {
    safeSessionStorage.setItem(PATH_AUTH_SESSION_STORAGE, window.location.href);
  }
};

/** Open the sign-in page, coming back here once signed in. */
export const gotoLogin = (withRedirect = true) => {
  if (withRedirect) {
    setAuthUrl();
  }

  window.location.replace(SIGNIN_URL);
};

/**
 * Sign in with one identity provider (its alias in the identity server, e.g.
 * "google"), straight to its page; without one, the identity server's own
 * page.
 */
export const gotoProviderLogin = (provider?: string) => {
  // Each sign-in opens on the dashboard with the side panel hidden
  forgetLeftPanel();
  window.location.assign(
    provider
      ? `${LOGIN_URL}?${new URLSearchParams({ kc_idp_hint: provider }).toString()}`
      : LOGIN_URL,
  );
};

export const gotoSilentLogin = () => {
  // Already tried silent login, dont try again
  if (!hasTrySilent()) {
    const params = new URLSearchParams({
      silent: 'true',
      next: window.location.href,
    });

    safeLocalStorage.setItem(SILENT_LOGIN_RETRY, 'true');

    const REDIRECT = `${LOGIN_URL}?${params.toString()}`;
    window.location.replace(REDIRECT);
  }
};

export const hasTrySilent = () => {
  return !!safeLocalStorage.getItem(SILENT_LOGIN_RETRY);
};

export const resetSilent = () => {
  safeLocalStorage.removeItem(SILENT_LOGIN_RETRY);
};

export const gotoLogout = () => {
  window.location.replace(LOGOUT_URL);
};
