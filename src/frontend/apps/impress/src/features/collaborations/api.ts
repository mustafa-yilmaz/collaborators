import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

/** The lists of "My collaborations", see the backend's collaborations/. */
export type CollaborationsView = 'owned' | 'recent' | 'shared' | 'starred';

export interface CollaborationWorkspace {
  id: string;
  name: string;
  slug: string;
  role: string | null;
  updated_at: string;
  is_favorite: boolean;
}

export interface CollaborationDocument {
  id: string;
  title: string;
  kind: 'page' | 'space';
  updated_at: string;
  is_owned: boolean;
  is_favorite: boolean;
}

export interface Collaborations {
  view: CollaborationsView;
  workspaces: CollaborationWorkspace[];
  spaces: CollaborationDocument[];
  pages: CollaborationDocument[];
}

export const KEY_COLLABORATIONS = 'collaborations';

export const useCollaborations = (view: CollaborationsView) =>
  useQuery<Collaborations, APIError>({
    queryKey: [KEY_COLLABORATIONS, view],
    queryFn: async () => {
      const response = await fetchAPI(`collaborations/?view=${view}`);
      if (!response.ok) {
        throw new APIError(
          'Failed to get the collaborations',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<Collaborations>;
    },
  });

/** Star a workspace, or not any more. */
export const useStarWorkspace = () => {
  const queryClient = useQueryClient();
  return useMutation<unknown, APIError, { id: string; starred: boolean }>({
    mutationFn: async ({ id, starred }) => {
      const response = await fetchAPI(`workspaces/${id}/favorite/`, {
        method: starred ? 'POST' : 'DELETE',
      });
      if (!response.ok) {
        throw new APIError(
          'Failed to star the workspace',
          await errorCauses(response),
        );
      }
      return response.json();
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: [KEY_COLLABORATIONS] }),
  });
};
