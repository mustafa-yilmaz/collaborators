import { describe, expect, it, vi } from 'vitest';

import { sections } from '../Dashboard';
import { CARDS, DEFAULT_LAYOUT, mergeLayout } from '../cards';

vi.mock('@/features/notifications/NotificationBell', () => ({
  useNotificationText: () => () => '',
}));

describe('dashboard layout', () => {
  it('is lean by default: mentions and assignments beside labels, recent pages across', () => {
    expect(
      DEFAULT_LAYOUT.filter((card) => !card.hidden).map((card) => card.id),
    ).toEqual(['notifications', 'labels', 'recent']);
    expect(
      DEFAULT_LAYOUT.filter((card) => card.wide).map((card) => card.id),
    ).toEqual(['recent']);
    expect(DEFAULT_LAYOUT).toHaveLength(CARDS.length);
  });

  it('uses the default layout when nothing is saved', () => {
    expect(mergeLayout([])).toEqual(DEFAULT_LAYOUT);
  });

  it('keeps the saved order and choices, drops unknown cards', () => {
    const merged = mergeLayout([
      { id: 'recent', hidden: false, collapsed: true },
      { id: 'gone', hidden: false, collapsed: false },
      { id: 'notifications', hidden: true, collapsed: false },
    ]);

    expect(
      merged.filter((card) => ['recent', 'notifications'].includes(card.id)),
    ).toEqual([
      { id: 'recent', hidden: false, collapsed: true },
      { id: 'notifications', hidden: true, collapsed: false },
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
    // Saved before the labels card existed, recent pages moved first; the
    // former Assigned to me card is now part of the notifications one
    const merged = mergeLayout([
      { id: 'recent', hidden: false, collapsed: false, wide: true },
      { id: 'notifications', hidden: false, collapsed: false },
      { id: 'assigned', hidden: false, collapsed: false },
    ]);

    expect(merged.slice(0, 3).map((card) => card.id)).toEqual([
      'labels',
      'recent',
      'notifications',
    ]);
    expect(merged.map((card) => card.id)).not.toContain('assigned');
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
