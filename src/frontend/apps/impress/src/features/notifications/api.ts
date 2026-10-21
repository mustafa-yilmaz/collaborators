import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';

export type NotificationKind =
  | 'mention'
  | 'comment_mention'
  | 'assignment'
  | 'join_request'
  | 'join_approved'
  | 'signup'
  | 'signup_approved';

export interface Notification {
  id: string;
  kind: NotificationKind;
  actor: { id: string; full_name: string } | null;
  /** Where: a document, or a workspace for joining */
  document: { id: string; title: string | null } | null;
  workspace: { id: string; name: string } | null;
  anchor_id: string;
  thread_id: string | null;
  team: string;
  team_label: string | null;
  created_at: string;
  read_at: string | null;
}

export const KEY_NOTIFICATIONS = 'notifications';
export const KEY_UNREAD_COUNT = 'notifications-unread-count';
export const KEY_NOTIFICATION_PREFERENCES = 'notification-preferences';

const request = async <T>(url: string, init?: RequestInit): Promise<T> => {
  const response = await fetchAPI(url, init);
  if (!response.ok) {
    throw new APIError(
      'Notification request failed',
      await errorCauses(response),
    );
  }
  return (response.status === 204 ? undefined : response.json()) as Promise<T>;
};

/** The unread count, refreshed every minute for the bell's badge. */
export function useUnreadCount(enabled: boolean) {
  return useQuery<{ count: number }, APIError>({
    queryKey: [KEY_UNREAD_COUNT],
    queryFn: () => request('notifications/unread-count/'),
    enabled,
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  });
}

export function useNotifications(enabled: boolean) {
  return useQuery<Notification[], APIError>({
    queryKey: [KEY_NOTIFICATIONS],
    queryFn: () => request('notifications/'),
    enabled,
  });
}

export function useNotificationMutations() {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: [KEY_NOTIFICATIONS] });
    void queryClient.invalidateQueries({ queryKey: [KEY_UNREAD_COUNT] });
  };
  return {
    markRead: useMutation<Notification, APIError, { id: string }>({
      mutationFn: ({ id }) =>
        request(`notifications/${id}/read/`, { method: 'POST' }),
      onSuccess,
    }),
    markAllRead: useMutation<void, APIError, void>({
      mutationFn: () => request('notifications/read-all/', { method: 'POST' }),
      onSuccess,
    }),
  };
}

export function useNotificationPreferences(enabled: boolean) {
  const queryClient = useQueryClient();
  const query = useQuery<{ email: boolean }, APIError>({
    queryKey: [KEY_NOTIFICATION_PREFERENCES],
    queryFn: () => request('notifications/preferences/'),
    enabled,
  });
  const update = useMutation<
    { email: boolean },
    APIError,
    { email: boolean },
    { email: boolean } | undefined
  >({
    mutationFn: (data) =>
      request('notifications/preferences/', {
        method: 'PATCH',
        body: JSON.stringify(data),
      }),
    // Every switch shows the choice at once; a failure puts it back
    onMutate: (data) => {
      const before = queryClient.getQueryData<{ email: boolean }>([
        KEY_NOTIFICATION_PREFERENCES,
      ]);
      queryClient.setQueryData([KEY_NOTIFICATION_PREFERENCES], data);
      return before;
    },
    onError: (_error, _data, before) =>
      queryClient.setQueryData([KEY_NOTIFICATION_PREFERENCES], before),
    onSuccess: (data) =>
      queryClient.setQueryData([KEY_NOTIFICATION_PREFERENCES], data),
  });
  return { query, update };
}

export interface MentionTarget {
  kind: 'user' | 'group';
  /** A user id, or a team string for a group. */
  id: string;
}

/**
 * Report a mention (or an assignment) so that the people concerned are
 * notified. Comments don't need this: the server reads their mentions.
 */
export const postMention = async ({
  docId,
  anchorId,
  target,
  reason = 'mention',
}: {
  docId: string;
  anchorId: string;
  target: MentionTarget;
  reason?: 'mention' | 'assignment';
}) => {
  const response = await fetchAPI(`documents/${docId}/mention/`, {
    method: 'POST',
    body: JSON.stringify({
      anchor_id: anchorId,
      reason,
      ...(target.kind === 'group'
        ? { mentioned_team: target.id }
        : { mentioned_user_id: target.id }),
    }),
  });
  if (!response.ok) {
    throw new APIError('Mention failed', await errorCauses(response));
  }
};
