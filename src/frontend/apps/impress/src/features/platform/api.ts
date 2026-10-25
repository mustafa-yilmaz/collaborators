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
}

export interface PlatformPeopleParams {
  q: string;
  role: PlatformRole | '';
  status: PlatformPerson['registration_status'] | '';
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
