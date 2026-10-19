import { describe, expect, it } from 'vitest';

import { slugify, wikiUrl } from '../utils';
import { flattenTree, pathTo, searchPages } from '../wiki/tree';

const tree = [
  {
    id: 'a',
    title: 'Getting started',
    children: [{ id: 'b', title: 'Café rules', children: [] }],
  },
  { id: 'c', title: 'Glossary', children: [] },
];

describe('publishing utils', () => {
  it('turns a title into a wiki address', () => {
    expect(slugify('  Team Handbook 2026! ')).toBe('team-handbook-2026');
    expect(slugify('Éléphant & Co')).toBe('elephant-co');
    expect(wikiUrl('handbook')).toBe('/wiki/handbook/');
    expect(wikiUrl('handbook', 'a')).toBe('/wiki/handbook/a/');
  });

  it('flattens the tree with the titles above each page', () => {
    expect(flattenTree(tree)).toEqual([
      { id: 'a', title: 'Getting started', trail: [] },
      { id: 'b', title: 'Café rules', trail: ['Getting started'] },
      { id: 'c', title: 'Glossary', trail: [] },
    ]);
  });

  it('finds the path down to a page', () => {
    expect(pathTo(tree, 'b')).toEqual(['a', 'b']);
    expect(pathTo(tree, 'zzz')).toEqual([]);
  });

  it('searches titles, ignoring case and accents', () => {
    const pages = flattenTree(tree);
    expect(searchPages(pages, 'cafe').map((page) => page.id)).toEqual(['b']);
    expect(searchPages(pages, 'G').map((page) => page.id)).toEqual(['a', 'c']);
    expect(searchPages(pages, '  ')).toEqual([]);
  });
});
