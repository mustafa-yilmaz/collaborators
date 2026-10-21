import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { APIError, APIList, errorCauses, fetchAPI } from '@/api';
import { Doc } from '@/features/docs/doc-management';

export interface CardLayout {
  id: string;
  hidden: boolean;
  collapsed: boolean;
  /** Shown across both columns rather than in one */
  wide?: boolean;
}

export interface RecentDoc {
  id: string;
  title: string | null;
  kind: 'page' | 'space';
  /** The page's first words, when known */
  excerpt?: string;
  updated_at: string;
  space: { id: string; title: string | null } | null;
}

export interface AssignedRow {
  id: string;
  document: { id: string; title: string | null };
  anchor_id: string;
  row_label: string;
  team_label: string | null;
  assigned_by: string | null;
  updated_at: string;
}

export const KEY_DASHBOARD_LAYOUT = 'dashboard-layout';

const get = async <T>(url: string): Promise<T> => {
  const response = await fetchAPI(url);
  if (!response.ok) {
    throw new APIError('Dashboard request failed', await errorCauses(response));
  }
  return response.json() as Promise<T>;
};

export function useDashboardLayout() {
  const queryClient = useQueryClient();
  const query = useQuery<CardLayout[], APIError>({
    queryKey: [KEY_DASHBOARD_LAYOUT],
    queryFn: () => get<CardLayout[]>('dashboard/layout/'),
    staleTime: Infinity,
  });
  const save = useMutation<CardLayout[], APIError, CardLayout[]>({
    mutationFn: async (layout) => {
      const response = await fetchAPI('dashboard/layout/', {
        method: 'PUT',
        body: JSON.stringify(layout),
      });
      if (!response.ok) {
        throw new APIError('Saving failed', await errorCauses(response));
      }
      return response.json() as Promise<CardLayout[]>;
    },
    // Show the change right away; the server keeps it for next time
    onMutate: (layout) => {
      queryClient.setQueryData([KEY_DASHBOARD_LAYOUT], layout);
    },
  });
  return { query, save };
}

export const KEY_SIDEBAR_ORDER = 'sidebar-order';

/** The order of the lists of "My collaborations", kept per collaborator. */
export function useSidebarOrder() {
  const queryClient = useQueryClient();
  const query = useQuery<string[], APIError>({
    queryKey: [KEY_SIDEBAR_ORDER],
    queryFn: () => get<string[]>('dashboard/sidebar/'),
    staleTime: Infinity,
  });
  const save = useMutation<string[], APIError, string[]>({
    mutationFn: async (order) => {
      const response = await fetchAPI('dashboard/sidebar/', {
        method: 'PUT',
        body: JSON.stringify(order),
      });
      if (!response.ok) {
        throw new APIError('Saving failed', await errorCauses(response));
      }
      return response.json() as Promise<string[]>;
    },
    onMutate: (order) => {
      queryClient.setQueryData([KEY_SIDEBAR_ORDER], order);
    },
  });
  return { query, save };
}

/**
 * The items in the saved order: those saved first, the others (added since,
 * or never moved) where they stand by default.
 */
export const orderItems = <T extends { id: string }>(
  items: T[],
  saved: string[],
): T[] => {
  const known = saved
    .map((id) => items.find((item) => item.id === id))
    .filter((item): item is T => !!item);
  const merged = [...known];
  items.forEach((item, index) => {
    if (merged.includes(item)) {
      return;
    }
    const next = items.slice(index + 1).find((later) => merged.includes(later));
    merged.splice(next ? merged.indexOf(next) : merged.length, 0, item);
  });
  return merged;
};

export const useRecentDocs = (enabled: boolean) =>
  useQuery<RecentDoc[], APIError>({
    queryKey: ['dashboard-recent'],
    queryFn: () => get<RecentDoc[]>('dashboard/recent/'),
    enabled,
  });

export const useAssignedRows = (enabled: boolean) =>
  useQuery<AssignedRow[], APIError>({
    queryKey: ['dashboard-assigned'],
    queryFn: () => get<AssignedRow[]>('dashboard/assigned/'),
    enabled,
  });

/** A first page of documents from the documents API. */
export const useDocsList = (key: string, query: string, enabled: boolean) =>
  useQuery<Doc[], APIError>({
    queryKey: ['dashboard-docs', key, query],
    queryFn: async () => (await get<APIList<Doc>>(query)).results.slice(0, 6),
    enabled,
  });
