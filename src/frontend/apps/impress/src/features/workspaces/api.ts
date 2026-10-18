import {
  UseQueryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { KEY_DOC, KEY_LIST_DOC } from '@/features/docs/doc-management';

import {
  GrantableTeam,
  Group,
  GroupKind,
  GroupMembership,
  Space,
  SpaceVisibility,
  Workspace,
  WorkspaceAccess,
  WorkspaceGrant,
  WorkspaceRole,
} from './types';

export const KEY_LIST_WORKSPACE = 'workspaces';
export const KEY_LIST_WORKSPACE_ACCESS = 'workspace-accesses';
export const KEY_LIST_GROUP = 'workspace-groups';
export const KEY_LIST_GROUP_MEMBER = 'group-members';
export const KEY_LIST_SPACE = 'spaces';
export const KEY_LIST_GRANTABLE_TEAM = 'grantable-teams';
export const KEY_LIST_WORKSPACE_GRANT = 'workspace-grants';

/** Call the API and parse the JSON answer, or throw an APIError. */
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

const jsonInit = (method: string, body?: unknown): RequestInit => ({
  method,
  body: body === undefined ? undefined : JSON.stringify(body),
});

// -- Workspaces

export function useWorkspaces(
  queryConfig?: Omit<UseQueryOptions<Workspace[], APIError>, 'queryKey'>,
) {
  return useQuery<Workspace[], APIError>({
    queryKey: [KEY_LIST_WORKSPACE],
    queryFn: () =>
      request<Workspace[]>('workspaces/', 'Failed to get the workspaces'),
    ...queryConfig,
  });
}

export function useCreateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation<Workspace, APIError, { name: string }>({
    mutationFn: (data) =>
      request<Workspace>(
        'workspaces/',
        'Failed to create the workspace',
        jsonInit('POST', data),
      ),
    onSuccess: (workspace) => {
      // Known right away, so it can be selected before the list is refetched
      queryClient.setQueryData<Workspace[]>([KEY_LIST_WORKSPACE], (list) => [
        ...(list ?? []),
        workspace,
      ]);
      void queryClient.invalidateQueries({ queryKey: [KEY_LIST_WORKSPACE] });
    },
  });
}

export function useUpdateWorkspace() {
  const queryClient = useQueryClient();
  return useMutation<
    Workspace,
    APIError,
    { id: string; name?: string; description?: string }
  >({
    mutationFn: ({ id, ...data }) =>
      request<Workspace>(
        `workspaces/${id}/`,
        'Failed to update the workspace',
        jsonInit('PATCH', data),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY_LIST_WORKSPACE] });
    },
  });
}

export function useDeleteWorkspace() {
  const queryClient = useQueryClient();
  return useMutation<void, APIError, { id: string }>({
    mutationFn: ({ id }) =>
      request<void>(
        `workspaces/${id}/`,
        'Failed to delete the workspace',
        jsonInit('DELETE'),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY_LIST_WORKSPACE] });
      void queryClient.invalidateQueries({ queryKey: [KEY_LIST_SPACE] });
    },
  });
}

// -- Workspace members

export function useWorkspaceAccesses(workspaceId: string) {
  return useQuery<WorkspaceAccess[], APIError>({
    queryKey: [KEY_LIST_WORKSPACE_ACCESS, workspaceId],
    queryFn: () =>
      request<WorkspaceAccess[]>(
        `workspaces/${workspaceId}/accesses/`,
        'Failed to get the members',
      ),
    enabled: !!workspaceId,
  });
}

