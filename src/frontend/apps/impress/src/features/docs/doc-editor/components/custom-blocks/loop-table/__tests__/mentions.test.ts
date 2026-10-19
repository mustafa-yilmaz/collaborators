import { describe, expect, it } from 'vitest';

import {
  cellAnchor,
  mentionToken,
  plainText,
  splitMentions,
} from '../mentions';

describe('Loop table cell mentions', () => {
  it('writes a mention as a token and reads it back', () => {
    const token = mentionToken({ kind: 'group', id: 'group:1', label: 'Q4' });

    expect(token).toBe('@[Q4](group:group:1)');
    expect(splitMentions(`Ask ${token} today`)).toEqual([
      'Ask ',
      { kind: 'group', id: 'group:1', label: 'Q4' },
      ' today',
    ]);
  });

  it('keeps brackets out of labels so tokens stay readable', () => {
    expect(mentionToken({ kind: 'user', id: 'u', label: 'A [B]' })).toBe(
      '@[A B](user:u)',
    );
  });

  it('shows mentions as @name in plain text', () => {
    expect(plainText('Hi @[Ada](user:u1) and @[Q4](group:group:1)')).toBe(
      'Hi @Ada and @Q4',
    );
  });

  it('points notifications at a cell', () => {
    expect(cellAnchor('t', 'r', 'c')).toBe('cell:t:r:c');
  });

  it('links pages, read as their title', () => {
    const token = mentionToken({ kind: 'page', id: 'p1', label: 'Budget' });

    expect(token).toBe('@[Budget](page:p1)');
    expect(splitMentions(`See ${token}`)).toEqual([
      'See ',
      { kind: 'page', id: 'p1', label: 'Budget' },
    ]);
    expect(plainText(`See ${token} and @[Ada](user:u1)`)).toBe(
      'See Budget and @Ada',
    );
  });
});
