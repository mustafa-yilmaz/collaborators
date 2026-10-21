import { describe, expect, it, vi } from 'vitest';

import { sections } from '../Dashboard';
import { CARDS, DEFAULT_LAYOUT, mergeLayout } from '../cards';

vi.mock('@/features/notifications/hooks', () => ({
  useNotificationText: () => () => '',
  useNotificationTarget: () => () => ({ href: '/' }),
}));

describe('dashboard layout', () => {
  it('is lean by default: notifications across, then recent across', () => {
    expect(
      DEFAULT_LAYOUT.filter((card) => !card.hidden).map((card) => card.id),
    ).toEqual(['notifications', 'recent']);
    expect(
      DEFAULT_LAYOUT.filter((card) => card.wide).map((card) => card.id),
    ).toEqual(['notifications', 'recent']);
    expect(DEFAULT_LAYOUT).toHaveLength(CARDS.length);
  });

  it('offers Starred, Owned by me and Shared with me to add', () => {
    expect(
      DEFAULT_LAYOUT.filter((card) => card.hidden).map((card) => card.id),
    ).toEqual(['favorites', 'owned', 'shared']);
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
    // Recent moved first; the former Assigned to me card is now part of the
    // notifications one, Owned by me is new
    const merged = mergeLayout([
      { id: 'recent', hidden: false, collapsed: false, wide: true },
      { id: 'notifications', hidden: false, collapsed: false, wide: true },
      { id: 'assigned', hidden: false, collapsed: false },
      { id: 'favorites', hidden: true, collapsed: false },
      { id: 'shared', hidden: false, collapsed: false },
    ]);

    expect(merged.map((card) => card.id)).toEqual([
      'recent',
      'notifications',
      'favorites',
      'owned',
      'shared',
    ]);
    expect(merged.find((card) => card.id === 'owned')?.hidden).toBe(true);
  });

  it('drops the cards no longer offered, Notifications going across', () => {
    // Saved with Notifications beside Labels, and the former list cards
    const merged = mergeLayout([
      { id: 'notifications', hidden: false, collapsed: false },
      { id: 'labels', hidden: false, collapsed: false },
      { id: 'recent', hidden: false, collapsed: false, wide: true },
      { id: 'spaces', hidden: false, collapsed: false },
      { id: 'pages', hidden: true, collapsed: false },
    ]);

    expect(merged.map((card) => card.id)).toEqual([
      'notifications',
      'recent',
      'favorites',
      'owned',
      'shared',
    ]);
    expect(merged[0].wide).toBe(true);
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