export function useWorkspaceAccessMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({
      queryKey: [KEY_LIST_WORKSPACE_ACCESS, workspaceId],
    });
    void queryClient.invalidateQueries({ queryKey: [KEY_LIST_WORKSPACE] });
  };
  const url = `workspaces/${workspaceId}/accesses/`;

  return {
    add: useMutation<
      WorkspaceAccess,
      APIError,
      { userId: string; role?: WorkspaceRole }
    >({
      mutationFn: ({ userId, role }) =>
        request(
          url,
          'Failed to add the member',
          jsonInit('POST', { user_id: userId, role }),
        ),
      onSuccess,
    }),
    update: useMutation<
      WorkspaceAccess,
      APIError,
      { accessId: string; role: WorkspaceRole }
    >({
      mutationFn: ({ accessId, role }) =>
        request(
          `${url}${accessId}/`,
          'Failed to change the role',
          jsonInit('PATCH', { role }),
        ),
      onSuccess,
    }),
    remove: useMutation<void, APIError, { accessId: string }>({
      mutationFn: ({ accessId }) =>
        request(
          `${url}${accessId}/`,
          'Failed to remove the member',
          jsonInit('DELETE'),
        ),
      onSuccess,
    }),
  };
}

// -- Groups

export function useGroups(workspaceId: string) {
  return useQuery<Group[], APIError>({
    queryKey: [KEY_LIST_GROUP, workspaceId],
    queryFn: () =>
      request<Group[]>(
        `workspaces/${workspaceId}/groups/`,
        'Failed to get the groups',
      ),
    enabled: !!workspaceId,
  });
}

export function useGroupMutations(workspaceId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({
      queryKey: [KEY_LIST_GROUP, workspaceId],
    });
  };
  const url = `workspaces/${workspaceId}/groups/`;

  return {
    create: useMutation<Group, APIError, { name: string; kind: GroupKind }>({
      mutationFn: (data) =>
        request(url, 'Failed to create the group', jsonInit('POST', data)),
      onSuccess,
    }),
    update: useMutation<
      Group,
      APIError,
      { groupId: string; name?: string; kind?: GroupKind }
    >({
      mutationFn: ({ groupId, ...data }) =>
        request(
          `${url}${groupId}/`,
          'Failed to update the group',
          jsonInit('PATCH', data),
        ),
      onSuccess,
    }),
    remove: useMutation<void, APIError, { groupId: string }>({
      mutationFn: ({ groupId }) =>
        request(
          `${url}${groupId}/`,
          'Failed to delete the group',
          jsonInit('DELETE'),
        ),
      onSuccess,
    }),
  };
}

export function useGroupMembers(groupId: string) {
  return useQuery<GroupMembership[], APIError>({
    queryKey: [KEY_LIST_GROUP_MEMBER, groupId],
    queryFn: () =>
      request<GroupMembership[]>(
        `groups/${groupId}/members/`,
        'Failed to get the group members',
      ),
    enabled: !!groupId,
  });
}

export function useGroupMemberMutations(groupId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({
      queryKey: [KEY_LIST_GROUP_MEMBER, groupId],
    });
    void queryClient.invalidateQueries({ queryKey: [KEY_LIST_GROUP] });
  };
  const url = `groups/${groupId}/members/`;

  return {
    add: useMutation<GroupMembership, APIError, { userId: string }>({
      mutationFn: ({ userId }) =>
        request(
          url,
          'Failed to add the member',
          jsonInit('POST', { user_id: userId }),
        ),
      onSuccess,
    }),
    update: useMutation<
      GroupMembership,
      APIError,
      { membershipId: string; isManager: boolean }
    >({
      mutationFn: ({ membershipId, isManager }) =>
        request(
          `${url}${membershipId}/`,
          'Failed to update the member',
          jsonInit('PATCH', { is_manager: isManager }),
        ),
      onSuccess,
    }),
    remove: useMutation<void, APIError, { membershipId: string }>({
      mutationFn: ({ membershipId }) =>
        request(
          `${url}${membershipId}/`,
          'Failed to remove the member',
          jsonInit('DELETE'),
        ),
      onSuccess,
    }),
  };
}

// -- Spaces

export type SpacesParams =
  | { workspaceId: string; independent?: never }
  | { independent: true; workspaceId?: never };

export function useSpaces(params: SpacesParams, enabled = true) {
  return useQuery<Space[], APIError>({
    queryKey: [KEY_LIST_SPACE, params],
    queryFn: () =>
      request<Space[]>(
        `spaces/?${
          params.independent
            ? 'independent=true'
            : `workspace=${params.workspaceId}`
        }`,
        'Failed to get the spaces',
      ),
    enabled,
  });
}

