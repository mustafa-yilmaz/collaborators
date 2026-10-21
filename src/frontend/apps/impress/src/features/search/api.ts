import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

/** One search for everything, see the backend's search/. */
export interface SearchWorkspace {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface SearchDocument {
  id: string;
  title: string;
  kind: 'page' | 'space';
  /** The space (or top page) holding it */
  context: string;
  /** A few words around the match, when it is in the text */
  snippet: string;
  updated_at: string;
}

export interface SearchGroup {
  workspaces: SearchWorkspace[];
  spaces: SearchDocument[];
  pages: SearchDocument[];
  labels: string[];
}

export interface SearchResult {
  q: string;
  /** What one is part of */
  involved: SearchGroup;
  /** What one is not part of yet, but may see */
  visible: SearchGroup;
}

export const SEARCH_MIN_LENGTH = 2;
export const SEARCH_PATH = '/workspaces/discover/';

export const searchHref = (query: string) =>
  `${SEARCH_PATH}?q=${encodeURIComponent(query)}`;

export const isEmpty = (group?: SearchGroup) =>
  !group ||
  (!group.workspaces.length &&
    !group.spaces.length &&
    !group.pages.length &&
    !group.labels.length);

export const useSearch = (query: string, size: number) =>
  useQuery<SearchResult, APIError>({
    queryKey: ['search', query, size],
    queryFn: async () => {
      const response = await fetchAPI(
        `search/?q=${encodeURIComponent(query)}&size=${size}`,
      );
      if (!response.ok) {
        throw new APIError('Search failed', await errorCauses(response));
      }
      return response.json() as Promise<SearchResult>;
    },
    enabled: query.trim().length >= SEARCH_MIN_LENGTH,
    placeholderData: keepPreviousData,
  });
