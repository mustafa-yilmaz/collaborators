import { beforeEach, describe, expect, it } from 'vitest';

import { useDocViewModeStore } from '../useDocViewModeStore';

describe('useDocViewModeStore', () => {
  beforeEach(() => {
    useDocViewModeStore.setState({
      docId: null,
      mode: 'reading',
      editOnOpenId: null,
    });
  });

  it('opens every page in reading view', () => {
    const store = useDocViewModeStore.getState();
    store.openDoc('a');
    store.setMode('a', 'editing');
    expect(useDocViewModeStore.getState().mode).toBe('editing');

    useDocViewModeStore.getState().openDoc('b');
    expect(useDocViewModeStore.getState()).toMatchObject({
      docId: 'b',
      mode: 'reading',
    });
  });

  it('opens a page just created in editing view, once', () => {
    useDocViewModeStore.getState().editOnOpen('new');
    useDocViewModeStore.getState().openDoc('new');
    expect(useDocViewModeStore.getState().mode).toBe('editing');

    useDocViewModeStore.getState().openDoc('other');
    useDocViewModeStore.getState().openDoc('new');
    expect(useDocViewModeStore.getState().mode).toBe('reading');
  });
});
