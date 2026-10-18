import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

interface WorkspaceState {
  /** The workspace shown in the left panel; null for "My spaces & pages". */
  currentWorkspaceId: string | null;
  setCurrentWorkspaceId: (workspaceId: string | null) => void;
}

/** Remembered per browser, so the left panel reopens where the user left it. */
export const useWorkspaceStore = create<WorkspaceState>()(
  persist(
    (set) => ({
      currentWorkspaceId: null,
      setCurrentWorkspaceId: (currentWorkspaceId) =>
        set({ currentWorkspaceId }),
    }),
    {
      name: 'collaborators-current-workspace',
      storage: createJSONStorage(() => localStorage),
    },
  ),
);
