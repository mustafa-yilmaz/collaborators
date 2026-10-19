import { beforeEach, describe, expect, it } from 'vitest';

import {
  LEFT_PANEL_STORAGE_KEY,
  forgetLeftPanel,
  useLeftPanelStore,
} from '../useLeftPanelStore';

describe('useLeftPanelStore', () => {
  beforeEach(() => {
    localStorage.clear();
    useLeftPanelStore.setState({ isPanelOpen: false });
  });

  it('keeps the side panel open or hidden from page to page', () => {
    useLeftPanelStore.getState().togglePanel();
    expect(localStorage.getItem(LEFT_PANEL_STORAGE_KEY)).toBe('true');

    useLeftPanelStore.getState().closePanel();
    expect(localStorage.getItem(LEFT_PANEL_STORAGE_KEY)).toBe('false');
  });

  it('forgets it at sign-in, so the panel starts hidden', () => {
    useLeftPanelStore.getState().openPanel();
    forgetLeftPanel();
    expect(localStorage.getItem(LEFT_PANEL_STORAGE_KEY)).toBeNull();
  });
});
