import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export const KEY_SIGN_IN_METHODS = 'sign-in-methods';

export interface SignInMethod {
  /** The provider's alias: google, microsoft, linkedin */
  provider: string;
  connected: boolean;
  /** The account it's connected to, e.g. an email, when known */
  account: string;
  /** More accounts of this provider opening this account (Google, Microsoft) */
  more_accounts: { id: string; account: string }[];
  /** Whether another account of this provider can be added */
  can_add_accounts: boolean;
}

/** What happened to the account last added, said once */
export interface AddedAccountNotice {
  outcome: 'added' | 'already' | 'separate';
  provider: string;
  account: string;
}

export interface SignInMethods {
  methods: SignInMethod[];
  /** The development test accounts sign in with a password too */
  has_password: boolean;
  notice: AddedAccountNotice | null;
}

export function useSignInMethods(enabled = true) {
  return useQuery<SignInMethods, APIError>({
    enabled,
    queryKey: [KEY_SIGN_IN_METHODS],
    queryFn: async () => {
      const response = await fetchAPI('users/me/sign-in-methods/');
      if (!response.ok) {
        throw new APIError(
          'Failed to get the sign-in methods',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<SignInMethods>;
    },
    retry: false,
  });
}

export function useDisconnectSignInMethod() {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, string>({
    mutationFn: async (provider) => {
      const response = await fetchAPI(`users/me/sign-in-methods/${provider}/`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new APIError(
          'Failed to disconnect the sign-in method',
          await errorCauses(response),
        );
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [KEY_SIGN_IN_METHODS] }),
  });
}

/**
 * Add another Google or Microsoft account: the server says where to go (the
 * sign-in server's sign-out, then that provider's account chooser), and the
 * browser comes back to this page.
 */
export function useAddSignInAccount() {
  return useMutation<void, APIError, string>({
    mutationFn: async (provider) => {
      const response = await fetchAPI(
        `users/me/sign-in-methods/${provider}/add/`,
        {
          method: 'POST',
          body: JSON.stringify({ next: window.location.href }),
        },
      );
      if (!response.ok) {
        throw new APIError(
          'Failed to add the account',
          await errorCauses(response),
        );
      }
      const { url } = (await response.json()) as { url: string };
      window.location.assign(url);
    },
  });
}

export function useRemoveSignInAccount() {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, { provider: string; id: string }>({
    mutationFn: async ({ provider, id }) => {
      const response = await fetchAPI(
        `users/me/sign-in-methods/${provider}/accounts/${id}/`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new APIError(
          'Failed to disconnect the account',
          await errorCauses(response),
        );
      }
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: [KEY_SIGN_IN_METHODS] }),
  });
}

// -- Dashboard hints about sign-in, closed for good one by one

export type Hint = 'welcome' | 'connect-accounts';

export const KEY_HINTS = 'account-hints';

export function useHints() {
  return useQuery<{ dismissed: Hint[] }, APIError>({
    queryKey: [KEY_HINTS],
    queryFn: async () => {
      const response = await fetchAPI('users/me/hints/');
      if (!response.ok) {
        throw new APIError(
          'Failed to get the hints',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<{ dismissed: Hint[] }>;
    },
  });
}

export function useDismissHint() {
  const queryClient = useQueryClient();
  return useMutation<{ dismissed: Hint[] }, APIError, Hint>({
    mutationFn: async (hint) => {
      const response = await fetchAPI('users/me/hints/', {
        method: 'POST',
        body: JSON.stringify({ hint }),
      });
      if (!response.ok) {
        throw new APIError(
          'Failed to close the hint',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<{ dismissed: Hint[] }>;
    },
    onSuccess: (data) => queryClient.setQueryData([KEY_HINTS], data),
  });
}
