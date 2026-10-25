import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  APIError,
  APIList,
  errorCauses,
  fetchAPI,
  useAPIInfiniteQuery,
} from '@/api';
import { PlatformRole, User } from '@/features/auth/api';

/** Someone on the platform, as its managers see them. */
export interface PlatformPerson {
  id: string;
  full_name: string;
  email: string;
  /** Their identity provider vouches for the email */
  email_verified: boolean;
  platform_role: PlatformRole;
  registration_status: NonNullable<User['registration_status']>;
  created_at: string;
  last_login: string | null;
  /** The workspaces they are a member of */
  workspaces: number;
  /** The pages they own */
  pages: number;
  /** Suspended until reinstated */
  suspended: boolean;
  /** The viewer may suspend or remove them (below the viewer's level) */
  can_manage: boolean;
  /** The levels the viewer may put them at */
  levels_you_may_give: PlatformRole[];
}

export interface PlatformPeopleParams {
  q: string;
  role: PlatformRole | '';
  status: PlatformPerson['registration_status'] | '';
  account?: 'active' | 'suspended' | '';
}

export const KEY_PLATFORM_PEOPLE = 'platform-people';

const getPlatformPeople = async ({
  page,
  ...params
}: PlatformPeopleParams & { page: number }) => {
  const query = new URLSearchParams({ page: String(page) });
  Object.entries(params).forEach(([key, value]) => {
    if (value) {
      query.set(key, value);
    }
  });
  const response = await fetchAPI(`platform/people/?${query.toString()}`);
  if (!response.ok) {
    throw new APIError(
      'Failed to list the people of the platform',
      await errorCauses(response),
    );
  }
  return response.json() as Promise<APIList<PlatformPerson>>;
};

/** Everyone on the platform, newest first, fifty a page. */
export const usePlatformPeople = (params: PlatformPeopleParams) =>
  useAPIInfiniteQuery(KEY_PLATFORM_PEOPLE, getPlatformPeople, params);

/** What became of the account at the sign-in server. */
export type SignInServerOutcome = 'done' | 'failed' | 'not configured' | 'none';

const post = async (path: string, body?: object) => {
  const response = await fetchAPI(path, {
    method: 'POST',
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    throw new APIError(
      'The account was not changed',
      await errorCauses(response),
    );
  }
  return response.json() as Promise<{ sign_in_server: SignInServerOutcome }>;
};

const useRefreshPeople = () => {
  const queryClient = useQueryClient();
  return () =>
    void queryClient.invalidateQueries({ queryKey: [KEY_PLATFORM_PEOPLE] });
};

/** Suspend someone below one's level; they are told by email. */
export const useSuspendPerson = () => {
  const refresh = useRefreshPeople();
  return useMutation<
    { sign_in_server: SignInServerOutcome },
    APIError,
    { id: string; reason: string }
  >({
    mutationFn: ({ id, reason }) =>
      post(`platform/people/${id}/suspend/`, { reason }),
    onSuccess: refresh,
  });
};

/** Let a suspended person in again; they are told by email. */
export const useReinstatePerson = () => {
  const refresh = useRefreshPeople();
  return useMutation<
    { sign_in_server: SignInServerOutcome },
    APIError,
    { id: string }
  >({
    mutationFn: ({ id }) => post(`platform/people/${id}/reinstate/`),
    onSuccess: refresh,
  });
};

/** Put someone at a level one may give; they are told by email. */
export const useAppointPerson = () => {
  const refresh = useRefreshPeople();
  return useMutation<
    { platform_role: PlatformRole },
    APIError,
    { id: string; role: PlatformRole }
  >({
    mutationFn: async ({ id, role }) => {
      const response = await fetchAPI(`platform/people/${id}/level/`, {
        method: 'POST',
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        throw new APIError(
          'The level was not changed',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<{ platform_role: PlatformRole }>;
    },
    onSuccess: refresh,
  });
};

/** What removing someone would leave without an owner. */
export interface RemovalPreview {
  pages: { id: string; title: string }[];
  pages_count: number;
  /** The pages with everything below them */
  pages_with_subpages: number;
  workspaces: { id: string; name: string }[];
}

export const useRemovalPreview = (id: string) =>
  useQuery<RemovalPreview, APIError>({
    queryKey: [KEY_PLATFORM_PEOPLE, 'removal', id],
    queryFn: async () => {
      const response = await fetchAPI(`platform/people/${id}/removal/`);
      if (!response.ok) {
        throw new APIError(
          'Failed to see what removing leaves',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<RemovalPreview>;
    },
  });

export interface RemovalChoice {
  id: string;
  pages: 'hand_over' | 'delete';
  recipient?: string;
  reason: string;
  block: boolean;
}

/** Remove someone's account, their pages handed over or deleted. */
export const useRemovePerson = () => {
  const refresh = useRefreshPeople();
  const queryClient = useQueryClient();
  return useMutation<
    { sign_in_server: SignInServerOutcome },
    APIError,
    RemovalChoice
  >({
    mutationFn: ({ id, ...choice }) =>
      post(`platform/people/${id}/remove/`, choice),
    onSuccess: () => {
      refresh();
      void queryClient.invalidateQueries({ queryKey: [KEY_BLOCKED_EMAILS] });
    },
  });
};

/** An email nobody signs in with (owners only). */
export interface BlockedEmail {
  id: string;
  email: string;
  reason: string;
  blocked_by: string;
  created_at: string;
  /** Someone with an account here */
  has_account: boolean;
}

export const KEY_BLOCKED_EMAILS = 'blocked-emails';

export const useBlockedEmails = () =>
  useQuery<BlockedEmail[], APIError>({
    queryKey: [KEY_BLOCKED_EMAILS],
    queryFn: async () => {
      const response = await fetchAPI('platform/blocked/');
      if (!response.ok) {
        throw new APIError(
          'Failed to list the blocked emails',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<BlockedEmail[]>;
    },
  });

export const useBlockEmail = () => {
  const queryClient = useQueryClient();
  return useMutation<BlockedEmail, APIError, { email: string; reason: string }>(
    {
      mutationFn: async (body) => {
        const response = await fetchAPI('platform/blocked/', {
          method: 'POST',
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          throw new APIError(
            'The email was not blocked',
            await errorCauses(response),
          );
        }
        return response.json() as Promise<BlockedEmail>;
      },
      onSuccess: () => {
        void queryClient.invalidateQueries({ queryKey: [KEY_BLOCKED_EMAILS] });
        void queryClient.invalidateQueries({ queryKey: [KEY_PLATFORM_PEOPLE] });
      },
    },
  );
};

export const useUnblockEmail = () => {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, { id: string }>({
    mutationFn: async ({ id }) => {
      const response = await fetchAPI(`platform/blocked/${id}/`, {
        method: 'DELETE',
      });
      if (!response.ok) {
        throw new APIError(
          'The email was not unblocked',
          await errorCauses(response),
        );
      }
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: [KEY_BLOCKED_EMAILS] }),
  });
};
