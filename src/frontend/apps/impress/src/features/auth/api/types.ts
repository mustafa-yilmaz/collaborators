/**
 * Represents user retrieved from the API.
 * @interface User
 * @property {string} id - The id of the user.
 * @property {string} email - The email of the user.
 * @property {string} name - The name of the user.
 * @property {string} language - The language of the user. e.g. 'en-us', 'fr-fr', 'de-de'.
 */
export interface User {
  id: string;
  is_first_connection: boolean;
  email: string;
  full_name: string;
  short_name: string;
  language?: string;
  /** Collaborators: a newcomer waits for a platform manager */
  registration_status?: 'approved' | 'pending' | 'declined';
  /** The level on the platform (see PLATFORM_LEVELS) */
  platform_role?: PlatformRole;
}

/** Collaborators: the levels of the platform, lowest first. */
export const PLATFORM_LEVELS = [
  'collaborator',
  'manager',
  'administrator',
  'owner',
] as const;

export type PlatformRole = (typeof PLATFORM_LEVELS)[number];

/** Whether someone is at this level of the platform or above. */
export const hasPlatformLevel = (
  user: Pick<User, 'platform_role'> | null | undefined,
  role: PlatformRole,
) =>
  PLATFORM_LEVELS.indexOf(user?.platform_role ?? 'collaborator') >=
  PLATFORM_LEVELS.indexOf(role);

export type UserLight = Pick<User, 'full_name' | 'short_name'>;
