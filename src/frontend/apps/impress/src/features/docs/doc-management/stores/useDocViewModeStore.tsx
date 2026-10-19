import { create } from 'zustand';

import { Doc } from '../types';

export type DocViewMode = 'reading' | 'editing';

/**
 * Collaborators: a page opens in reading view, even for people who may edit
 * it, so that nothing changes by mistake; they switch to editing view on
 * purpose. A page just created opens in editing view, to be written.
 */
interface DocViewModeState {
  /** The page the mode is about */
  docId: string | null;
  mode: DocViewMode;
  /** A page just created, to open in editing view */
  editOnOpenId: string | null;
  openDoc: (docId: string) => void;
  setMode: (docId: string, mode: DocViewMode) => void;
  editOnOpen: (docId: string) => void;
}

export const useDocViewModeStore = create<DocViewModeState>((set, get) => ({
  docId: null,
  mode: 'reading',
  editOnOpenId: null,
  openDoc: (docId) => {
    const { docId: current, editOnOpenId } = get();
    if (current === docId) {
      return;
    }
    set({
      docId,
      mode: editOnOpenId === docId ? 'editing' : 'reading',
      editOnOpenId: editOnOpenId === docId ? null : editOnOpenId,
    });
  },
  setMode: (docId, mode) => set({ docId, mode }),
  editOnOpen: (docId) => set({ editOnOpenId: docId }),
}));

/** The view a page is shown in: reading unless switched (or just created). */
export const useDocViewMode = (docId: string): DocViewMode =>
  useDocViewModeStore((state) =>
    state.docId === docId
      ? state.mode
      : state.editOnOpenId === docId
        ? 'editing'
        : 'reading',
  );

/** Whether the page can be changed right now: allowed, and in editing view. */
export const useIsDocEditable = (doc: Doc) => {
  const mode = useDocViewMode(doc.id);
  return (
    !!doc.abilities.partial_update && !doc.deleted_at && mode === 'editing'
  );
};
