import { baseApiUrl } from '@/api';

export const HOME_URL = '/home/';
export const LOGIN_URL = `${baseApiUrl()}authenticate/`;
/** The sign-in page, with one button per identity provider */
export const SIGNIN_URL = '/signin/';
export const LOGOUT_URL = `${baseApiUrl()}logout/`;
export const PATH_AUTH_SESSION_STORAGE = 'docs-path-auth';
export const SILENT_LOGIN_RETRY = 'silent-login-retry';
