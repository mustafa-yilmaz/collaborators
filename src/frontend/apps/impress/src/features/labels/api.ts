import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export interface LabelCount {
  name: string;
  count: number;
}

export interface Labels {
  names: string[];
  can_edit: boolean;
}

export interface LabelDetail {
  name: string;
  workspaces: { id: string; name: string; slug: string }[];
  spaces: { id: string; title: string }[];
  pages: { id: string; title: string }[];
}

export const KEY_LABELS = 'labels';

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetchAPI(url, init);
  if (!response.ok) {
    throw new APIError('Label request failed', await errorCauses(response));
  }
  return response.json() as Promise<T>;
};

/** Labels to pick from, most used first. */
export const useLabelSuggestions = (query: string, enabled: boolean) =>
  useQuery<LabelCount[], APIError>({
    queryKey: [KEY_LABELS, 'suggestions', query],
    queryFn: () =>
      request<LabelCount[]>(`labels/?q=${encodeURIComponent(query)}`),
    enabled,
  });

/** The labels of what one can see, with how often each is used. */
export const useLabelCloud = () =>
  useQuery<LabelCount[], APIError>({
    queryKey: [KEY_LABELS, 'cloud'],
    queryFn: () => request<LabelCount[]>('labels/cloud/'),
  });

export const useLabelDetail = (name: string) =>
  useQuery<LabelDetail, APIError>({
    queryKey: [KEY_LABELS, 'detail', name],
    queryFn: () => request<LabelDetail>(`labels/${encodeURIComponent(name)}/`),
    enabled: !!name,
  });

/** The labels of a page or a space ("documents/<id>") or a workspace. */
export const useOwnLabels = (path: string) => {
  const queryClient = useQueryClient();
  const query = useQuery<Labels, APIError>({
    queryKey: [KEY_LABELS, path],
    queryFn: () => request<Labels>(`${path}/labels/`),
  });
  const update = useMutation<Labels, APIError, string[]>({
    mutationFn: (names) =>
      request<Labels>(`${path}/labels/`, {
        method: 'PUT',
        body: JSON.stringify({ names }),
      }),
    onSuccess: (data) => {
      queryClient.setQueryData([KEY_LABELS, path], data);
      void queryClient.invalidateQueries({ queryKey: [KEY_LABELS, 'cloud'] });
    },
  });
  return { query, update };
};
