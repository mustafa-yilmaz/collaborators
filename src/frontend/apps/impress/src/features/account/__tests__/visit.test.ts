import { beforeEach, describe, expect, test } from 'vitest';

import {
  VISIT_GAP_MS,
  endVisit,
  hideForThisVisit,
  isHiddenThisVisit,
  touchVisit,
} from '../visit';

describe('visit', () => {
  beforeEach(() => window.localStorage.clear());

  test('a note closed stays closed while the visit goes on', () => {
    const start = 1_000_000;
    hideForThisVisit('welcome', start);
    // still there 20 minutes later, and kept alive by any open page
    expect(isHiddenThisVisit('welcome', start + 20 * 60_000)).toBe(true);
    touchVisit(start + 25 * 60_000);
    expect(isHiddenThisVisit('welcome', start + 50 * 60_000)).toBe(true);
  });

  test('after leaving for longer than the gap, a new visit shows it again', () => {
    const start = 1_000_000;
    hideForThisVisit('welcome', start);
    const back = start + VISIT_GAP_MS + 1;
    expect(isHiddenThisVisit('welcome', back)).toBe(false);
    // the new visit starts empty
    touchVisit(back);
    expect(isHiddenThisVisit('welcome', back + 1)).toBe(false);
  });

  test('signing out ends the visit', () => {
    hideForThisVisit('welcome');
    endVisit();
    expect(isHiddenThisVisit('welcome')).toBe(false);
  });
});
