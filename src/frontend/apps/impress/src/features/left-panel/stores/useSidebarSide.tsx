import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { css } from 'styled-components';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { APIError, errorCauses, fetchAPI } from '@/api';
import { useAuthQuery } from '@/features/auth/api';

export type SidebarSide = 'left' | 'right';

interface SidebarSideState {
  side: SidebarSide;
  setSide: (side: SidebarSide) => void;
}

/**
 * Which side of the screen the left panel stands on. Kept in the browser too,
 * so the page opens on the right side at once; the server keeps it for the
 * collaborator's other devices.
 */
export const useSidebarSideStore = create<SidebarSideState>()(
  persist(
    (set) => ({
      side: 'left',
      setSide: (side) => set({ side }),
    }),
    {
      name: 'collaborators-sidebar-side',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);

export const KEY_SIDEBAR_SIDE = 'sidebar-side';

const request = async (init?: RequestInit) => {
  const response = await fetchAPI('dashboard/sidebar/side/', init);
  if (!response.ok) {
    throw new APIError(
      'Failed to get the side of the panel',
      await errorCauses(response),
    );
  }
  return response.json() as Promise<{ side: SidebarSide }>;
};

/** The side of the panel, and moving it to the other side. */
export const useSidebarSide = () => {
  const queryClient = useQueryClient();
  // The signed-in user, without the router useAuth needs: bars use this
  const { data: user, isSuccess } = useAuthQuery();
  const authenticated = !!user && isSuccess;
  const { side, setSide } = useSidebarSideStore();
  const query = useQuery<{ side: SidebarSide }, APIError>({
    queryKey: [KEY_SIDEBAR_SIDE],
    queryFn: () => request(),
    enabled: authenticated,
    staleTime: Infinity,
  });
  useEffect(() => {
    if (query.data && query.data.side !== side) {
      setSide(query.data.side);
    }
    // Only when the server answers: a move sets both at once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query.data]);
  const save = useMutation<{ side: SidebarSide }, APIError, SidebarSide>({
    mutationFn: (next) =>
      request({ method: 'PUT', body: JSON.stringify({ side: next }) }),
  });

  const moveTo = (next: SidebarSide) => {
    setSide(next);
    queryClient.setQueryData([KEY_SIDEBAR_SIDE], { side: next });
    if (authenticated) {
      save.mutate(next);
    }
  };

  return { side, isRight: side === 'right', moveTo };
};

/**
 * On the right, the panel and the bars over the page are mirrored: their
 * rows run from the right, while words keep their letters in order.
 */
export const mirroredCss = css`
  direction: rtl;
  & * {
    unicode-bidi: plaintext;
  }
  /* Icons drawn for the left side face the other way */
  & .--collaborators--mirror-icon {
    transform: scaleX(-1);
  }
`;
