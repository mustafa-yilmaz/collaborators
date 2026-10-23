import { render } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { BlockMotion } from '../BlockMotion';
import { DRAG_SOURCES_STYLE_ID } from '../motion';

const page = document.createElement('div');
page.innerHTML =
  '<div class="bn-block-outer" data-id="a"><div class="bn-block"></div></div>';

vi.mock('@blocknote/react', () => ({
  useBlockNoteEditor: () => ({
    domElement: page,
    isEditable: true,
    // BlockNote selects the dragged block when its drag starts
    prosemirrorView: {
      state: {
        selection: {
          content: () => ({
            content: {
              forEach: (callback: (node: unknown) => void) =>
                callback({
                  type: { name: 'blockContainer' },
                  attrs: { id: 'a' },
                  forEach: () => {},
                }),
            },
          }),
        },
      },
    },
  }),
  useExtensionState: () => undefined,
}));

const dimmed = () =>
  document.getElementById(DRAG_SOURCES_STYLE_ID)?.textContent ?? '';

const startDrag = () => {
  const sideMenu = document.createElement('div');
  sideMenu.className = 'bn-side-menu';
  const handle = document.createElement('button');
  sideMenu.appendChild(handle);
  document.body.appendChild(sideMenu);
  handle.dispatchEvent(new Event('dragstart', { bubbles: true }));
  return { sideMenu, handle };
};

describe('BlockMotion', () => {
  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('stops dimming a dropped block though BlockNote takes its handle away', () => {
    render(<BlockMotion />);
    const { sideMenu } = startDrag();
    expect(dimmed()).toContain('[data-id="a"]');

    // Dropped: the "⠿" goes, and with it the "dragend" the page would get
    sideMenu.remove();
    document.dispatchEvent(new Event('drop', { bubbles: true }));
    expect(dimmed()).toBe('');
  });

  it('stops dimming a drag given up without any end', () => {
    render(<BlockMotion />);
    const { sideMenu } = startDrag();
    sideMenu.remove();
    expect(dimmed()).toContain('[data-id="a"]');

    document.dispatchEvent(new MouseEvent('mousemove', { bubbles: true }));
    expect(dimmed()).toBe('');
  });
});