export interface CreateSpaceParams {
  title: string;
  workspaceId?: string;
  visibility: SpaceVisibility;
  editorUserIds: string[];
  editorGroupIds: string[];
}

export function useCreateSpace() {
  const queryClient = useQueryClient();
  return useMutation<Space, APIError, CreateSpaceParams>({
    mutationFn: (params) =>
      request<Space>(
        'spaces/',
        'Failed to create the space',
        jsonInit('POST', {
          title: params.title,
          workspace_id: params.workspaceId,
          visibility: params.visibility,
          editor_user_ids: params.editorUserIds,
          editor_group_ids: params.editorGroupIds,
        }),
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [KEY_LIST_SPACE] });
    },
  });
}

export function useSpaceMutations(spaceId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({ queryKey: [KEY_LIST_SPACE] });
    void queryClient.invalidateQueries({ queryKey: [KEY_DOC] });
    void queryClient.invalidateQueries({ queryKey: [KEY_LIST_DOC] });
  };
  return {
    moveToWorkspace: useMutation<Space, APIError, { workspaceId: string }>({
      mutationFn: ({ workspaceId }) =>
        request(
          `spaces/${spaceId}/move-to-workspace/`,
          'Failed to move the space',
          jsonInit('POST', { workspace_id: workspaceId }),
        ),
      onSuccess,
    }),
    link: useMutation<Space, APIError, { workspaceId: string }>({
      mutationFn: ({ workspaceId }) =>
        request(
          `spaces/${spaceId}/links/`,
          'Failed to share the space',
          jsonInit('POST', { workspace_id: workspaceId }),
        ),
      onSuccess,
    }),
    unlink: useMutation<void, APIError, { workspaceId: string }>({
      mutationFn: ({ workspaceId }) =>
        request(
          `spaces/${spaceId}/links/`,
          'Failed to stop sharing the space',
          jsonInit('DELETE', { workspace_id: workspaceId }),
        ),
      onSuccess,
    }),
  };
}

export function useSpace(spaceId: string, enabled = true) {
  return useQuery<Space, APIError>({
    queryKey: [KEY_LIST_SPACE, 'detail', spaceId],
    queryFn: () =>
      request<Space>(`spaces/${spaceId}/`, 'Failed to get the space'),
    enabled: enabled && !!spaceId,
  });
}

// -- Grants to groups

export function useGrantableTeams(docId: string, query: string) {
  return useQuery<GrantableTeam[], APIError>({
    queryKey: [KEY_LIST_GRANTABLE_TEAM, docId, query],
    queryFn: () =>
      request<GrantableTeam[]>(
        `groups/?document_id=${docId}&q=${encodeURIComponent(query)}`,
        'Failed to get the groups',
      ),
    enabled: !!docId,
  });
}

export function useWorkspaceGrants(spaceId: string, enabled = true) {
  return useQuery<WorkspaceGrant[], APIError>({
    queryKey: [KEY_LIST_WORKSPACE_GRANT, spaceId],
    queryFn: () =>
      request<WorkspaceGrant[]>(
        `spaces/${spaceId}/workspace-grants/`,
        'Failed to get the grants',
      ),
    enabled: enabled && !!spaceId,
  });
}

export function useWorkspaceGrantMutations(spaceId: string) {
  const queryClient = useQueryClient();
  const onSuccess = () => {
    void queryClient.invalidateQueries({
      queryKey: [KEY_LIST_WORKSPACE_GRANT, spaceId],
    });
  };
  const url = `spaces/${spaceId}/workspace-grants/`;
  return {
    grant: useMutation<
      WorkspaceGrant,
      APIError,
      { team: string; role: string }
    >({
      mutationFn: (data) =>
        request(url, 'Failed to grant the role', jsonInit('POST', data)),
      onSuccess,
    }),
    revoke: useMutation<void, APIError, { team: string }>({
      mutationFn: (data) =>
        request(url, 'Failed to revoke the role', jsonInit('DELETE', data)),
      onSuccess,
    }),
  };
}
