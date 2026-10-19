import { useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { useConfig } from '@/core';
import { User } from '@/features/auth';

import { KEY_LIST_USER, useUsers } from './useUsers';

export const KEY_KNOWN_PEOPLE = 'known-people';

const getKnownPeople = async (query: string): Promise<User[]> => {
  const response = await fetchAPI(
    `people/?q=${encodeURIComponent(query.trim())}`,
  );
  if (!response.ok) {
    throw new APIError('Failed to get the people', await errorCauses(response));
  }
  return response.json() as Promise<User[]>;
};

/**
 * People to mention or to put in a Person cell, from the first letter (or
 * none): the people one works with (pages shared, workspaces), then, once
 * enough letters are typed, the wider search.
 */
export const usePeopleToMention = (query: string) => {
  const { data: config } = useConfig();
  const minLength = config?.API_USERS_SEARCH_QUERY_MIN_LENGTH ?? 3;
  const { data: known = [] } = useQuery<User[], APIError>({
    queryKey: [KEY_KNOWN_PEOPLE, query.trim()],
    queryFn: () => getKnownPeople(query),
    staleTime: 30_000,
  });
  const { data: searched = [] } = useUsers(
    { query, docId: '' },
    {
      queryKey: [KEY_LIST_USER, { query, docId: '' }],
      enabled: query.trim().length >= minLength,
    },
  );
  const seen = new Set<string>();
  return [...known, ...searched].filter((user) => {
    if (seen.has(user.id)) {
      return false;
    }
    seen.add(user.id);
    return true;
  });
};
