import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export const KEY_SIGN_IN_METHODS = 'sign-in-methods';

export interface SignInMethod {
  /** The provider's alias: google, microsoft, linkedin */
  provider: string;
  connected: boolean;
  /** The account it's connected to, e.g. an email, when known */
  account: string;
}

export interface SignInMethods {
  methods: SignInMethod[];
  /** The development test accounts sign in with a password too */
  has_password: boolean;
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
