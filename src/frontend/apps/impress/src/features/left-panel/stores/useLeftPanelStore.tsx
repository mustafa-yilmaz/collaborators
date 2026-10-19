import { create } from 'zustand';

import {
  MOBILE_BREAKPOINT,
  useResponsiveStore,
} from '@/stores/useResponsiveStore';
import { safeLocalStorage } from '@/utils/storages';

/**
 * Collaborators: whether the side panel was left open, kept in the browser
 * so it stays as it was from page to page. Hidden when nothing is kept, and
 * forgotten at each sign-in, which therefore opens on a hidden panel.
 */
export const LEFT_PANEL_STORAGE_KEY = 'collaborators-left-panel-open';
/**
 * Pages read (rather than edited) keep their own choice, hidden at first:
 * shown once, the panel stays shown from page to page while reading.
 */
export const LEFT_PANEL_READING_STORAGE_KEY =
  'collaborators-left-panel-open-reading';

const storageKey = (isReading: boolean) =>
  isReading ? LEFT_PANEL_READING_STORAGE_KEY : LEFT_PANEL_STORAGE_KEY;

const wasLeftOpen = (isReading = false) =>
  safeLocalStorage.getItem(storageKey(isReading)) === 'true';

/** Keep the choice made on a computer; phones close the panel as they go. */
const remember = (isPanelOpen: boolean) => {
  if (!useResponsiveStore.getState().isMobile) {
    safeLocalStorage.setItem(
      storageKey(useLeftPanelStore.getState().isReading),
      String(isPanelOpen),
    );
  }
};

/** Start the next sign-in with the side panel hidden. */
export const forgetLeftPanel = () => {
  safeLocalStorage.removeItem(LEFT_PANEL_STORAGE_KEY);
  safeLocalStorage.removeItem(LEFT_PANEL_READING_STORAGE_KEY);
};

interface LeftPanelState {
  isPanelOpen: boolean;
  /**
   * Depending on the responsive breakpoint, the panel can be auto-closed, and so
   * auto-opened later on.
   */
  wasAutoClosed: boolean;
  togglePanel: () => void;
  closePanel: () => void;
  openPanel: () => void;
  autoClose: () => void;
  /** A page is being read: the panel follows the reading choice */
  isReading: boolean;
  setReading: (isReading: boolean) => void;
}

const isMobileOnInit = () =>
  typeof window !== 'undefined' && window.innerWidth < MOBILE_BREAKPOINT;

export const useLeftPanelStore = create<LeftPanelState>((set, get) => ({
  isPanelOpen:
    typeof window !== 'undefined' && !isMobileOnInit() && wasLeftOpen(),
  wasAutoClosed: false,
  togglePanel: () => {
    const { isPanelOpen } = get();
    set({ isPanelOpen: !isPanelOpen, wasAutoClosed: false });
    remember(!isPanelOpen);
  },
  openPanel: () => {
    set({ isPanelOpen: true, wasAutoClosed: false });
    remember(true);
  },
  closePanel: () => {
    set({ isPanelOpen: false, wasAutoClosed: false });
    remember(false);
  },
  autoClose: () => set({ isPanelOpen: false, wasAutoClosed: true }),
  isReading: false,
  setReading: (isReading) => {
    if (get().isReading === isReading) {
      return;
    }
    set({
      isReading,
      isPanelOpen:
        !useResponsiveStore.getState().isMobile && wasLeftOpen(isReading),
      wasAutoClosed: false,
    });
  },
}));

// Close the panel automatically whenever the responsive store switches to mobile.
useResponsiveStore.subscribe((state, prevState) => {
  if (state.isMobile && !prevState.isMobile) {
    useLeftPanelStore.getState().autoClose();
  }
});
