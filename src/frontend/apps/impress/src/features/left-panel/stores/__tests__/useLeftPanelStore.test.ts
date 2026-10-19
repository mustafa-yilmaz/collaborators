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

describe('useLeftPanelStore while reading', () => {
  beforeEach(() => {
    localStorage.clear();
    useLeftPanelStore.setState({ isPanelOpen: true, isReading: false });
  });

  it('hides the panel at first, then keeps the reading choice apart', () => {
    useLeftPanelStore.getState().setReading(true);
    expect(useLeftPanelStore.getState().isPanelOpen).toBe(false);

    useLeftPanelStore.getState().openPanel();
    expect(localStorage.getItem('collaborators-left-panel-open-reading')).toBe(
      'true',
    );
    expect(localStorage.getItem(LEFT_PANEL_STORAGE_KEY)).toBeNull();

    useLeftPanelStore.getState().setReading(false);
    useLeftPanelStore.getState().setReading(true);
    expect(useLeftPanelStore.getState().isPanelOpen).toBe(true);
  });
});
