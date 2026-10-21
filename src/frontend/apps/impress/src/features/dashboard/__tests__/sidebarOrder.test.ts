import { describe, expect, it } from 'vitest';

import { orderItems } from '../api';

const items = ['recent', 'notifications', 'labels', 'explore', 'owned'].map(
  (id) => ({ id }),
);
const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe('sidebar order', () => {
  it('keeps the default order when nothing is saved', () => {
    expect(ids(orderItems(items, []))).toEqual(ids(items));
  });

  it('follows the saved order, unknown ids dropped', () => {
    expect(
      ids(
        orderItems(items, [
          'owned',
          'gone',
          'recent',
          'notifications',
          'labels',
          'explore',
        ]),
      ),
    ).toEqual(['owned', 'recent', 'notifications', 'labels', 'explore']);
  });

  it('puts items added since at their default place', () => {
    // Saved before Explore existed
    expect(
      ids(orderItems(items, ['labels', 'recent', 'notifications', 'owned'])),
    ).toEqual(['labels', 'recent', 'notifications', 'explore', 'owned']);
  });
});
