import { describe, expect, it, vi } from 'vitest';

import { sections } from '../Dashboard';
import { CARDS, DEFAULT_LAYOUT, mergeLayout } from '../cards';

vi.mock('@/features/notifications/NotificationBell', () => ({
  useNotificationText: () => () => '',
}));

describe('dashboard layout', () => {
  it('is lean by default: mentions and assigned, labels and recent pages across', () => {
    expect(
      DEFAULT_LAYOUT.filter((card) => !card.hidden).map((card) => card.id),
    ).toEqual(['notifications', 'assigned', 'labels', 'recent']);
    for (const id of ['recent', 'labels']) {
      expect(DEFAULT_LAYOUT.find((card) => card.id === id)?.wide).toBe(true);
    }
    expect(DEFAULT_LAYOUT).toHaveLength(CARDS.length);
  });

  it('uses the default layout when nothing is saved', () => {
    expect(mergeLayout([])).toEqual(DEFAULT_LAYOUT);
  });

  it('keeps the saved order and choices, drops unknown cards', () => {
    const merged = mergeLayout([
      { id: 'assigned', hidden: false, collapsed: true },
      { id: 'gone', hidden: false, collapsed: false },
      { id: 'recent', hidden: true, collapsed: false },
    ]);

    expect(
      merged.filter((card) => ['assigned', 'recent'].includes(card.id)),
    ).toEqual([
      { id: 'assigned', hidden: false, collapsed: true },
      { id: 'recent', hidden: true, collapsed: false },
    ]);
    expect(merged.map((card) => card.id)).not.toContain('gone');
    expect(merged).toHaveLength(CARDS.length);
  });

  it('adds cards introduced since the layout was saved, shown if by default', () => {
    const merged = mergeLayout([
      { id: 'recent', hidden: false, collapsed: false },
    ]);

    for (const card of merged.filter((item) => item.id !== 'recent')) {
      const definition = CARDS.find((item) => item.id === card.id);
      expect(card.hidden).toBe(!definition?.defaultVisible);
    }
  });

  it('puts a card added since at its default place, the chosen order kept', () => {
    // Saved before the labels card existed, recent pages moved first
    const merged = mergeLayout([
      { id: 'recent', hidden: false, collapsed: false, wide: true },
      { id: 'notifications', hidden: false, collapsed: false },
      { id: 'assigned', hidden: false, collapsed: false },
    ]);

    expect(merged.slice(0, 4).map((card) => card.id)).toEqual([
      'labels',
      'recent',
      'notifications',
      'assigned',
    ]);
    expect(merged[0].hidden).toBe(false);
  });

  it('lays wide cards across, the others two by two', () => {
    const card = (id: string, wide = false) => ({
      id,
      hidden: false,
      collapsed: false,
      wide,
    });
    const cards = [card('a'), card('b'), card('c', true), card('d')];

    expect(
      sections(cards, false).map((section) => [
        section.wide,
        section.items.map((item) => `${item.card.id}${item.index}`),
      ]),
    ).toEqual([
      [false, ['a0', 'b1']],
      [true, ['c2']],
      [false, ['d3']],
    ]);
    // Phones: one column, wide or not
    expect(sections(cards, true)).toHaveLength(1);
  });
});
