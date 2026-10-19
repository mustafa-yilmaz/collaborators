import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { KEY_DOC, KEY_LIST_DOC } from '@/features/docs/doc-management';

export const KEY_PUBLICATION = 'publication';
export const KEY_WIKI = 'wiki';
export const KEY_PUBLICATION_LOG = 'publication-log';

/** How a page is published to the web. */
export interface Publication {
  is_public: boolean;
  keep_private: boolean;
  allow_indexing: boolean;
  /** Search engines may index it: the page, or its whole wiki, allows it */
  indexable: boolean;
  wiki: {
    space_id: string;
    slug: string;
    accent: string;
    title: string;
  } | null;
  can_configure: boolean;
  can_publish: boolean;
}

export interface WikiNode {
  id: string;
  title: string;
  children: WikiNode[];
}

/** A space published as a wiki, as anyone sees it. */
export interface Wiki {
  id: string;
  slug: string;
  title: string;
  accent: string;
  allow_indexing: boolean;
  workspace: string | null;
  updated_at: string;
  can_edit: boolean;
  tree: WikiNode[];
}

export interface PublicationLogEntry {
  id: string;
  action:
    | 'page_published'
    | 'page_unpublished'
    | 'wiki_published'
    | 'wiki_updated'
    | 'wiki_unpublished';
  created_at: string;
  actor: string | null;
  document: { id: string; title: string; kind: string };
  details: { slug?: string };
}

const request = async <T>(
  url: string,
  errorMessage: string,
  init?: RequestInit,
): Promise<T> => {
  const response = await fetchAPI(url, init);
  if (!response.ok) {
    throw new APIError(errorMessage, await errorCauses(response));
  }
  if (response.status === 204) {
    return undefined as T;
  }
  return response.json() as Promise<T>;
};

const noRetryOnDenied = (failureCount: number, error: APIError) =>
  ![401, 403, 404].includes(error.status ?? 0) && failureCount < 2;

export function usePublication(docId: string, enabled = true) {
  return useQuery<Publication, APIError>({
    queryKey: [KEY_PUBLICATION, docId],
    queryFn: () =>
      request<Publication>(
        `documents/${docId}/publication/`,
        'Failed to get the publishing settings',
      ),
    enabled: enabled && !!docId,
    retry: noRetryOnDenied,
  });
}

export function useUpdatePublication(docId: string) {
  const queryClient = useQueryClient();
  return useMutation<
    Publication,
    APIError,
    { keep_private?: boolean; allow_indexing?: boolean }
  >({
    mutationFn: (data) =>
      request<Publication>(
        `documents/${docId}/publication/`,
        'Failed to update the publishing settings',
        { method: 'PUT', body: JSON.stringify(data) },
      ),
    onSuccess: (data) => {
      queryClient.setQueryData([KEY_PUBLICATION, docId], data);
      void queryClient.invalidateQueries({ queryKey: [KEY_DOC] });
    },
  });
}

export function useWikiMutations(spaceId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: [KEY_PUBLICATION] });
    void queryClient.invalidateQueries({ queryKey: [KEY_WIKI] });
    void queryClient.invalidateQueries({ queryKey: [KEY_DOC] });
    void queryClient.invalidateQueries({ queryKey: [KEY_LIST_DOC] });
    void queryClient.invalidateQueries({ queryKey: [KEY_PUBLICATION_LOG] });
  };
  const publish = useMutation<
    { slug: string; accent: string; allow_indexing: boolean },
    APIError,
    { slug: string; accent: string; allow_indexing: boolean }
  >({
    mutationFn: (data) =>
      request(`spaces/${spaceId}/wiki/`, 'Failed to publish the wiki', {
        method: 'PUT',
        body: JSON.stringify(data),
      }),
    onSuccess,
  });
  const unpublish = useMutation<void, APIError, void>({
    mutationFn: () =>
      request(`spaces/${spaceId}/wiki/`, 'Failed to unpublish the wiki', {
        method: 'DELETE',
      }),
    onSuccess,
  });
  return { publish, unpublish };
}

export function useWiki(slug: string) {
  return useQuery<Wiki, APIError>({
    queryKey: [KEY_WIKI, slug],
    queryFn: () => request<Wiki>(`wiki/${slug}/`, 'Failed to get the wiki'),
    enabled: !!slug,
    retry: noRetryOnDenied,
  });
}

export function usePublicationLog(workspaceId: string, enabled = true) {
  return useQuery<PublicationLogEntry[], APIError>({
    queryKey: [KEY_PUBLICATION_LOG, workspaceId],
    queryFn: () =>
      request<PublicationLogEntry[]>(
        `workspaces/${workspaceId}/publication-log/`,
        'Failed to get the publishing log',
      ),
    enabled,
  });
}
