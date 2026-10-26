import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

/** An approval of an AI assistant at the sign-in server. */
export interface AssistantApproval {
  client_id: string;
  name: string;
  /** Approved and with a live session there; else "not in use" */
  connected: boolean;
  /** Unix milliseconds */
  approved_at: number | null;
  /** When it last did something through the MCP server (ISO) */
  last_used_at: string | null;
}

/** Claude, ChatGPT or Gemini, with its approvals (none: not connected). */
export interface AssistantTool {
  id: 'claude' | 'chatgpt' | 'gemini';
  name: string;
  approvals: AssistantApproval[];
}

export interface Assistants {
  /** The address to give one's assistant */
  mcp_url: string;
  tools: AssistantTool[];
  /** Approved assistants that are none of the three */
  others: AssistantApproval[];
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

/** Disconnect assistants: their approvals and tokens go. */
export const useDisconnectAssistant = () => {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, string[]>({
    mutationFn: async (clientIds) => {
      for (const clientId of clientIds) {
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
      }
    },
    onSuccess: () =>
      void queryClient.invalidateQueries({ queryKey: [KEY_ASSISTANTS] }),
  });
};
