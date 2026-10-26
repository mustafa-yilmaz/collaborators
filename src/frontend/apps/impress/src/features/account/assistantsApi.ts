import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

/** An AI assistant the collaborator connected (approved at sign-in). */
export interface ConnectedAssistant {
  client_id: string;
  name: string;
  /** Unix milliseconds */
  approved_at: number | null;
  last_updated_at: number | null;
}

export interface Assistants {
  /** The address to give one's assistant */
  mcp_url: string;
  assistants: ConnectedAssistant[];
}

export const KEY_ASSISTANTS = 'connected-assistants';

export const useAssistants = () =>
  useQuery<Assistants, APIError>({
    queryKey: [KEY_ASSISTANTS],
    queryFn: async () => {
      const response = await fetchAPI('users/me/assistants/');
      if (!response.ok) {
        throw new APIError(
          'Failed to list the assistants',
          await errorCauses(response),
        );
      }
      return response.json() as Promise<Assistants>;
    },
  });

/** Disconnect an assistant: its approval and tokens go. */
export const useDisconnectAssistant = () => {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, string>({
    mutationFn: async (clientId) => {
      const response = await fetchAPI(
        `users/me/assistants/${encodeURIComponent(clientId)}/`,
        { method: 'DELETE' },
      );
      if (!response.ok) {
        throw new APIError(
          'Failed to disconnect the assistant',
          await errorCauses(response),
        );
      }
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: [KEY_ASSISTANTS] }),
  });
};
