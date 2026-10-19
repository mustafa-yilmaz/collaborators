import { describe, expect, it, vi } from 'vitest';

import { CARDS, DEFAULT_LAYOUT, mergeLayout } from '../cards';

vi.mock('@/features/notifications/NotificationBell', () => ({
  useNotificationText: () => () => '',
}));

describe('dashboard layout', () => {
  it('is lean by default: recent, mentions and assigned only', () => {
    expect(
      DEFAULT_LAYOUT.filter((card) => !card.hidden).map((card) => card.id),
    ).toEqual(['recent', 'notifications', 'assigned']);
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

    expect(merged.slice(0, 2)).toEqual([
      { id: 'assigned', hidden: false, collapsed: true },
      { id: 'recent', hidden: true, collapsed: false },
    ]);
    expect(merged.map((card) => card.id)).not.toContain('gone');
    expect(merged).toHaveLength(CARDS.length);
  });

  it('adds cards introduced since the layout was saved, hidden', () => {
    const merged = mergeLayout([
      { id: 'recent', hidden: false, collapsed: false },
    ]);

    expect(merged.slice(1).every((card) => card.hidden)).toBe(true);
  });
});
