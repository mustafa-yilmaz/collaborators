import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  DRAG_SOURCES_STYLE_ID,
  NodeLike,
  animateLanding,
  autoScrollSpeed,
  blockIdsOf,
  dropPlacement,
  markDragSources,
} from '../motion';

const node = (name: string, id?: string, children: NodeLike[] = []) => ({
  type: { name },
  attrs: id ? { id } : {},
  forEach: (callback: (child: NodeLike) => void) => children.forEach(callback),
});

const page = (ids: string[]) => {
  const root = document.createElement('div');
  root.innerHTML = ids
    .map(
      (id) =>
        `<div class="bn-block-outer" data-id="${id}"><div class="bn-block"></div></div>`,
    )
    .join('');
  return root;
};

describe('Moving blocks', () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('finds the outermost blocks of a dragged slice', () => {
    expect(
      blockIdsOf([
        node('blockContainer', 'a', [
          node('blockGroup', undefined, [node('blockContainer', 'child')]),
        ]),
        node('blockGroup', undefined, [node('blockContainer', 'b')]),
        node('columnList', undefined, [
          node('column', undefined, [node('blockContainer', 'c')]),
        ]),
      ]),
    ).toEqual(['a', 'b', 'c']);
  });

  it('scrolls faster the closer the pointer is to an edge', () => {
    expect(autoScrollSpeed(400, 0, 800)).toBe(0);
    expect(autoScrollSpeed(60, 0, 800)).toBeLessThan(0);
    expect(autoScrollSpeed(0, 0, 800)).toBe(-18);
    expect(autoScrollSpeed(10, 0, 800)).toBeLessThan(
      autoScrollSpeed(60, 0, 800),
    );
    expect(autoScrollSpeed(790, 0, 800)).toBeGreaterThan(
      autoScrollSpeed(740, 0, 800),
    );
    expect(autoScrollSpeed(900, 0, 800)).toBe(18);
  });

  it('drops before a block over its top half, after it over the rest', () => {
    expect(dropPlacement(110, { top: 100, height: 40 })).toBe('before');
    expect(dropPlacement(130, { top: 100, height: 40 })).toBe('after');
  });

  it('dims the blocks being moved, without touching them', () => {
    const root = page(['a', 'b']);
    markDragSources(['a']);
    const style = () => document.getElementById(DRAG_SOURCES_STYLE_ID);
    expect(style()?.textContent).toContain('[data-id="a"]');
    expect(style()?.textContent).not.toContain('[data-id="b"]');
    expect(root.querySelector('[data-id="a"]')?.getAttribute('class')).toBe(
      'bn-block-outer',
    );
    markDragSources([]);
    expect(style()?.textContent).toBe('');
  });

  it('slides and lights up the blocks that moved, once they have', () => {
    let frames: FrameRequestCallback[] = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const nextFrame = () => {
      const current = frames;
      frames = [];
      current.forEach((callback) => callback(0));
    };
    const animate = vi.fn();
    // jsdom has no animations
    Object.defineProperty(HTMLElement.prototype, 'animate', {
      value: animate,
      configurable: true,
      writable: true,
    });
    const root = page(['a', 'b']);
    const a = root.querySelector<HTMLElement>('[data-id="a"]')!;
    let top = 200;
    vi.spyOn(a, 'getBoundingClientRect').mockImplementation(
      () => ({ top }) as DOMRect,
    );

    animateLanding(
      root,
      ['a', 'b'],
      new Map([
        ['a', 200],
        ['b', 0],
      ]),
    );
    // Not moved yet: nothing happens, it is watched
    nextFrame();
    expect(animate).not.toHaveBeenCalled();
    // Moved up by 40px: it slides from there and lights up
    top = 160;
    nextFrame();
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[0][0][0]).toEqual({
      transform: 'translateY(40px)',
    });
    // "b" never moved: given up after a few frames
    for (let i = 0; i < 12; i++) {
      nextFrame();
    }
    expect(animate).toHaveBeenCalledTimes(2);
    expect(frames).toHaveLength(0);
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  });
});
