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

const wasLeftOpen = () =>
  safeLocalStorage.getItem(LEFT_PANEL_STORAGE_KEY) === 'true';

/** Keep the choice made on a computer; phones close the panel as they go. */
const remember = (isPanelOpen: boolean) => {
  if (!useResponsiveStore.getState().isMobile) {
    safeLocalStorage.setItem(LEFT_PANEL_STORAGE_KEY, String(isPanelOpen));
  }
};

/** Start the next sign-in with the side panel hidden. */
export const forgetLeftPanel = () =>
  safeLocalStorage.removeItem(LEFT_PANEL_STORAGE_KEY);

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
}));

// Close the panel automatically whenever the responsive store switches to mobile.
useResponsiveStore.subscribe((state, prevState) => {
  if (state.isMobile && !prevState.isMobile) {
    useLeftPanelStore.getState().autoClose();
  }
});
