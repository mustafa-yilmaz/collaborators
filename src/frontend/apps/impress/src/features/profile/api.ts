import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export type Audience = 'public' | 'platform' | 'colleagues' | 'selected';

export const PROFILE_FIELDS = [
  'name',
  'headline',
  'organization',
  'location',
  'bio',
  'website',
  'email',
  'interests',
  'workspaces',
] as const;
export type ProfileField = (typeof PROFILE_FIELDS)[number];

export interface AudienceSetting {
  level: Audience;
  workspaces: string[];
  spaces: string[];
}

/** A profile as its viewer may see it (empty pieces are hidden or unset). */
export interface Profile {
  id: string;
  full_name: string;
  is_me: boolean;
  headline: string;
  organization: string;
  location: string;
  bio: string;
  website: string;
  email: string;
  interests: string[];
  workspaces: { id: string; name: string }[];
}

export interface MyProfile extends Profile {
  visibility: Record<ProfileField, AudienceSetting>;
  workspace_choices: { id: string; name: string }[];
  space_choices: { id: string; title: string }[];
}

export type MyProfileUpdate = Partial<
  Pick<
    Profile,
    'headline' | 'organization' | 'location' | 'bio' | 'website' | 'interests'
  > & { visibility: Partial<Record<ProfileField, AudienceSetting>> }
>;

export const KEY_PROFILE = 'profile';

/** Where someone's profile is shown. */
export const profileHref = (userId: string) =>
  `/profile/?id=${encodeURIComponent(userId)}`;

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetchAPI(url, init);
  if (!response.ok) {
    throw new APIError('Profile request failed', await errorCauses(response));
  }
  return response.json() as Promise<T>;
};

export const useProfile = (userId: string) =>
  useQuery<Profile, APIError>({
    queryKey: [KEY_PROFILE, userId],
    queryFn: () => request<Profile>(`profiles/${userId}/`),
    enabled: !!userId,
    retry: false,
  });

export const useMyProfile = () => {
  const queryClient = useQueryClient();
  const query = useQuery<MyProfile, APIError>({
    queryKey: [KEY_PROFILE, 'me'],
    queryFn: () => request<MyProfile>('profiles/me/'),
  });
  const update = useMutation<MyProfile, APIError, MyProfileUpdate>({
    mutationFn: (data) =>
      request<MyProfile>('profiles/me/', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData([KEY_PROFILE, 'me'], data);
      void queryClient.invalidateQueries({ queryKey: [KEY_PROFILE, data.id] });
    },
  });
  return { query, update };
};
