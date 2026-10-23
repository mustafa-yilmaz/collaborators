import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import {
  PAGE_SETTINGS_KEY,
  hasTableOfContents,
  setTableOfContents,
} from '../hooks/usePageTableOfContents';

describe('A page table of contents', () => {
  it('is off unless turned on, and kept with the page', () => {
    const ydoc = new Y.Doc();
    expect(hasTableOfContents(ydoc)).toBe(false);

    setTableOfContents(ydoc, true);
    expect(hasTableOfContents(ydoc)).toBe(true);

    // Everyone with the page sees the choice
    const copy = new Y.Doc();
    Y.applyUpdate(copy, Y.encodeStateAsUpdate(ydoc));
    expect(hasTableOfContents(copy)).toBe(true);

    setTableOfContents(ydoc, false);
    expect(hasTableOfContents(ydoc)).toBe(false);
    expect(ydoc.getMap(PAGE_SETTINGS_KEY).size).toBe(0);
  });
});
