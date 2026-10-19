import { describe, expect, it } from 'vitest';

import {
  STALE_SEARCH_MS,
  isOwnSearch,
  isStaleSearch,
  searchOrigin,
} from '../searchSession';

describe('searches left in a page', () => {
  it('shows a search only in the tab that opened it', () => {
    const origin = searchOrigin();

    expect(isOwnSearch(origin)).toBe(true);
    expect(isOwnSearch({ ...origin, openedBy: 'another-tab' })).toBe(false);
    // Searches saved before origins were recorded belong to no one
    expect(isOwnSearch({})).toBe(false);
  });

  it('treats a search left for a while, or of unknown age, as left behind', () => {
    expect(isStaleSearch(searchOrigin())).toBe(false);
    expect(
      isStaleSearch({ openedAt: String(Date.now() - STALE_SEARCH_MS - 1) }),
    ).toBe(true);
    expect(isStaleSearch({})).toBe(true);
  });
});
